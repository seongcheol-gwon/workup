package com.musinsa.workup.controller

import com.musinsa.workup.service.BedrockPromptService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/bedrock/prompt")
class BedrockPromptController(
    private val service: BedrockPromptService
) {

    data class CustomizeResponse(
        val optimizedPrompt: String,
        val modelId: String,
        val usedApiKey: Boolean
    )

    @PostMapping("/customize")
    fun customize(@RequestBody req: BedrockPromptService.CustomizeRequest): ResponseEntity<CustomizeResponse> {
        val result = service.customize(req)
        return ResponseEntity.ok(CustomizeResponse(result.optimizedPrompt, result.modelId, result.usedApiKey))
    }
}
