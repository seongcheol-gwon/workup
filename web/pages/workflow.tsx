import React, { useEffect, useMemo, useRef, useState } from 'react'
import Layout from '../src/components/Layout'
import PageTitle from '../src/components/PageTitle'
import { gql, useLazyQuery, useMutation } from '@apollo/client'
import * as XLSX from 'xlsx'
import { Alert, Button, Card, Col, Collapse, Divider, Input, List, Modal, Radio, Row, Select, Space, Spin, Table, Tag, Typography, Upload, message } from 'antd'
import { InboxOutlined, PlayCircleOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, PlusOutlined, ReloadOutlined, FileExcelOutlined, FileTextOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'

const LIST_PROMPTS = gql`
  query ListPrompts($type: String) {
    listPrompts(type: $type)
  }
`

const PROCESS_EXCEL = gql`
  mutation ProcessExcel($files: [Upload!]!, $prompt: String!, $meta: JSON, $mode: String) {
    processExcel(files: $files, prompt: $prompt, meta: $meta, mode: $mode)
  }
`

const LIST_SHEET_INFO = gql`
  mutation ListSheetInfo($file: Upload!, $password: String) {
    listSheetInfo(file: $file, password: $password)
  }
`

// TYPES
 type PromptItem = { id: number; prompt: string; type: string; createdAt: string; name?: string }
 type Step = { id?: number; type: 'SHEET' | 'JSONTOSHEET'; prompt: string; name?: string; config?: any; status?: 'idle'|'running'|'done'|'error'; inputPreview?: string; output?: any; error?: string; collapsed?: boolean }
 type FileItem = { file: File; password?: string; availableSheets?: string[]; selectedSheets?: string[]; needsPassword?: boolean; passwordVerified?: boolean; columnsBySheet?: Record<string, string[]> }

export default function WorkflowPage() {
  const [selectedType, setSelectedType] = useState<'SHEET'|'JSONTOSHEET'>('SHEET')
  const [steps, setSteps] = useState<Step[]>([])
  // Hidden file input ref for adding SHEET files from the list's "+" item
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fetchPrompts, { data: promptsData, loading: promptsLoading, error: promptsError }] = useLazyQuery(LIST_PROMPTS, {
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  })
  const [runExcel] = useMutation(PROCESS_EXCEL)
  const [fetchSheetInfo] = useMutation(LIST_SHEET_INFO)

  useEffect(() => { fetchPrompts({ variables: { type: selectedType } }) }, [selectedType, fetchPrompts])

  const prompts: PromptItem[] = useMemo(() => (promptsData?.listPrompts || []) as PromptItem[], [promptsData])

  // SHEET helpers
  const [sheetMode] = useState<'detail'|'json'>('json')
  const [sheetItems, setSheetItems] = useState<FileItem[]>([])

  const parseSheetsInfo = async (file: File, password?: string): Promise<{ sheets: string[]; needsPassword: boolean; columnsBySheet?: Record<string, string[]> }> => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', password })
      const sheets = wb.SheetNames || []
      const columnsBySheet: Record<string, string[]> = {}
      for (const sn of sheets) {
        const ws = wb.Sheets[sn]
        if (!ws) continue
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any
        const header = (rows?.[0] || []).map((v) => (v == null ? '' : String(v))).filter((v) => v && v.trim().length > 0)
        columnsBySheet[sn] = header
      }
      return { sheets, needsPassword: false, columnsBySheet }
    } catch {
      return { sheets: [], needsPassword: true }
    }
  }

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    const existingNames = new Set(sheetItems.map((p) => p.file.name))
    const dedup = files.filter((f) => !existingNames.has(f.name))
    if (dedup.length > 0) {
      setSheetItems((prev) => [
        ...prev,
        ...dedup.map((f) => ({ file: f, availableSheets: undefined, selectedSheets: [], needsPassword: false, passwordVerified: false })),
      ])
      for (const f of dedup) {
        const info = await parseSheetsInfo(f)
        setSheetItems((prev) => prev.map((it) => it.file.name === f.name ? {
          ...it,
          availableSheets: info.sheets,
          needsPassword: info.needsPassword,
          passwordVerified: !info.needsPassword,
          selectedSheets: (info.sheets.length > 0 ? [...info.sheets] : []),
          columnsBySheet: info.columnsBySheet || {},
        } : it))
      }
    }
  }

  const removeFile = (name: string) => setSheetItems((prev) => prev.filter((p) => p.file.name !== name))

  const setPwd = async (name: string, pwd: string) => {
    // update password immediately
    setSheetItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, password: pwd } : p)))
    const target = sheetItems.find((p) => p.file.name === name)
    if (!target) return

    if (pwd && pwd.length > 0) {
      try {
        const info = await parseSheetsInfo(target.file, pwd)
        if (info && info.sheets.length > 0) {
          setSheetItems((prev) => prev.map((p) => {
            if (p.file.name !== name) return p
            const prevSelected = p.selectedSheets || []
            const nextSelected = prevSelected.length > 0 ? prevSelected.filter((s) => info.sheets.includes(s)) : (info.sheets.length > 0 ? [...info.sheets] : [])
            return { ...p, availableSheets: info.sheets, selectedSheets: nextSelected, needsPassword: false, passwordVerified: true, columnsBySheet: info.columnsBySheet || {} }
          }))
          return
        }
      } catch {}
      // backend fallback
      try {
        const { data } = await fetchSheetInfo({ variables: { file: target.file, password: pwd } })
        const info = data?.listSheetInfo as { sheets?: string[]; columnsBySheet?: Record<string, string[]> }
        const sheets: string[] = Array.isArray(info?.sheets) ? (info!.sheets as string[]) : []
        const columnsBySheet: Record<string, string[]> = (info?.columnsBySheet as any) || {}
        setSheetItems((prev) => prev.map((p) => {
          if (p.file.name !== name) return p
          const prevSelected = p.selectedSheets || []
          const nextSelected = prevSelected.length > 0 ? prevSelected.filter((s) => sheets.includes(s)) : (sheets.length > 0 ? [...sheets] : [])
          return { ...p, availableSheets: sheets, selectedSheets: nextSelected, needsPassword: false, passwordVerified: true, columnsBySheet }
        }))
      } catch {}
    } else {
      // cleared password: lock selection and mark unverified
      setSheetItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, selectedSheets: [], passwordVerified: false, needsPassword: true } : p)))
    }
  }

  // Normalize names for robust matching
  const norm = (s: string): string => s?.toString().trim().replace(/\s+/g, ' ').toLowerCase()

  const extractPromptVarMap = (prompt: string): Record<string, Set<string>> => {
    const varMap: Record<string, Set<string>> = {}
    // Match tokens like {Sheet:Column} allowing optional spaces and full-width colon (：)
    const re = /\{([^{}]+?)[：:]\s*([^{}]+?)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(prompt))) {
      const sheet = norm(m[1])
      const col = norm(m[2])
      if (!varMap[sheet]) varMap[sheet] = new Set()
      varMap[sheet].add(col)
    }
    return varMap
  }

  const buildFileColsMap = (): Record<string, Set<string>> => {
    const fileCols: Record<string, Set<string>> = {}
    for (const it of sheetItems) {
      const selected = (it.selectedSheets || it.availableSheets || [])
      for (const snRaw of selected) {
        const sn = norm(snRaw)
        const cols = it.columnsBySheet?.[snRaw] || []
        if (!fileCols[sn]) fileCols[sn] = new Set()
        cols.forEach((c) => fileCols[sn].add(norm(c)))
      }
    }
    return fileCols
  }

  // Validation: block when
  // Only check when prompt references {Sheet:Col} that do not exist in the attached files.
  // The previous logic that blocked due to "extras" (columns in files but not in prompt) has been removed per request.
  const validateSheetPromptAgainstColumns = (prompt: string): { ok: boolean; message?: string } => {
    const varMap = extractPromptVarMap(prompt)
    const fileCols = buildFileColsMap()

    // missing: referenced in prompt but not present in files
    const missing: string[] = []
    for (const [sn, set] of Object.entries(varMap)) {
      set.forEach((c) => {
        if (!fileCols[sn] || !fileCols[sn].has(c)) missing.push(`${sn}:${c}`)
      })
    }

    if (missing.length > 0) {
      return { ok: false, message: `첨부 파일에 없는 시트/열이 프롬프트에 포함되어 있습니다: ${missing.slice(0,5).join(', ')}${missing.length>5?` 외 ${missing.length-5}건`:''}` }
    }
    return { ok: true }
  }

  // Minimal readiness for SHEET Step1 to enable the Run button (execution still does strict checks)
  const isSheetInputReadyMinimal = (): boolean => {
    if (sheetItems.length === 0) return false
    for (const it of sheetItems) {
      if (it.availableSheets === undefined) return false
      if (it.needsPassword && !it.passwordVerified) return false
    }
    return true
  }

  const canRunWorkflow = useMemo(() => {
    if (steps.length < 2) return false
    const first = steps[0]
    if (first?.type === 'SHEET') {
      return isSheetInputReadyMinimal()
    }
    if (first?.type === 'JSONTOSHEET') {
      const txt = first.config?.jsonText || ''
      return !!(txt && String(txt).trim().length > 0)
    }
    return false
  }, [steps, sheetItems])

  const isStepReady = (s: Step, idx: number): boolean => {
    if (s.type === 'SHEET') {
      return isSheetConfigReadyForPrompt(s.prompt)
    }
    if (s.type === 'JSONTOSHEET') {
      if (idx === 0) {
        const txt = s.config?.jsonText || ''
        return !!(txt && String(txt).trim().length > 0)
      }
      return true
    }
    return false
  }

  // Auto-collapse a step when it becomes ready (transition from not ready -> ready)
  const prevReadyRef = useRef<boolean[]>([])
  useEffect(() => {
    if (!steps || steps.length === 0) {
      prevReadyRef.current = []
      return
    }
    const readyNow = steps.map((s, i) => isStepReady(s, i))
    const prev = prevReadyRef.current
    let changed = false
    const nextSteps = steps.map((s, i) => {
      const prevVal = prev[i]
      const becameReady = readyNow[i] && (prevVal === false || prevVal === undefined)
      if (becameReady && !s.collapsed) {
        changed = true
        return { ...s, collapsed: true }
      }
      return s
    })
    prevReadyRef.current = readyNow
    if (changed) setSteps(nextSteps)
  }, [steps, sheetItems])

  const runWorkflow = async () => {
    if (steps.length === 0) return

    const nextSteps: Step[] = steps.map((s) => ({ ...s, status: 'idle' as Step['status'], error: undefined }))
    setSteps(nextSteps)

    let prevOutput: any = null
    for (let i = 0; i < nextSteps.length; i++) {
      const step = nextSteps[i]
      step.status = 'running'
      if (i > 0) step.inputPreview = typeof prevOutput === 'string' ? prevOutput : JSON.stringify(prevOutput, null, 2)
      setSteps([...nextSteps])

      try {
        if (step.type === 'SHEET') {
          // Validate columns strictly against variables used in prompt
          const v = validateSheetPromptAgainstColumns(step.prompt)
          if (!v.ok) throw new Error(v.message)

          // Build prompt by replacing {Sheet} and {Sheet:Column}
          let promptToSend = step.prompt
          const quote = (s: string) => `'${String(s).replace(/'/g, "\\'")}'`
          // Replace tokens accepting both ASCII and full-width colon, allow spaces after colon
          promptToSend = promptToSend.replace(/\{([^{}]+?)[：:]\s*([^{}]+?)\}/g, (_m, _p1, _p2) => quote(String(_p2)))
          promptToSend = promptToSend.replace(/\{([^:{}]+)\}/g, (_m, _p1) => quote(String(_p1)))

          const passwords: Record<string,string> = {}
          const sheetNames: Record<string,string[]> = {}
          sheetItems.forEach((it) => {
            if (it.password) passwords[it.file.name] = it.password
            const selected = (it.selectedSheets || []).filter(Boolean)
            if (selected.length > 0) sheetNames[it.file.name] = selected
          })

          // compute sizes
          let maxRows = 0, maxCols = 0
          for (const it of sheetItems) {
            const selected = (it.selectedSheets || it.availableSheets || [])
            try {
              const buf = await it.file.arrayBuffer()
              const wb = XLSX.read(buf, { type: 'array', password: it.password })
              for (const sn of selected) {
                const ws = wb.Sheets[sn]
                if (!ws) continue
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any
                maxRows = Math.max(maxRows, rows.length)
                for (const row of rows) if (Array.isArray(row)) maxCols = Math.max(maxCols, row.length)
              }
            } catch {}
          }

          const meta = { passwords, sheetNames, maxRowsPerSheet: maxRows || 200, maxColsPerRow: maxCols || 30 }
          const res = await runExcel({ variables: { files: sheetItems.map((it) => it.file), prompt: promptToSend, meta, mode: sheetMode } })
          const payload = res?.data?.processExcel
          let outText: string = ''
          if (payload && payload.results && Array.isArray(payload.results)) {
            outText = payload.results[0]?.outputText || JSON.stringify(payload)
          } else if (typeof payload === 'string') {
            outText = payload
          } else {
            outText = JSON.stringify(payload)
          }
          step.output = outText
          prevOutput = outText
        } else if (step.type === 'JSONTOSHEET') {
          // Use previous output as JSON input (first step will use manual input box in config)
          const jsonInput: string = i === 0 ? (step.config?.jsonText || '') : (typeof prevOutput === 'string' ? prevOutput : JSON.stringify(prevOutput))
          const sheetName: string | undefined = step.config?.sheetName || undefined

          // Support pipe-delimited prompt for JSONTOSHEET: "<prompt>|<filename>"
          const raw = step.prompt || ''
          const parts = raw.split('|')
          const promptText = parts.length > 1 ? parts[0].trim() : raw.trim()
          const fileNameFromPrompt = parts.length > 1 ? parts.slice(1).join('|').trim() : undefined
          const finalSheetName = (fileNameFromPrompt && fileNameFromPrompt.length > 0)
            ? fileNameFromPrompt
            : (sheetName && String(sheetName).trim().length > 0 ? String(sheetName).trim() : undefined)

          const resp = await fetch('/api/json-to-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: jsonInput, prompt: promptText, sheetName: finalSheetName }),
          })
          if (!resp.ok) throw new Error(`JsonToSheet 실패: ${resp.status}`)
          const blob = await resp.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = (sheetName?.trim() || 'json_to_sheet') + '.xlsx'
          document.body.appendChild(a)
          a.click()
          a.remove()
          window.URL.revokeObjectURL(url)
          message.success('엑셀 파일이 다운로드되었습니다.')
          step.output = '[Excel downloaded]'
          // Keep prevOutput as the jsonInput for following steps visibility
          prevOutput = jsonInput
        } else {
          throw new Error(`Unsupported step type: ${step.type}`)
        }
        step.status = 'done'
      } catch (e: any) {
        step.status = 'error'
        step.error = e?.message || String(e)
        setSteps([...nextSteps])
        break
      }
      setSteps([...nextSteps])
    }
  }

  const addPromptToFlow = (p: PromptItem) => {
    const type = (p.type || '').toUpperCase() as Step['type']
    setSteps((prev) => [...prev, { id: p.id, type, prompt: p.prompt, name: p.name, status: 'idle', collapsed: true }])
  }

  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx))

  // UI render helpers
  function isSheetConfigReadyForPrompt(prompt: string): boolean {
    // All files parsed (availableSheets defined and not needing password), at least one file present,
    // and validation passes with zero extras/missing
    if (sheetItems.length === 0) return false
    // Ensure parsing done and not locked by password
    for (const it of sheetItems) {
      if (it.availableSheets === undefined) return false
      if (it.needsPassword && !it.passwordVerified) return false
    }
    const v = validateSheetPromptAgainstColumns(prompt)
    return v.ok
  }

  // UI render helpers
  const renderSheetConfigurator = (currentPrompt: string) => {
    const varMap = extractPromptVarMap(currentPrompt)
    const fileCols = buildFileColsMap()
    const missing: string[] = []
    for (const [sn, set] of Object.entries(varMap)) {
      set.forEach((c) => { if (!fileCols[sn] || !fileCols[sn].has(c)) missing.push(`${sn}:${c}`) })
    }
    return (
      <div>
        {/* Hidden file input for "+" list item */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          multiple
          style={{ display: 'none' }}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []) as File[]
            if (files.length) await addFiles(files)
            // reset value to allow selecting the same file again
            ;(e.target as HTMLInputElement).value = ''
          }}
        />

        {/* File list with last add item */}
        <List
          size="small"
          bordered
          dataSource={[...sheetItems, { __add: true } as any]}
          renderItem={(rec: any) => {
            if (rec.__add) {
              return (
                <List.Item style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                  <Button type="dashed" icon={<PlusOutlined />}>파일 추가</Button>
                </List.Item>
              )
            }
            const item = rec as FileItem
            return (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {item.needsPassword ? (
                      <LockOutlined style={{ color: '#faad14' }} title="보호됨" />
                    ) : (
                      <UnlockOutlined style={{ color: '#52c41a' }} title="공개" />
                    )}
                    <Typography.Text strong ellipsis={{ tooltip: item.file.name }} style={{ flex: 1, minWidth: 0 }}>{item.file.name}</Typography.Text>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeFile(item.file.name)} />
                  </div>
                  {item.needsPassword && (
                    <Input.Password
                      value={item.password || ''}
                      onChange={(e) => setPwd(item.file.name, e.target.value)}
                      placeholder={'비밀번호 입력'}
                      disabled={item.passwordVerified}
                      visibilityToggle
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              </List.Item>
            )
          }}
        />

        {/* Missing list under the file list (no Card) */}
        {missing.length > 0 && (() => {
          const missingBySheet: Record<string, string[]> = {}
          for (const t of missing) {
            const idx = t.indexOf(':')
            const sheet = idx >= 0 ? t.substring(0, idx) : t
            const col = idx >= 0 ? t.substring(idx + 1) : ''
            if (!missingBySheet[sheet]) missingBySheet[sheet] = []
            if (col) missingBySheet[sheet].push(col)
          }
          const sheets = Object.keys(missingBySheet)
          return (
            <div style={{ marginTop: 12 }}>
              <Typography.Text strong>프롬프트에만 있는 시트/열</Typography.Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {sheets.map((sn) => (
                  <div
                    key={sn}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      whiteSpace: 'nowrap',
                      overflowX: 'auto',
                      padding: '4px 6px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                    }}
                  >
                    <Tag color="blue">시트: {sn}</Tag>
                    <span style={{ color: '#f5222d' }}>
                      {missingBySheet[sn].join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <Layout>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <PageTitle title="Workflow" />

        <Row gutter={16}>
          <Col span={8}>
            <Card title="프롬프트 목록" size="small" extra={
              <Space>
                <Select value={selectedType} onChange={(v) => setSelectedType(v)} style={{ width: 160 }} options={[
                  { value: 'SHEET', label: 'SHEET' },
                  { value: 'JSONTOSHEET', label: 'JSONTOSHEET' },
                ]} />
                <Button size="small" shape="circle" aria-label="새로고침" icon={<ReloadOutlined />} onClick={() => fetchPrompts({ variables: { type: selectedType }, fetchPolicy: 'network-only' as any })} />
              </Space>
            }>
              {promptsLoading ? <Spin /> : (
                <>
                  {promptsError && <Alert type="error" showIcon message={`프롬프트 조회 실패: ${promptsError.message}`} style={{ marginBottom: 8 }} />}
                  {prompts.length === 0 ? (
                    <Typography.Text type="secondary">저장된 프롬프트가 없습니다.</Typography.Text>
                  ) : (
                    <List
                      dataSource={prompts}
                      renderItem={(item) => (
                        <List.Item actions={[
                          <Button key="add" type="primary" shape="circle" size="small" aria-label="추가" icon={<PlusOutlined />} onClick={() => addPromptToFlow(item)} />
                        ]}>
                          <List.Item.Meta
                            title={
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* Type as icon */}
                                {String(item.type).toUpperCase() === 'SHEET' ? (
                                  <FileExcelOutlined style={{ color: '#52c41a' }} />
                                ) : (
                                  <FileTextOutlined style={{ color: '#722ed1' }} />
                                )}
                                {/* Show name only (no index, no prompt) */}
                                <Typography.Text strong>{item.name || '이름 없음'}</Typography.Text>
                              </span>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </>
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Card
              title={(() => {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>워크플로우</span>
                  </div>
                )
              })()}
              size="small"
              extra={<Button type="primary" icon={<PlayCircleOutlined />} disabled={!canRunWorkflow} onClick={runWorkflow}>실행</Button>}
            >
              {steps.length === 0 ? (
                <Typography.Text type="secondary">좌측 목록에서 프롬프트를 추가하세요.</Typography.Text>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {steps.map((s, idx) => (
                    <Card key={idx} size="small" title={<>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Tag color="geekblue">Step {idx+1}</Tag>
                        <Typography.Text strong ellipsis style={{ flex: 1, minWidth: 0 }}>
                          {s.name || '제목 없음'}
                        </Typography.Text>
                        {s.status==='running' && <Tag color="processing">실행 중</Tag>}
                        {s.status==='done' && <Tag color="success">완료</Tag>}
                        {s.status==='error' && <Tag color="error">에러</Tag>}
                      </div>
                    </>} extra={<Space size={4}>
                        <Button type="text" aria-label={s.collapsed ? '펼치기' : '접기'} icon={s.collapsed ? <DownOutlined /> : <UpOutlined />} onClick={() => setSteps((prev) => prev.map((p, i) => i===idx ? { ...p, collapsed: !p.collapsed } : p))} />
                        <Button type="text" danger aria-label="삭제" icon={<DeleteOutlined />} onClick={() => removeStep(idx)} />
                      </Space>} style={{ borderColor: !isStepReady(s, idx) ? '#ff4d4f' : undefined }} headStyle={{ borderBottom: 'none' }} bodyStyle={s.collapsed ? { display: 'none', padding: 0 } : undefined}>
                      {!s.collapsed && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <Typography.Text strong>프롬프트</Typography.Text>
                            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{s.prompt}</pre>
                          </div>

                          {idx > 0 && (
                            <Card size="small" style={{ marginBottom: 8 }} title="입력값">
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{s.inputPreview || '(이전 단계 결과가 여기에 표시됩니다)'} </pre>
                            </Card>
                          )}

                          {s.type === 'SHEET' && (
                            <div>
                              {renderSheetConfigurator(s.prompt)}
                            </div>
                          )}

                          {s.type === 'JSONTOSHEET' && idx === 0 && (
                            <div>
                              <Card size="small" title="입력 JSON">
                                <Input.TextArea rows={8} value={s.config?.jsonText || ''} onChange={(e) => setSteps((prev) => prev.map((p, i) => i===idx ? { ...p, config: { ...(p.config||{}), jsonText: e.target.value } } : p))} />
                                <div style={{ marginTop: 8 }}>
                                  <Input placeholder="파일 이름(선택)" value={s.config?.sheetName || ''} onChange={(e) => setSteps((prev) => prev.map((p, i) => i===idx ? { ...p, config: { ...(p.config||{}), sheetName: e.target.value } } : p))} style={{ maxWidth: 320 }} />
                                </div>
                              </Card>
                            </div>
                          )}

                          {s.status==='error' && s.error && (
                            <Alert type="error" message={s.error} showIcon style={{ marginTop: 8 }} />
                          )}

                          {s.status==='done' && s.output && s.type!=='JSONTOSHEET' && (
                            <Card size="small" title="출력">
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{typeof s.output==='string'? s.output : JSON.stringify(s.output, null, 2)}</pre>
                            </Card>
                          )}
                        </>
                      )}
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </Layout>
  )
}
