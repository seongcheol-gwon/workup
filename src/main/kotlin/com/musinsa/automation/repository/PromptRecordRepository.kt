package com.musinsa.automation.repository

import com.musinsa.automation.model.PromptRecord
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface PromptRecordRepository : JpaRepository<PromptRecord, Long>
