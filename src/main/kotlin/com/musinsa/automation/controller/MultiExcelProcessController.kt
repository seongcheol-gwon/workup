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
        @RequestPart("meta") metaJson: String
    ): ResponseEntity<MultiExcelProcessingService.MultiProcessResult> {
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
        return ResponseEntity.ok(result)
    }
}