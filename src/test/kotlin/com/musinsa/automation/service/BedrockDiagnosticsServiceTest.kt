package com.musinsa.automation.service

import com.musinsa.automation.config.BedrockProperties
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import software.amazon.awssdk.auth.credentials.AwsCredentials

class BedrockDiagnosticsServiceTest {

    private class FakeProber(
        private val envMap: Map<String, String> = emptyMap(),
        private val creds: AwsCredentials? = null,
        private val dnsOk: Boolean = true,
        private val portOk: Boolean = true,
        private val invokeOk: Boolean = true,
        private val invokeErrorType: String? = null,
        private val invokeErrorMessage: String? = null
    ) : BedrockDiagnosticsService.Prober {
        override fun env(): Map<String, String> = envMap
        override fun resolveCredentials(): AwsCredentials? = creds
        override fun dnsResolvable(host: String): Boolean = dnsOk
        override fun portReachable(host: String, port: Int, timeoutMs: Int): Boolean = portOk
        override fun tryInvoke(region: String, modelId: String): Triple<Boolean, String?, String?> =
            Triple(invokeOk, invokeErrorType, invokeErrorMessage)
    }

    @Test
    fun diagnose_reports_missing_credentials_with_precheck_failed_and_korean_message() {
        val props = BedrockProperties(
            apiKey = "ABSKQmVkcm9ja0FQSUtleS0wcmJuLWF0LTU2Njg2OTM4OTE3MjoxeVFyNVBVT2lLT2tVL1dibGlFRGtXdFZvc1hWYVlzNHo1cEZ0QUw4OTMxekppeG9CczJHb1hhK3ZMTT0=",
            region = "us-east-1",
            modelId = "anthropic.claude-3-5-sonnet-20240620-v1:0")
        val service = BedrockDiagnosticsService(
            props,
            FakeProber(
                envMap = emptyMap(),
                creds = null, // simulate no credentials
                dnsOk = true,
                portOk = true
            )
        )
        val result = service.diagnose()

        assertEquals("PrecheckFailed", result.errorType)
    }
}
