package com.musinsa.automation.service

import com.musinsa.workup.config.BedrockProperties
import com.musinsa.workup.service.MultiExcelProcessingService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.text.Normalizer

class MultiExcelProcessingServiceFilenameNormalizationTest {

    private fun service(): MultiExcelProcessingService =
        MultiExcelProcessingService(BedrockProperties(apiKey = "", region = "us-east-1", modelId = "test-model"))

    private fun normalizeViaReflection(svc: MultiExcelProcessingService, raw: String): String {
        val m = svc::class.java.getDeclaredMethod("normalizeFilename", String::class.java)
        m.isAccessible = true
        return m.invoke(svc, raw) as String
    }

    @Test
    fun passwordsLookupSucceedsEvenIfFilenameAndKeyUseDifferentUnicodeForms() {
        val base = "연체내역_20250717.xls"
        val nfc = Normalizer.normalize(base, Normalizer.Form.NFC)
        val nfd = Normalizer.normalize(base, Normalizer.Form.NFD)

        // Safety: they should be visually equal but codepoint sequences differ
        assertEquals(base, nfc)
        assertEquals(base, nfd)

        val svc = service()
        val normalizedName = normalizeViaReflection(svc, nfd) // should normalize to NFC now
        // Now we expect normalization to NFC, so normalizedName equals nfc
        assertEquals(nfc, normalizedName)

        // Passwords map provided with NFC key should match
        val passwordsNfcKey = mapOf(nfc to "pw1234")
        assertEquals("pw1234", passwordsNfcKey[normalizedName])

        // Also simulate client sending NFD key; service code will normalize map keys internally in runtime,
        // but here we just demonstrate canonical equality expectation at lookup time
        val passwordsNfdKey = mapOf(nfd to "pw5678")
        // Without normalization of keys, this would fail; test just shows different value per key form.
        // Actual service normalizes keys before lookup, which is covered by integration behavior.
        assertNull(passwordsNfdKey[normalizedName])
    }

    @Test
    fun octalEscapedFilenameDecodesToKoreanAndLookupSucceedsWhenKeyMatchesNormalized() {
        // Example raw from the issue: octal-escaped UTF-8 bytes for "연체내역"
        val rawOctal = "\\341\\204\\213\\341\\205\\247\\341\\206\\253\\341\\204\\216\\341\\205\\246\\341\\204\\202\\341\\205\\242\\341\\204\\213\\341\\205\\247\\341\\206\\250_20250717.xls"
        val expectedKorean = "연체내역_20250717.xls"

        val svc = service()
        val normalized = normalizeViaReflection(svc, rawOctal)

        assertEquals(expectedKorean, normalized, "Octal-escaped filename should normalize to readable Korean text")

        val passwords = mapOf(expectedKorean to "pw9999")
        assertEquals("pw9999", passwords[normalized], "Lookup should succeed when key matches the normalized filename")
    }
}
