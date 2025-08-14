package com.musinsa.workup.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.workup.config.BedrockProperties
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.Workbook
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest
import java.net.URLDecoder
import java.text.Normalizer
import kotlin.collections.iterator
import kotlin.math.min

@Service
class MultiExcelProcessingService(
    private val props: BedrockProperties
) {
    data class RowResult(
        val fileName: String,
        val sheetName: String,
        val rowIndex: Int,
        val text: String
    )
    data class ProcessResult(
        val scope: String, // e.g., "ALL_FILES" or specific
        val rows: List<RowResult>,
        val outputText: String
    )
    data class MultiProcessResult(
        val modelId: String,
        val usedBedrock: Boolean,
        val usedApiKey: Boolean, // deprecated alias, kept for backward compatibility
        val results: List<ProcessResult>
    )

    private data class LocalGenerateResult(
        val outputText: String,
        val usedBedrock: Boolean
    )

    // Normalize original filename, fixing common non-UTF-8 cases seen with multipart uploads
    // - Octal-escaped UTF-8 bytes like \341\204\213...
    // - Percent-encoded sequences like %EC%97%B0...
    // - ISO-8859-1 mis-decoded bytes that actually are UTF-8
    private fun normalizeFilename(raw: String): String {
        if (raw.isEmpty()) return raw

        // 1) If looks like backslash-octal, decode to bytes then UTF-8
        fun decodeOctalIfPresent(s: String): String? {
            var i = 0
            var found = false
            val bytes = ArrayList<Byte>(s.length)
            while (i < s.length) {
                val ch = s[i]
                if (ch == '\\' && i + 3 < s.length) {
                    val a = s[i + 1]
                    val b = s[i + 2]
                    val c = s[i + 3]
                    if (a in '0'..'7' && b in '0'..'7' && c in '0'..'7') {
                        val oct = ((a.code - '0'.code) shl 6) or ((b.code - '0'.code) shl 3) or (c.code - '0'.code)
                        bytes.add(oct.toByte())
                        i += 4
                        found = true
                        continue
                    }
                }
                // Keep as single byte
                bytes.add((ch.code and 0xFF).toByte())
                i++
            }
            return if (found) try {
                bytes.toByteArray().toString(Charsets.UTF_8)
            } catch (_: Exception) { null } else null
        }

        var candidate = decodeOctalIfPresent(raw) ?: raw

        // 2) Percent-decoding if it looks URL-encoded
        if (candidate.contains('%')) {
            try {
                val decoded = URLDecoder.decode(candidate, Charsets.UTF_8.name())
                if (decoded.isNotBlank()) candidate = decoded
            } catch (_: Exception) { /* ignore */ }
        }

        // 3) If contains high bytes (>= 128), try to re-decode from ISO-8859-1 to UTF-8
        val hasHighBytes = candidate.any { it.code in 128..255 }
        if (hasHighBytes) {
            try {
                val bytes = candidate.map { (it.code and 0xFF).toByte() }.toByteArray()
                val utf8 = bytes.toString(Charsets.UTF_8)
                if (utf8.isNotBlank()) candidate = utf8
            } catch (_: Exception) { /* ignore */ }
        }

        // 4) Normalize Unicode to NFC so that visually identical Hangul compares equal
        return try {
            Normalizer.normalize(candidate, Normalizer.Form.NFC)
        } catch (_: Exception) {
            candidate
        }
    }

    private fun generateWithBedrock(
        prompt: String,
        context: String?,
        system: String?,
        maxTokens: Int,
        temperature: Double
    ): LocalGenerateResult {
        val userText = buildString {
            append(prompt.trim())
            if (!context.isNullOrBlank()) {
                append("\n\nContext:\n")
                append(context.trim())
            }
        }
        val body = mutableMapOf<String, Any?> (
            "anthropic_version" to "bedrock-2023-05-31",
            "max_tokens" to maxTokens,
            "messages" to listOf(
                mapOf(
                    "role" to "user",
                    "content" to listOf(
                        mapOf("type" to "text", "text" to userText)
                    )
                )
            ),
            "temperature" to temperature
        )
        if (!system.isNullOrBlank()) body["system"] = system

        val mapper = jacksonObjectMapper()
        val jsonBody = mapper.writeValueAsString(body)

        val client = BedrockRuntimeClient.builder()
            .region(Region.of(props.region))
            .credentialsProvider(DefaultCredentialsProvider.create())
            .build()

        val request = InvokeModelRequest.builder()
            .modelId(props.modelId)
            .contentType("application/json")
            .accept("application/json")
            .body(SdkBytes.fromUtf8String(jsonBody))
            .build()

        val responseText: String = try {
            val resp = client.invokeModel(request)
            resp.body().asUtf8String()
        } catch (e: Exception) {
            val fallback = buildString {
                append("[FALLBACK] Unable to reach Bedrock. Echoing prompt with summarized context.\n\n")
                append("Prompt: ")
                append(prompt.trim())
                if (!context.isNullOrBlank()) {
                    append("\nContext (truncated):\n")
                    append(context.take(2000))
                }
            }
            return LocalGenerateResult(fallback, usedBedrock = false)
        }

        val json = mapper.readTree(responseText)
        val output = json.path("content").path(0).path("text").asText("")
        val text = if (output.isBlank()) json.path("output_text").asText("") else output
        return LocalGenerateResult(text.trim(), usedBedrock = true)
    }

    fun processMultiple(
        files: List<MultipartFile>,
        prompt: String,
        passwords: Map<String, String> = emptyMap(),
        sheetNames: Map<String, List<String>> = emptyMap(),
        maxRowsPerSheet: Int = 200,
        maxColsPerRow: Int = 20
    ): MultiProcessResult {
        require(files.isNotEmpty()) { "files must not be empty" }
        require(prompt.isNotBlank()) { "prompt must not be blank" }

        val rows = mutableListOf<RowResult>()
        val ctx = StringBuilder()

        // Normalize map keys to the same canonical form (NFC + encoding fixes)
        fun <V> normalizeMapKeys(src: Map<String, V>): Map<String, V> = buildMap(src.size) {
            for ((k, v) in src) {
                put(normalizeFilename(k), v)
            }
        }
        val passwordsN = normalizeMapKeys(passwords)
        val sheetNamesN = normalizeMapKeys(sheetNames)

        for (file in files) {
            require(!file.isEmpty) { "one of files is empty" }
            val rawName = file.originalFilename ?: "file${rows.size}"
            val name = normalizeFilename(rawName)
            val password = passwordsN[name]

            file.inputStream.use { ins ->
                val wb: Workbook = try {
                    if (!password.isNullOrBlank()) WorkbookFactory.create(ins, password) else WorkbookFactory.create(ins)
                } catch (e: Exception) {
                    throw IllegalArgumentException("Failed to open workbook '${name}'. If it is password-protected, provide correct password.")
                }
                wb.use { workbook ->
                    val allowedSheets = sheetNamesN[name]?.toSet()
                    for (i in 0 until workbook.numberOfSheets) {
                        val sheet = workbook.getSheetAt(i) ?: continue
                        val sName = sheet.sheetName
                        if (allowedSheets != null && sName !in allowedSheets) continue

                        ctx.append("File: ").append(name).append('\n')
                            .append("Sheet: ").append(sName).append('\n')
                            .append("Data (TSV):\n")

                        val lastRow = min(sheet.lastRowNum, maxRowsPerSheet - 1)
                        for (r in 0..lastRow) {
                            val row = sheet.getRow(r) ?: continue
                            val lastCell = min((row.lastCellNum.toInt() - 1).coerceAtLeast(0), maxColsPerRow - 1)
                            val cells = mutableListOf<String>()
                            for (c in 0..lastCell) {
                                val cell = row.getCell(c)
                                val text = when (cell?.cellType) {
                                    CellType.STRING -> cell.stringCellValue
                                    CellType.NUMERIC -> cell.numericCellValue.toString()
                                    CellType.BOOLEAN -> cell.booleanCellValue.toString()
                                    CellType.FORMULA -> try { cell.stringCellValue } catch (_: Exception) { cell.numericCellValue.toString() }
                                    else -> cell?.toString() ?: ""
                                }
                                cells.add(text)
                            }
                            val line = cells.joinToString("\t")
                            rows.add(RowResult(name, sName, r, line))
                            ctx.append(line).append('\n')
                        }
                        ctx.append('\n')
                    }
                }
            }
        }

        val combinedContext = ctx.toString().take(200_000)
        val system = """
            You are a data linking assistant. You will be given multiple Excel worksheets converted to TSV lines.
            - Use only the provided data across files/sheets to satisfy the user's prompt.
            - When the user asks to join by a key and return values from connected rows, perform exact matching on the text values provided in the TSV.
            - Prefer returning a concise JSON structure where keys are the requested field values and values are the resulting fields.
            - If no match exists for a key, return the string "정보 없음" for that key.
            - If header rows appear to be present, infer headers from the first row of each sheet.
        """.trimIndent()

        val gen = generateWithBedrock(
            prompt = prompt,
            context = combinedContext,
            system = system,
            maxTokens = 1024,
            temperature = 0.2
        )

        val result = ProcessResult(
            scope = "ALL_FILES",
            rows = rows,
            outputText = gen.outputText
        )
        return MultiProcessResult(modelId = props.modelId, usedBedrock = gen.usedBedrock, usedApiKey = gen.usedBedrock, results = listOf(result))
    }
}


