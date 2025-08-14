package com.musinsa.workup.controller

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.workup.service.MultiExcelProcessingService
import org.apache.poi.EncryptedDocumentException
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.WorkbookFactory
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
        val sheetNames: Map<String, List<String>>? = null // key: originalFilename, value: allowed sheets
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
            sheetNames = meta.sheetNames ?: emptyMap()
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
                        WorkbookFactory.create(file.inputStream)
                    } catch (e: EncryptedDocumentException) {
                        return ResponseEntity.ok(mapOf("sheets" to emptyList<String>(), "needsPassword" to true))
                    }
                } else {
                    WorkbookFactory.create(file.inputStream, password)
                }
            } catch (e: EncryptedDocumentException) {
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

    @PostMapping(
        "/list-sheet-info",
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun listSheetInfo(
        @RequestPart("file") file: MultipartFile,
        @RequestPart("password", required = false) password: String?
    ): ResponseEntity<Any> {
        try {
            val workbook = try {
                if (password.isNullOrBlank()) {
                    try {
                        WorkbookFactory.create(file.inputStream)
                    } catch (e: EncryptedDocumentException) {
                        return ResponseEntity.ok(mapOf("sheets" to emptyList<String>(), "columnsBySheet" to emptyMap<String, List<String>>(), "needsPassword" to true))
                    }
                } else {
                    WorkbookFactory.create(file.inputStream, password)
                }
            } catch (e: EncryptedDocumentException) {
                return ResponseEntity.badRequest().body(mapOf("error" to "PASSWORD_REQUIRED_OR_INVALID"))
            } catch (e: Exception) {
                return ResponseEntity.status(400).body(mapOf("error" to "FAILED_TO_OPEN", "message" to (e.message ?: "")))
            }

            val sheets = mutableListOf<String>()
            val columnsBySheet = mutableMapOf<String, List<String>>()
            workbook.use { wb ->
                for (i in 0 until wb.numberOfSheets) {
                    val name = wb.getSheetName(i)
                    sheets.add(name)
                    val sheet = wb.getSheetAt(i)
                    val headerRow = sheet.getRow(sheet.firstRowNum)
                    if (headerRow != null) {
                        val lastCell = headerRow.lastCellNum.toInt()
                        val headers = mutableListOf<String>()
                        for (c in 0 until lastCell) {
                            val cell = headerRow.getCell(c)
                            val value = when (cell?.cellType) {
                                CellType.STRING -> cell.stringCellValue
                                CellType.NUMERIC -> cell.numericCellValue.toString()
                                CellType.BOOLEAN -> cell.booleanCellValue.toString()
                                CellType.FORMULA -> cell.toString()
                                else -> cell?.toString() ?: ""
                            }
                            val trimmed = value.trim()
                            if (trimmed.isNotEmpty()) headers.add(trimmed)
                        }
                        columnsBySheet[name] = headers
                    } else {
                        columnsBySheet[name] = emptyList()
                    }
                }
            }
            return ResponseEntity.ok(mapOf("sheets" to sheets, "columnsBySheet" to columnsBySheet, "needsPassword" to false))
        } catch (e: Exception) {
            return ResponseEntity.status(500).body(mapOf("error" to "FAILED_TO_LIST_SHEET_INFO", "message" to (e.message ?: "")))
        }
    }
}