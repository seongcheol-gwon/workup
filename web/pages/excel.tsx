import React, { useMemo, useState } from 'react'
import Layout from '../src/components/Layout'
import PageTitle from '../src/components/PageTitle'
import { gql, useMutation } from '@apollo/client'
import * as XLSX from 'xlsx'
import { Alert, Button, Card, Input, Radio, Select, Space, Table, Tag, Typography, Upload, Spin, message } from 'antd'
import { InboxOutlined, DeleteOutlined, PlayCircleOutlined, CloseOutlined, MinusCircleOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons'

const PROCESS_EXCEL = gql`
  mutation ProcessExcel($files: [Upload!]!, $prompt: String!, $meta: JSON, $mode: String) {
    processExcel(files: $files, prompt: $prompt, meta: $meta, mode: $mode)
  }
`

const LIST_SHEETS = gql`
  mutation ListSheets($file: Upload!, $password: String) {
    listSheets(file: $file, password: $password)
  }
`

const LIST_SHEET_INFO = gql`
  mutation ListSheetInfo($file: Upload!, $password: String) {
    listSheetInfo(file: $file, password: $password)
  }
`

const SAVE_PROMPT = gql`
  mutation SavePrompt($prompt: String!, $type: String, $name: String) {
    savePrompt(prompt: $prompt, type: $type, name: $name)
  }
`

type FileItem = {
  file: File
  password?: string
  availableSheets?: string[]
  selectedSheets?: string[]
  needsPassword?: boolean
  passwordVerified?: boolean
  columnsBySheet?: Record<string, string[]>
}

export default function ExcelPage() {
  const [items, setItems] = useState<FileItem[]>([])
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'detail' | 'json'>('detail')
  const [result, setResult] = useState<any>(null)
  const [canSave, setCanSave] = useState(false)
  const [promptName, setPromptName] = useState('')

  const [run, { loading, error }] = useMutation(PROCESS_EXCEL, {
    onCompleted: (data) => {
      setResult(data?.processExcel)
      setCanSave(true)
    },
    onError: () => {
      setCanSave(false)
    },
  })
  const [fetchSheets] = useMutation(LIST_SHEETS)
  const [fetchSheetInfo] = useMutation(LIST_SHEET_INFO)
  const [savePromptMut, { loading: saving }] = useMutation(SAVE_PROMPT, {
    onCompleted: () => {
      message.success('프롬프트가 저장되었습니다.')
    },
    onError: (e) => {
      message.error(`저장 실패: ${e.message}`)
    },
  })

  const parseSheetsInfo = async (
    file: File,
    password?: string
  ): Promise<{ sheets: string[]; needsPassword: boolean; columnsBySheet?: Record<string, string[]> }> => {
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
    } catch (e) {
      // If parsing fails in browser, assume it may be password-protected or requires password
      return { sheets: [], needsPassword: true }
    }
  }

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    // Determine new files by name against current state to avoid touching existing entries
    const existingNames = new Set(items.map((p) => p.file.name))
    const dedup = files.filter((f) => !existingNames.has(f.name))

    // Append only the new files
    if (dedup.length > 0) {
      setItems((prev) => [
        ...prev,
        ...dedup.map((f) => ({ file: f, availableSheets: undefined, selectedSheets: [] as string[], needsPassword: false, passwordVerified: false })),
      ])

      // Parse and update only the new files
      for (const f of dedup) {
        const info = await parseSheetsInfo(f)
        setItems((prev) =>
          prev.map((it) => {
            if (it.file.name !== f.name) return it
            const prevSelected = it.selectedSheets || []
            const nextSelected = prevSelected.length > 0
              ? prevSelected.filter((s) => info.sheets.includes(s))
              : (info.sheets.length > 0 ? [...info.sheets] : [])
            return {
              ...it,
              availableSheets: info.sheets,
              needsPassword: info.needsPassword,
              passwordVerified: !info.needsPassword,
              selectedSheets: nextSelected,
              columnsBySheet: info.columnsBySheet || {},
            }
          })
        )
      }
    }
  }


  const onDelete = (name: string) => {
    setItems((prev) => prev.filter((p) => p.file.name !== name))
  }

  const setPwd = async (name: string, pwd: string) => {
    // Set password immediately
    setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, password: pwd } : p)))

    // Always try to parse with provided password (regardless of current needsPassword flag)
    const target = items.find((p) => p.file.name === name)
    if (!target) return

    if (pwd && pwd.length > 0) {
      try {
        const info = await parseSheetsInfo(target.file, pwd)
        if (info && info.sheets.length > 0) {
          setItems((prev) =>
            prev.map((p) => {
              if (p.file.name !== name) return p
              const prevSelected = p.selectedSheets || []
              const nextSelected = prevSelected.length > 0
                ? prevSelected.filter((s) => info.sheets.includes(s))
                : (info.sheets.length > 0 ? [...info.sheets] : [])
              return {
                ...p,
                availableSheets: info.sheets,
                selectedSheets: nextSelected,
                needsPassword: false,
                passwordVerified: true,
                columnsBySheet: info.columnsBySheet || {},
              }
            })
          )
          return
        }
      } catch (err) {
        // fall through to backend approach
      }
      // Backend fallback: fetch sheets and columns via server
      try {
        const { data } = await fetchSheetInfo({ variables: { file: target.file, password: pwd } })
        const info = data?.listSheetInfo as { sheets?: string[]; columnsBySheet?: Record<string, string[]> }
        const sheets: string[] = Array.isArray(info?.sheets) ? (info!.sheets as string[]) : []
        const columnsBySheet: Record<string, string[]> = (info?.columnsBySheet as any) || {}
        setItems((prev) =>
          prev.map((p) => {
            if (p.file.name !== name) return p
            const prevSelected = p.selectedSheets || []
            const nextSelected = prevSelected.length > 0
              ? prevSelected.filter((s) => sheets.includes(s))
              : (sheets.length > 0 ? [...sheets] : [])
            return { ...p, availableSheets: sheets, selectedSheets: nextSelected, needsPassword: false, passwordVerified: true, columnsBySheet }
          })
        )
      } catch (err) {
        // leave availableSheets as-is; UI will still allow run with meta passwords
      }
    } else {
      // If password cleared, lock the sheet selection
      setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, selectedSheets: [], passwordVerified: false } : p)))
    }
  }

  const toggleSheet = (name: string, sheet: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.file.name !== name) return p
        const current = new Set(p.selectedSheets || [])
        if (checked) current.add(sheet)
        else current.delete(sheet)
        return { ...p, selectedSheets: Array.from(current) }
      })
    )
  }

  const canRun = useMemo(() => items.length > 0 && prompt.trim().length > 0, [items, prompt])

  const insertIntoPrompt = (value: string) => {
    if (!value) return
    // Insert raw token (e.g., {Sheet} or {Sheet:Column}) without quotes
    const safe = String(value)
    try {
      const textarea = document.getElementById('excel-prompt-input') as HTMLTextAreaElement | null
      if (textarea && typeof textarea.selectionStart === 'number') {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd || start
        const before = prompt.substring(0, start)
        const after = prompt.substring(end)
        const sepBefore = before && !before.endsWith(' ') ? ' ' : ''
        const sepAfter = after && !after.startsWith(' ') ? ' ' : ''
        const newVal = `${before}${sepBefore}${safe}${sepAfter}${after}`
        setPrompt(newVal)
        setTimeout(() => {
          const pos = (before + sepBefore + safe).length
          textarea.selectionStart = textarea.selectionEnd = pos
          textarea.focus()
        }, 0)
        return
      }
    } catch {}
    setPrompt((p) => (p ? `${p} ${safe}` : safe))
  }

  const handleRun = async () => {
      // Clear previous result and show loading state message
      setResult(null)
      setCanSave(false)
    const passwords: Record<string, string> = {}
    const sheetNames: Record<string, string[]> = {}
    items.forEach((it) => {
      if (it.password) passwords[it.file.name] = it.password
      const selected = (it.selectedSheets || []).filter((s) => s && s.length > 0)
      if (selected.length > 0) sheetNames[it.file.name] = selected
    })

    // Build map of columns per sheet across all selected items
    const columnsMap: Record<string, Set<string>> = {}
    for (const it of items) {
      const selected = (it.selectedSheets || []).filter((s) => s && s.length > 0)
      for (const sn of selected) {
        const cols = it.columnsBySheet?.[sn] || []
        if (!columnsMap[sn]) columnsMap[sn] = new Set<string>()
        cols.forEach((c) => columnsMap[sn].add(String(c)))
      }
    }

    // Dynamically compute maximum rows per sheet and maximum columns per row across selected sheets
    let computedMaxRows = 0
    let computedMaxCols = 0
    for (const it of items) {
      const selected = (it.selectedSheets || []).filter((s) => s && s.length > 0)
      if (selected.length === 0) continue
      try {
        const buf = await it.file.arrayBuffer()
        let wb: XLSX.WorkBook | null = null
        try {
          wb = XLSX.read(buf, { type: 'array', password: it.password })
        } catch {
          wb = null
        }
        if (!wb) continue
        for (const sn of selected) {
          const ws = wb.Sheets[sn]
          if (!ws) continue
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any
          if (rows.length > computedMaxRows) computedMaxRows = rows.length
          for (const row of rows) {
            if (Array.isArray(row) && row.length > computedMaxCols) {
              computedMaxCols = row.length
            }
          }
        }
      } catch {
        // Ignore files we cannot read; fall back to defaults if nothing computed
      }
    }

    // Expand variables in prompt according to requirements:
    // - {시트이름:열이름} -> '열이름'
    // - {시트이름} -> '시트이름'
    // Perform replacements unconditionally and quote values with single quotes.
    let promptToSend = prompt

    const quote = (s: string) => `'${String(s).replace(/'/g, "\\'")}'`

    // Replace {sheet:column} tokens first
    promptToSend = promptToSend.replace(/\{([^:{}]+):([^{}]+)\}/g, (_match, _p1, _p2) => {
      const col = String(_p2)
      return quote(col)
    })

    // Then replace {sheet} tokens
    promptToSend = promptToSend.replace(/\{([^:{}]+)\}/g, (_match, _p1) => {
      const sheet = String(_p1)
      return quote(sheet)
    })

    const meta = {
      passwords,
      sheetNames,
    }

    await run({
      variables: {
        files: items.map((it) => it.file),
        prompt: promptToSend,
        meta,
        mode,
      },
    })
  }

  return (
    <Layout>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <PageTitle title="Sheet Sense" />

        <Card title="스프레드시트 파일 업로드" size="small">
          <Upload.Dragger
            multiple
            accept=".xls,.xlsx"
            beforeUpload={async (file) => {
              // Prevent Upload from keeping an internal fileList and manage it ourselves
              await addFiles([file as File])
              return Upload.LIST_IGNORE
            }}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">파일을 이 영역으로 드래그하거나 클릭하여 업로드</p>
            <p className="ant-upload-hint">스프레드시트(.xls, .xlsx) 파일을 여러 개 선택할 수 있습니다.</p>
          </Upload.Dragger>

          {items.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => r.file.name}
                dataSource={items}
                columns={[
                  {
                    title: '파일',
                    key: 'name_password',
                    width: 420,
                    onCell: () => ({ style: { minWidth: 280, maxWidth: 480 } }),
                    render: (_: any, rec: any) => (
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {rec.needsPassword ? (
                            <LockOutlined style={{ color: '#faad14' }} title="보호됨" />
                          ) : (
                            <UnlockOutlined style={{ color: '#52c41a' }} title="공개" />
                          )}
                          <Typography.Text strong ellipsis={{ tooltip: rec.file.name }} style={{ flex: 1, minWidth: 0 }}>{rec.file.name}</Typography.Text>
                        </div>
                        <Input.Password
                          value={rec.password || ''}
                          onChange={(e) => setPwd(rec.file.name, e.target.value)}
                          placeholder={rec.needsPassword ? '비밀번호 입력' : '비밀번호 불필요'}
                          disabled={rec.passwordVerified}
                          visibilityToggle
                          style={{ width: '100%' }}
                        />
                      </div>
                    ),
                  },
                  {
                    title: '사용 시트 / 열',
                    key: 'sheets',
                    render: (_: any, rec: FileItem) => (
                      rec.availableSheets === undefined ? (
                        <Typography.Text type="secondary">시트 읽는 중...</Typography.Text>
                      ) : rec.availableSheets.length === 0 ? (
                        <Typography.Text type="secondary">{rec.needsPassword ? '비밀번호를 입력해주세요.' : '시트 없음'}</Typography.Text>
                      ) : (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(((rec.selectedSheets && rec.selectedSheets.length > 0)
                                ? rec.selectedSheets
                                : (rec.availableSheets || [])) as string[]).map((sn) => (
                              <div key={sn} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, width: '100%' }}>
                                <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                  <Tag
                                    color="blue"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => insertIntoPrompt(`{${sn}}`)}
                                  >
                                    시트: {sn}
                                  </Tag>
                                  <Button
                                    size="small"
                                    type="text"
                                    danger
                                    aria-label="시트 삭제"
                                    icon={<CloseOutlined />}
                                    onClick={() => {
                                      setItems((prev) =>
                                        prev.map((p) => {
                                          if (p.file.name !== rec.file.name) return p
                                          const next = (p.selectedSheets || []).filter((s) => s !== sn)
                                          return { ...p, selectedSheets: next }
                                        })
                                      )
                                    }}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {(rec.columnsBySheet?.[sn] || []).length === 0 ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>열 정보 없음</Typography.Text>
                                  ) : (
                                    (rec.columnsBySheet?.[sn] || []).map((cn) => {
                                      // Determine if this column is referenced in the current prompt
                                      // Only explicit {Sheet:Column} should mark a column as used
                                      const sheetColRegex = /\{([^:{}]+):([^{}]+)\}/g
                                      const usedColsMap: Record<string, Set<string>> = {}
                                      // Collect sheet:column tokens
                                      let m2: RegExpExecArray | null
                                      while ((m2 = sheetColRegex.exec(prompt))) {
                                        const s = String(m2[1])
                                        const c = String(m2[2])
                                        if (!usedColsMap[s]) usedColsMap[s] = new Set<string>()
                                        usedColsMap[s].add(c)
                                      }
                                      const isUsed = usedColsMap[sn]?.has(cn) ?? false
                                      return (
                                        <Tag
                                          key={`${sn}:${cn}`}
                                          color={isUsed ? 'green' : 'geekblue'}
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => insertIntoPrompt(`{${sn}:${cn}` + '}' )}
                                        >
                                          {cn}{isUsed ? ' •' : ''}
                                        </Tag>
                                      )
                                    })
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {rec.needsPassword && !rec.passwordVerified && (
                            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                              비밀번호를 입력하면 시트를 선택할 수 있습니다.
                            </div>
                          )}
                        </div>
                      )
                    ),
                  },
                  {
                    title: '',
                    key: 'actions',
                    align: 'right' as const,
                    render: (_: any, rec: any) => (
                      <Button type="text" danger aria-label="파일 삭제" icon={<MinusCircleOutlined />} onClick={() => onDelete(rec.file.name)} />
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>

        <Card title="프롬프트" size="small">
          <Input.TextArea
            id="excel-prompt-input"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setCanSave(false) }}
            placeholder="프롬프트를 입력하세요"
            rows={6}
          />
          <div style={{ marginTop: 8 }}>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio.Button value="detail">상세 모드</Radio.Button>
              <Radio.Button value="json">JSON 모드</Radio.Button>
            </Radio.Group>
          </div>
        </Card>

        <Card size="small">
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={!canRun}
              loading={loading}
              onClick={handleRun}
            >
              실행
            </Button>
            <Input
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder="이름 (저장 시 필요)"
              style={{ maxWidth: 320 }}
            />
            <Button
              type="default"
              disabled={!canSave || !prompt.trim() || !promptName.trim()}
              loading={saving}
              onClick={() => {
                const p = prompt.trim()
                const n = promptName.trim()
                if (!p || !n) return
                savePromptMut({ variables: { prompt: p, type: 'SHEET', name: n } })
              }}
            >
              저장
            </Button>
            {error && <Alert type="error" message={`에러: ${error.message}`} showIcon />}
          </Space>
        </Card>

        {(loading || result) && (
          <Card title="결과" size="small">
            {loading ? (
              <Space align="center">
                <Spin />
                <Typography.Text>AI가 데이터 확인중입니다.</Typography.Text>
              </Space>
            ) : (
              result && (
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </pre>
              )
            )}
          </Card>
        )}
      </Space>
    </Layout>
  )
}
