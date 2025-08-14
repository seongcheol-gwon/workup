package com.musinsa.workup.controller

import com.musinsa.workup.model.PromptRecord
import com.musinsa.workup.repository.PromptRecordRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/prompt")
class PromptController(
    private val repo: PromptRecordRepository
) {
    data class SavePromptRequest(
        val prompt: String,
        val type: String? = null,
        val name: String? = null
    )

    @PostMapping("/save")
    fun savePrompt(@RequestBody req: SavePromptRequest): ResponseEntity<Any> {
        val cleaned = req.prompt.trim()
        if (cleaned.isEmpty()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "PROMPT_EMPTY"))
        }
        // Respect provided type (defaults to SHEET if omitted)
        val t = req.type?.trim()?.uppercase().takeUnless { it.isNullOrEmpty() } ?: "SHEET"
        val record = PromptRecord(prompt = cleaned, type = t, name = req.name?.trim()?.ifBlank { null })
        val saved = repo.save(record)
        return ResponseEntity.ok(mapOf(
            "id" to saved.id,
            "prompt" to saved.prompt,
            "type" to saved.type,
            "name" to saved.name,
            "createdAt" to saved.createdAt.toString()
        ))
    }

    @GetMapping("/list")
    fun listPrompts(@RequestParam(name = "type", required = false) type: String?): ResponseEntity<Any> {
        val all = repo.findAll()
            .filter { type.isNullOrBlank() || it.type.equals(type.trim(), ignoreCase = true) }
            .sortedByDescending { it.createdAt }
            .map { mapOf(
                "id" to it.id,
                "prompt" to it.prompt,
                "type" to it.type,
                "name" to it.name,
                "createdAt" to it.createdAt.toString()
            ) }
        return ResponseEntity.ok(all)
    }
}
