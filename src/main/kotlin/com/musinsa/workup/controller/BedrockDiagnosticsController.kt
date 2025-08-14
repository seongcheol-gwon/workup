package com.musinsa.workup.controller

import com.musinsa.workup.service.BedrockDiagnosticsService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/bedrock/diagnostics")
class BedrockDiagnosticsController(
    private val service: BedrockDiagnosticsService
) {
    @GetMapping
    fun diagnose(): ResponseEntity<BedrockDiagnosticsService.DiagnoseResult> {
        val result = service.diagnose()
        return ResponseEntity.ok(result)
    }
}