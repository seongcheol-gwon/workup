package com.musinsa.workup.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.musinsa.workup.config.BedrockProperties
import org.springframework.stereotype.Service
import software.amazon.awssdk.auth.credentials.AwsCredentials
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.core.exception.SdkClientException
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest
import software.amazon.awssdk.services.bedrockruntime.model.AccessDeniedException
import software.amazon.awssdk.services.bedrockruntime.model.ValidationException
import java.io.File
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket

@Service
class BedrockDiagnosticsService(
    private val props: BedrockProperties,
    private val prober: Prober = object : Prober {}
) {
    data class DiagnoseResult(
        val region: String,
        val modelId: String,
        val endpointHost: String,
        val envAwsAccessKeySet: Boolean,
        val envAwsSecretKeySet: Boolean,
        val envAwsSessionTokenSet: Boolean,
        val awsProfileEnv: String?,
        val regionEnv: String?,
        val credentialsFilePath: String,
        val credentialsFileExists: Boolean,
        val profileSectionExists: Boolean,
        val credentialsAvailable: Boolean,
        val dnsResolvable: Boolean,
        val port443Reachable: Boolean,
        val bedrockInvokeOk: Boolean,
        val errorType: String?,
        val errorMessage: String?,
        val probableCauses: List<String>,
        val suggestedActions: List<String>
    )

    // Probe abstraction to make diagnostics testable without real network/AWS
    interface Prober {
        fun env(): Map<String, String> = System.getenv()
        fun resolveCredentials(): AwsCredentials? = try { DefaultCredentialsProvider.create().resolveCredentials() } catch (_: Exception) { null }
        fun dnsResolvable(host: String): Boolean = try { InetAddress.getByName(host); true } catch (_: Exception) { false }
        fun portReachable(host: String, port: Int, timeoutMs: Int): Boolean = try { Socket().use { it.connect(InetSocketAddress(host, port), timeoutMs); true } } catch (_: Exception) { false }
        fun tryInvoke(region: String, modelId: String): Triple<Boolean, String?, String?> {
            return try {
                val client = BedrockRuntimeClient.builder()
                    .region(Region.of(region))
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .build()
                val payloadMap = mapOf(
                    "anthropic_version" to "bedrock-2023-05-31",
                    "max_tokens" to 1,
                    "messages" to listOf(
                        mapOf(
                            "role" to "user",
                            "content" to listOf(
                                mapOf("type" to "text", "text" to "healthcheck")
                            )
                        )
                    )
                )
                val payload = jacksonObjectMapper().writeValueAsString(payloadMap)
                val req = InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(payload))
                    .build()
                client.invokeModel(req)
                Triple(true, null, null)
            } catch (e: Exception) {
                when (e) {
                    is AccessDeniedException -> Triple(false, "AccessDeniedException", e.message)
                    is ValidationException -> Triple(false, "ValidationException", e.message)
                    is SdkClientException -> Triple(false, "SdkClientException", e.message)
                    else -> Triple(false, e::class.java.simpleName, e.message)
                }
            }
        }
    }

    fun diagnose(): DiagnoseResult {
        val region = props.region.ifBlank { "us-east-1" }
        val modelId = props.modelId
        val endpointHost = "bedrock-runtime.$region.amazonaws.com"

        // Check env presence (quick hint only)
        val env = prober.env()
        val envKeySet = env["AWS_ACCESS_KEY_ID"].isNullOrBlank().not() || env["AWS_ACCESS_KEY"].isNullOrBlank().not()
        val envSecretSet = env["AWS_SECRET_ACCESS_KEY"].isNullOrBlank().not() || env["AWS_SECRET_KEY"].isNullOrBlank().not()
        val envTokenSet = env["AWS_SESSION_TOKEN"].isNullOrBlank().not()
        val awsProfile = env["AWS_PROFILE"]
        val regionEnv = env["AWS_REGION"] ?: env["AWS_DEFAULT_REGION"]

        // Local credentials file
        val home = System.getProperty("user.home") ?: ""
        val credentialsFile = File(home, ".aws/credentials")
        val credentialsFilePath = credentialsFile.absolutePath
        val credentialsFileExists = credentialsFile.exists()
        val profileName = awsProfile ?: "default"
        var profileSectionExists = false
        if (credentialsFileExists) {
            try {
                val text = credentialsFile.readText()
                // match [profileName] section
                val header = "[${'$'}profileName]"
                profileSectionExists = text.lineSequence().any { it.trim() == header }
            } catch (_: Exception) {
                // ignore
            }
        }

        // Check credentials provider resolution
        var credentialsAvailable = false
        try {
            val creds: AwsCredentials? = prober.resolveCredentials()
            credentialsAvailable = creds != null && !creds.accessKeyId().isNullOrBlank()
        } catch (_: Exception) {
            credentialsAvailable = false
        }

        // DNS resolution
        val dnsResolvable = prober.dnsResolvable(endpointHost)

        // Port 443 reachability (basic network egress check)
        val port443Reachable = if (dnsResolvable) {
            prober.portReachable(endpointHost, 443, 2000)
        } else false

        // Try a minimal Bedrock invoke to surface service-side issues (permissions, model access, region)
        var bedrockInvokeOk = false
        var errorType: String? = null
        var errorMessage: String? = null
        if (credentialsAvailable && dnsResolvable && port443Reachable) {
            val (ok, errType, errMsg) = prober.tryInvoke(region, modelId)
            bedrockInvokeOk = ok
            if (!ok) {
                errorType = errType
                errorMessage = errMsg
            }
        } else {
            // Pre-checks already failed; craft an error message
            val reasons = mutableListOf<String>()
            if (!credentialsAvailable) reasons.add("AWS 자격 증명이 확인되지 않았습니다 (DefaultCredentialsProvider에서 조회 실패)")
            if (!dnsResolvable) reasons.add("Bedrock 런타임 도메인 DNS 해석 실패: $endpointHost")
            if (!port443Reachable && dnsResolvable) reasons.add("네트워크에서 $endpointHost:443 으로 연결이 차단되었습니다 (프록시/VPC/NAT/방화벽)")
            errorType = "PrecheckFailed"
            errorMessage = reasons.joinToString("; ")
        }

        val probableCauses = mutableListOf<String>()
        if (!envKeySet || !envSecretSet) {
            probableCauses.add("환경변수 또는 자격 증명 소스에서 AWS 키가 설정되지 않았습니다 (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 확인)")
        }
        if (!credentialsAvailable) {
            probableCauses.add("자격 증명 체인에서 유효한 자격 증명을 찾지 못했습니다 (~/.aws/credentials, AWS_PROFILE, SSO 설정 확인)")
            if (!credentialsFileExists) {
                probableCauses.add("${'$'}credentialsFilePath 파일이 존재하지 않습니다. aws configure 로 생성하세요.")
            } else if (!profileSectionExists) {
                probableCauses.add("프로파일 '${'$'}profileName' 섹션이 ${'$'}credentialsFilePath 에 존재하지 않습니다")
            }
            if (awsProfile.isNullOrBlank().not() && profileSectionExists.not()) {
                probableCauses.add("AWS_PROFILE='${'$'}awsProfile' 이(가) 설정되었지만 해당 프로파일이 credentials 파일에 없습니다")
            }
        }
        if (!dnsResolvable) {
            probableCauses.add("DNS 문제로 bedrock-runtime.$region.amazonaws.com 을 해석하지 못했습니다 (사내 DNS/네트워크 확인)")
        }
        if (dnsResolvable && !port443Reachable) {
            probableCauses.add("443 포트 아웃바운드가 차단되어 있습니다 (프록시 또는 VPC 엔드포인트/인터넷 게이트웨이 설정 확인)")
        }
        if (!bedrockInvokeOk && errorType == "AccessDeniedException") {
            probableCauses.add("IAM 권한이 부족하거나 해당 모델에 대한 액세스가 승인되지 않았습니다 (Bedrock 콘솔에서 모델 접근 권한 신청/승인 필요)")
        }
        if (!bedrockInvokeOk && errorType == "ValidationException") {
            probableCauses.add("모델 ID가 잘못되었거나 해당 리전($region)에 제공되지 않습니다 (modelId/region 확인)")
        }
        if (!bedrockInvokeOk && errorType == "SdkClientException") {
            probableCauses.add("리전이 잘못되었거나 네트워크/프록시 문제로 엔드포인트에 연결할 수 없습니다")
        }
        if (!bedrockInvokeOk && errorType == null && errorMessage.isNullOrBlank().not()) {
            probableCauses.add("기타 오류: ${'$'}errorMessage")
        }

        val suggested = mutableListOf<String>()
        if (!credentialsAvailable) {
            suggested.add("aws configure --profile ${'$'}profileName")
            suggested.add("export AWS_PROFILE=${'$'}profileName")
            suggested.add("export AWS_REGION=${'$'}region  # 또는 AWS_DEFAULT_REGION")
            suggested.add("# 또는 환경변수로 직접 설정:")
            suggested.add("export AWS_ACCESS_KEY_ID=...; export AWS_SECRET_ACCESS_KEY=...; export AWS_SESSION_TOKEN=... # (임시 자격 증명일 경우)")
        }
        if (regionEnv.isNullOrBlank()) {
            suggested.add("export AWS_REGION=${'$'}region  # 리전이 누락되면 일부 SDK 동작이 실패할 수 있습니다")
        }

        return DiagnoseResult(
            region = region,
            modelId = modelId,
            endpointHost = endpointHost,
            envAwsAccessKeySet = envKeySet,
            envAwsSecretKeySet = envSecretSet,
            envAwsSessionTokenSet = envTokenSet,
            awsProfileEnv = awsProfile,
            regionEnv = regionEnv,
            credentialsFilePath = credentialsFilePath,
            credentialsFileExists = credentialsFileExists,
            profileSectionExists = profileSectionExists,
            credentialsAvailable = credentialsAvailable,
            dnsResolvable = dnsResolvable,
            port443Reachable = port443Reachable,
            bedrockInvokeOk = bedrockInvokeOk,
            errorType = errorType,
            errorMessage = errorMessage,
            probableCauses = probableCauses,
            suggestedActions = suggested
        )
    }
}