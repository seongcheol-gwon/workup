package com.musinsa.workup.controller

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.workup.config.BedrockProperties
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest
import java.io.ByteArrayOutputStream
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlin.collections.get

@RestController
@RequestMapping("/api/json-to-sheet")
class JsonToSheetController(
    private val props: BedrockProperties
) {
    data class JsonToSheetRequest(
        val json: String,
        val prompt: String,
        val sheetName: String? = null,
        val maxTokens: Int? = 1024,
        val temperature: Double? = 0.2
    )

    @PostMapping(
        consumes = [MediaType.APPLICATION_JSON_VALUE],
        produces = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    )
    fun generate(@RequestBody req: JsonToSheetRequest): ResponseEntity<ByteArray> {
        val inputJson = req.json.trim()
        val userPrompt = req.prompt.trim()
        require(inputJson.isNotBlank()) { "json must not be blank" }
        require(userPrompt.isNotBlank()) { "prompt must not be blank" }

        val system = "You transform JSON into a well-structured tabular dataset suitable for Excel."
        val instruction = buildString {
            append("Given the JSON in the Context, transform it into a flat table.")
            append(" Return output ONLY as JSON array of objects (no extra prose).")
            append(" Each object represents a row and shares a consistent set of keys as columns.")
            append(" Avoid nesting: flatten nested structures using dot.notation if needed.")
            append(" Include headers derived from keys.")
            append(" If the data is a single object, wrap as an array with one element.")
            append(" Preserve important fields; infer reasonable columns if necessary.\n\n")
            append("User instruction: \n")
            append(userPrompt)
        }

        val userText = buildString {
            append(instruction)
            append("\n\nContext (JSON):\n")
            append(inputJson)
        }

        val body = mutableMapOf<String, Any?>(
            "anthropic_version" to "bedrock-2023-05-31",
            "max_tokens" to (req.maxTokens ?: 1024),
            "temperature" to (req.temperature ?: 0.2),
            "messages" to listOf(
                mapOf(
                    "role" to "user",
                    "content" to listOf(
                        mapOf("type" to "text", "text" to userText)
                    )
                )
            )
        )
        body["system"] = system

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
            // Fallback: try to interpret the input JSON directly into a sheet without Bedrock
            return buildExcelFromJsonText(inputJson, req.sheetName)
        }

        val root = mapper.readTree(responseText)
        val outputText = root.path("content").path(0).path("text").asText(
            root.path("output_text").asText("")
        ).trim()
        if (outputText.isBlank()) {
            // Safety fallback
            return buildExcelFromJsonText(inputJson, req.sheetName)
        }

        // Try to extract JSON object/array from the model's text
        val extracted = extractJsonObjectOrArray(outputText) ?: extractJsonObjectOrArray(inputJson)
        val excelBytes = buildExcelBytes(extracted)
        val filename = (req.sheetName?.ifBlank { null } ?: "json_to_sheet") + ".xlsx"
        val disposition = contentDisposition(filename)
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(excelBytes)
    }

    private fun contentDisposition(filename: String): String {
        val encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20")
        return "attachment; filename=\"$filename\"; filename*=UTF-8''$encoded"
    }

    private fun buildExcelFromJsonText(jsonText: String, sheetName: String?): ResponseEntity<ByteArray> {
        val extracted = extractJsonObjectOrArray(jsonText)
        val bytes = buildExcelBytes(extracted)
        val filename = (sheetName?.ifBlank { null } ?: "json_to_sheet") + ".xlsx"
        val disposition = contentDisposition(filename)
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(bytes)
    }

    private fun extractJsonObjectOrArray(text: String): Any? {
        val mapper = jacksonObjectMapper()
        // Prefer fenced ```json blocks
        val fenceRegex = Regex("```json\\s*(.*?)```", RegexOption.DOT_MATCHES_ALL)
        val fence = fenceRegex.find(text)
        if (fence != null) {
            val snippet = fence.groupValues[1].trim()
            try {
                val parsed: Any = mapper.readValue(snippet, Any::class.java)
                return normalizeToTabular(parsed)
            } catch (_: Exception) {}
        }
        // Prefer array [...] first
        val arrStart = text.indexOf('[')
        val arrEnd = text.lastIndexOf(']')
        if (arrStart >= 0 && arrEnd > arrStart) {
            val candidate = text.substring(arrStart, arrEnd + 1)
            try {
                val parsed: Any = mapper.readValue(candidate, Any::class.java)
                return normalizeToTabular(parsed)
            } catch (_: Exception) {}
        }
        // Then try object {...}
        val objStart = text.indexOf('{')
        val objEnd = text.lastIndexOf('}')
        if (objStart >= 0 && objEnd > objStart) {
            val candidate = text.substring(objStart, objEnd + 1)
            try {
                val parsed: Any = mapper.readValue(candidate, Any::class.java)
                return normalizeToTabular(parsed)
            } catch (_: Exception) {}
        }
        return null
    }

    // If the parsed value is an object that contains an array under a common key (e.g., data/items/results),
    // extract that array to maximize row coverage.
    private fun normalizeToTabular(parsed: Any?): Any? {
        if (parsed is Map<*, *>) {
            // Heuristics: prefer keys that commonly hold collections
            val candidateKeys = listOf("data", "items", "rows", "list", "results", "values")
            for (k in candidateKeys) {
                val v = parsed[k]
                if (v is List<*>) return v
            }
            // Otherwise, if any value in map is a list, take the first list encountered
            val firstList = parsed.values.firstOrNull { it is List<*> }
            if (firstList is List<*>) return firstList
        }
        return parsed
    }

    private fun buildExcelBytes(data: Any?): ByteArray {
        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Sheet1")

        fun writeRows(rows: List<Map<String, Any?>>) {
            // Determine headers as union of keys preserving insertion order of first row
            val headers = LinkedHashSet<String>()
            if (rows.isNotEmpty()) {
                rows.first().keys.forEach { headers.add(it) }
                rows.drop(1).forEach { row -> row.keys.forEach { headers.add(it) } }
            }
            val headerList = headers.toList()
            var r = 0
            // header
            val headerRow = sheet.createRow(r++)
            headerList.forEachIndexed { c, h -> headerRow.createCell(c).setCellValue(h) }
            // rows
            for (row in rows) {
                val rr = sheet.createRow(r++)
                headerList.forEachIndexed { c, h ->
                    val v = row[h]
                    when (v) {
                        null -> rr.createCell(c).setCellValue("")
                        is Number -> rr.createCell(c).setCellValue(v.toDouble())
                        is Boolean -> rr.createCell(c).setCellValue(v)
                        else -> rr.createCell(c).setCellValue(v.toString())
                    }
                }
            }
            // autosize
            headerList.indices.forEach { sheet.autoSizeColumn(it) }
        }

        when (data) {
            is List<*> -> {
                // If list of objects, tabulate by keys. If primitives, put under single column "value".
                val maps = data.mapNotNull { it as? Map<*, *> }
                if (maps.isNotEmpty()) {
                    val rows = maps.map { m -> m.entries.associate { (k, v) -> k.toString() to v } }
                    writeRows(rows)
                } else {
                    val rows = data.map { v -> mapOf("value" to v) }
                    writeRows(rows)
                }
            }
            is Map<*, *> -> {
                // Single object -> one row
                val row = data.entries.associate { (k, v) -> k.toString() to v }
                writeRows(listOf(row))
            }
            else -> {
                // Unknown -> put raw text
                val row = sheet.createRow(0)
                row.createCell(0).setCellValue(data?.toString() ?: "")
            }
        }

        return workbook.use {
            val bos = ByteArrayOutputStream()
            it.write(bos)
            bos.toByteArray()
        }
    }
}
