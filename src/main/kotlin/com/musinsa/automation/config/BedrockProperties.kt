package com.musinsa.automation.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.bind.DefaultValue

@ConfigurationProperties(prefix = "bedrock")
data class BedrockProperties(
    @DefaultValue("") val apiKey: String,
    @DefaultValue("us-east-1") val region: String,
    // e.g., anthropic.claude-3-haiku-20240307-v1:0
    @DefaultValue("anthropic.claude-3-haiku-20240307-v1:0") val modelId: String
)
