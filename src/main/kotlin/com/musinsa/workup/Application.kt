package com.musinsa.workup

import com.musinsa.workup.config.BedrockProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(BedrockProperties::class)
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
