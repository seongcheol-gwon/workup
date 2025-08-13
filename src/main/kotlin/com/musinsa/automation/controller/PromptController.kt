package com.musinsa.automation.controller

import com.musinsa.automation.model.PromptRecord
import com.musinsa.automation.repository.PromptRecordRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/prompt")
class PromptController(
    private val repo: PromptRecordRepository
) {
    data class SavePromptRequest(
        val prompt: String,
        val type: String? = null
    )

    @PostMapping("/save")
    fun savePrompt(@RequestBody req: SavePromptRequest): ResponseEntity<Any> {
        val cleaned = req.prompt.trim()
        if (cleaned.isEmpty()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "PROMPT_EMPTY"))
        }
        // Respect provided type (defaults to SHEET if omitted)
        val t = req.type?.trim()?.uppercase().takeUnless { it.isNullOrEmpty() } ?: "SHEET"
        val record = PromptRecord(prompt = cleaned, type = t)
        val saved = repo.save(record)
        return ResponseEntity.ok(mapOf(
            "id" to saved.id,
            "prompt" to saved.prompt,
            "type" to saved.type,
            "createdAt" to saved.createdAt.toString()
        ))
    }
}
