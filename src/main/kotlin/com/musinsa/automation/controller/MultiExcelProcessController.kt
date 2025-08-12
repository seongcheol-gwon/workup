package com.musinsa.automation.controller

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.automation.service.MultiExcelProcessingService
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/excel")
class MultiExcelProcessController(
    private val service: MultiExcelProcessingService
) {
    data class MultiMeta(
        val passwords: Map<String, String>? = null, // key: originalFilename
        val sheetNames: Map<String, List<String>>? = null, // key: originalFilename, value: allowed sheets
        val maxRowsPerSheet: Int = 200,
        val maxColsPerRow: Int = 20
    )

    @PostMapping(
        "/process-multi",
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun processMulti(
        @RequestPart("files") files: List<MultipartFile>,
        @RequestPart("prompt") prompt: String,
        @RequestPart("meta") metaJson: String,
        @RequestParam(name = "mode", required = false, defaultValue = "detail") mode: String
    ): ResponseEntity<Any> {
        val mapper = jacksonObjectMapper()
        val meta = mapper.readValue(metaJson, MultiMeta::class.java)
        val result = service.processMultiple(
            files = files,
            prompt = prompt,
            passwords = meta.passwords ?: emptyMap(),
            sheetNames = meta.sheetNames ?: emptyMap(),
            maxRowsPerSheet = meta.maxRowsPerSheet,
            maxColsPerRow = meta.maxColsPerRow
        )
        if (mode.equals("json", ignoreCase = true)) {
            val json = extractJsonObjectOrArray(result.results.firstOrNull()?.outputText ?: "")
            return ResponseEntity.ok(json ?: mapOf("result" to (result.results.firstOrNull()?.outputText ?: "")))
        }
        return ResponseEntity.ok(result)
    }

    private fun extractJsonObjectOrArray(text: String): Any? {
        val mapper = jacksonObjectMapper()
        // Prefer fenced ```json blocks
        val fenceRegex = Regex("```json\\s*(.*?)```", RegexOption.DOT_MATCHES_ALL)
        val fence = fenceRegex.find(text)
        if (fence != null) {
            val snippet = fence.groupValues[1].trim()
            try { return mapper.readValue(snippet, Any::class.java) } catch (_: Exception) {}
        }
        // Try object {...}
        val objStart = text.indexOf('{')
        val objEnd = text.lastIndexOf('}')
        if (objStart >= 0 && objEnd > objStart) {
            val candidate = text.substring(objStart, objEnd + 1)
            try { return mapper.readValue(candidate, Any::class.java) } catch (_: Exception) {}
        }
        // Try array [...]
        val arrStart = text.indexOf('[')
        val arrEnd = text.lastIndexOf(']')
        if (arrStart >= 0 && arrEnd > arrStart) {
            val candidate = text.substring(arrStart, arrEnd + 1)
            try { return mapper.readValue(candidate, Any::class.java) } catch (_: Exception) {}
        }
        return null
    }

    @PostMapping(
        "/list-sheets",
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun listSheets(
        @RequestPart("file") file: MultipartFile,
        @RequestPart("password", required = false) password: String?
    ): ResponseEntity<Any> {
        try {
            // Try open without password if none provided
            val sheets = mutableListOf<String>()
            val workbook = try {
                if (password.isNullOrBlank()) {
                    try {
                        org.apache.poi.ss.usermodel.WorkbookFactory.create(file.inputStream)
                    } catch (e: org.apache.poi.EncryptedDocumentException) {
                        return ResponseEntity.ok(mapOf("sheets" to emptyList<String>(), "needsPassword" to true))
                    }
                } else {
                    org.apache.poi.ss.usermodel.WorkbookFactory.create(file.inputStream, password)
                }
            } catch (e: org.apache.poi.EncryptedDocumentException) {
                return ResponseEntity.badRequest().body(mapOf("error" to "PASSWORD_REQUIRED_OR_INVALID"))
            } catch (e: Exception) {
                return ResponseEntity.status(400).body(mapOf("error" to "FAILED_TO_OPEN", "message" to (e.message ?: "")))
            }

            workbook.use { wb ->
                for (i in 0 until wb.numberOfSheets) {
                    sheets.add(wb.getSheetName(i))
                }
            }
            return ResponseEntity.ok(mapOf("sheets" to sheets, "needsPassword" to false))
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf("error" to "FAILED_TO_LIST_SHEETS", "message" to (e.message ?: "")))
        }
    }
}