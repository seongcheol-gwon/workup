package com.musinsa.automation.model

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "prompt_records")
data class PromptRecord(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 4000)
    val prompt: String,

    @Column(nullable = false, length = 50)
    val type: String,

    @Column(nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
