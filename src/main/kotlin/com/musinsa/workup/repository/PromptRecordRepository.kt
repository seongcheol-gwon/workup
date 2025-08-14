package com.musinsa.workup.repository

import com.musinsa.workup.model.PromptRecord
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface PromptRecordRepository : JpaRepository<PromptRecord, Long>
