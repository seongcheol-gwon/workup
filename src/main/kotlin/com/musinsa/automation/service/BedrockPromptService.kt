package com.musinsa.automation.service

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.automation.config.BedrockProperties
import org.springframework.stereotype.Service
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest

@Service
class BedrockPromptService(
    private val props: BedrockProperties
) {
    private val mapper = jacksonObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL)

    data class CustomizeRequest(
        val prompt: String,
        val instructions: String? = null,
        val maxTokens: Int? = 512
    )

    data class CustomizeResult(
        val optimizedPrompt: String,
        val modelId: String,
        val usedApiKey: Boolean
    )

    fun customize(req: CustomizeRequest): CustomizeResult {
        require(req.prompt.isNotBlank()) { "prompt must not be blank" }

        val system = "You are a prompt engineering assistant. Improve the provided prompt to be unambiguous, actionable, and optimized for LLMs. Keep the same intent."
        val userText = buildString {
            append("Please optimize this prompt. If needed, restructure into steps and clarify inputs and outputs.\n\n")
            append("Prompt: \n")
            append(req.prompt.trim())
            if (!req.instructions.isNullOrBlank()) {
                append("\n\nExtra instructions: ")
                append(req.instructions.trim())
            }
            append("\n\nReturn only the optimized prompt text.")
        }

        val requestBody = mapOf(
            "anthropic_version" to "bedrock-2023-05-31",
            "max_tokens" to (req.maxTokens ?: 512),
            "system" to system,
            "messages" to listOf(
                mapOf(
                    "role" to "user",
                    "content" to listOf(
                        mapOf("type" to "text", "text" to userText)
                    )
                )
            )
        )

        val jsonBody = mapper.writeValueAsString(requestBody)

        // Build Bedrock Runtime client (SigV4 signing via default credentials provider)
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
            // If credentials are missing or call fails, provide a safe local fallback
            val optimized = buildString {
                append("You are an expert assistant. Rewrite the user prompt to be clear, specific, and goal-oriented.\n")
                append("Constraints: respond concisely and include explicit success criteria.\n")
                append("User Prompt: \n")
                append(req.prompt.trim())
                if (!req.instructions.isNullOrBlank()) {
                    append("\nAdditional Instructions: ")
                    append(req.instructions.trim())
                }
            }
            return CustomizeResult(optimized, props.modelId, usedApiKey = false)
        }

        val json: JsonNode = mapper.readTree(responseText)
        val optimized = json.path("content").path(0).path("text").asText("")
        if (optimized.isBlank()) {
            val alt = json.path("output_text").asText("")
            if (alt.isNotBlank()) {
                return CustomizeResult(alt, props.modelId, usedApiKey = false)
            }
            return CustomizeResult(req.prompt.trim(), props.modelId, usedApiKey = false)
        }
        return CustomizeResult(optimized.trim(), props.modelId, usedApiKey = false)
    }
}
