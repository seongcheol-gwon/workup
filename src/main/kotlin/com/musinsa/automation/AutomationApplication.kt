package com.musinsa.automation

import com.musinsa.automation.config.BedrockProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(BedrockProperties::class)
class AutomationApplication

fun main(args: Array<String>) {
    runApplication<AutomationApplication>(*args)
}
