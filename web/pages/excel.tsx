import React, { useMemo, useState } from 'react'
import Layout from '../src/components/Layout'
import { gql, useMutation } from '@apollo/client'
import * as XLSX from 'xlsx'

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

type FileItem = {
  file: File
  password?: string
  availableSheets?: string[]
  selectedSheets?: string[]
  needsPassword?: boolean
  passwordVerified?: boolean
}

export default function ExcelPage() {
  const [items, setItems] = useState<FileItem[]>([])
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'detail' | 'json'>('detail')
  const [result, setResult] = useState<any>(null)

  const [run, { loading, error }] = useMutation(PROCESS_EXCEL, {
    onCompleted: (data) => {
      setResult(data?.processExcel)
    },
  })
  const [fetchSheets] = useMutation(LIST_SHEETS)

  const parseSheetsInfo = async (
    file: File
  ): Promise<{ sheets: string[]; needsPassword: boolean }> => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      return { sheets: wb.SheetNames || [], needsPassword: false }
    } catch (e) {
      // If parsing fails in browser, assume it may be password-protected
      return { sheets: [], needsPassword: true }
    }
  }

  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setItems((prev) => {
      const existingNames = new Set(prev.map((p) => p.file.name))
      const dedup = files.filter((f) => !existingNames.has(f.name))
      // optimistic add without sheets yet
      return [
        ...prev,
        ...dedup.map((f) => ({ file: f, availableSheets: undefined, selectedSheets: [] as string[], needsPassword: false, passwordVerified: false })),
      ]
    })

    // parse sheets asynchronously and update state when ready
    for (const f of files) {
      const info = await parseSheetsInfo(f)
      setItems((prev) =>
        prev.map((it) =>
          it.file.name === f.name
            ? {
                ...it,
                availableSheets: info.sheets,
                needsPassword: info.needsPassword,
                passwordVerified: !info.needsPassword, // if not protected, treat as verified
                // default select all sheets if any, otherwise empty
                selectedSheets: info.sheets.length > 0 ? [...info.sheets] : [],
              }
            : it
        )
      )
    }

    e.currentTarget.value = ''
  }

  const onDelete = (name: string) => {
    setItems((prev) => prev.filter((p) => p.file.name !== name))
  }

  const setPwd = async (name: string, pwd: string) => {
    // Set password immediately
    setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, password: pwd } : p)))

    // If this file was password-protected and now we have a password, try to fetch sheets from backend
    const target = items.find((p) => p.file.name === name)
    if (target && target.needsPassword) {
      if (pwd && pwd.length > 0) {
        try {
          const { data } = await fetchSheets({ variables: { file: target.file, password: pwd } })
          const sheets: string[] = data?.listSheets || []
          setItems((prev) =>
            prev.map((p) =>
              p.file.name === name
                ? { ...p, availableSheets: sheets, selectedSheets: sheets.length > 0 ? [...sheets] : [], passwordVerified: true }
                : p
            )
          )
        } catch (err) {
          // leave availableSheets as-is; UI will still allow run with meta passwords
        }
      } else {
        // If password cleared, lock the sheet selection
        setItems((prev) => prev.map((p) => (p.file.name === name ? { ...p, selectedSheets: [], passwordVerified: false } : p)))
      }
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

  const handleRun = async () => {
      // Clear previous result and show loading state message
      setResult(null)
    const passwords: Record<string, string> = {}
    const sheetNames: Record<string, string[]> = {}
    items.forEach((it) => {
      if (it.password) passwords[it.file.name] = it.password
      const selected = (it.selectedSheets || []).filter((s) => s && s.length > 0)
      if (selected.length > 0) sheetNames[it.file.name] = selected
    })

    const meta = {
      passwords,
      sheetNames,
      maxRowsPerSheet: 200,
      maxColsPerRow: 30,
    }

    await run({
      variables: {
        files: items.map((it) => it.file),
        prompt,
        meta,
        mode,
      },
    })
  }

  return (
    <Layout>
      <div style={{ padding: 16 }}>
        <h2>엑셀 정보 가져오기</h2>

        <section style={{ marginTop: 16, background: 'white', padding: 16, borderRadius: 8 }}>
          <label style={{ display: 'inline-block', marginBottom: 8, fontWeight: 600 }}>엑셀 파일 업로드</label>
          <input type="file" accept=".xls,.xlsx" multiple onChange={onAddFiles} />

          {items.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 4px' }}>파일명</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 4px' }}>비밀번호</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 4px' }}>사용 시트 선택</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 4px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.file.name}>
                      <td style={{ padding: '8px 4px' }}>{it.file.name}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <input
                          type="password"
                          value={it.password || ''}
                          onChange={(e) => setPwd(it.file.name, e.target.value)}
                          placeholder={it.needsPassword ? '비밀번호 입력' : '비밀번호 불필요'}
                          disabled={!it.needsPassword || it.passwordVerified}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        {it.availableSheets === undefined ? (
                          <span style={{ color: '#6b7280' }}>시트 읽는 중...</span>
                        ) : it.availableSheets.length === 0 ? (
                          <span style={{ color: '#6b7280' }}>시트 없음</span>
                        ) : (
                          <div>
                            <select
                              multiple
                              size={Math.min(8, Math.max(4, it.availableSheets.length))}
                              disabled={it.needsPassword && !it.passwordVerified}
                              value={it.selectedSheets || []}
                              onChange={(e) => {
                                const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                                setItems((prev) =>
                                  prev.map((p) => (p.file.name === it.file.name ? { ...p, selectedSheets: opts } : p))
                                )
                              }}
                              style={{ minWidth: 240 }}
                            >
                              {it.availableSheets.map((sn) => (
                                <option key={sn} value={sn}>
                                  {sn}
                                </option>
                              ))}
                            </select>
                            {it.needsPassword && !it.passwordVerified && (
                              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                                비밀번호를 입력하면 시트를 선택할 수 있습니다.
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <button onClick={() => onDelete(it.file.name)}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: 16, background: 'white', padding: 16, borderRadius: 8 }}>
          <label style={{ display: 'inline-block', marginBottom: 8, fontWeight: 600 }}>프롬프트</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="프롬프트를 입력하세요"
            rows={6}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div style={{ marginTop: 8 }}>
            <label>
              <input
                type="radio"
                value="detail"
                checked={mode === 'detail'}
                onChange={() => setMode('detail')}
              />{' '}
              상세 모드
            </label>
            <label style={{ marginLeft: 16 }}>
              <input type="radio" value="json" checked={mode === 'json'} onChange={() => setMode('json')} /> JSON 모드
            </label>
          </div>
        </section>

        <section style={{ marginTop: 16, background: 'white', padding: 16, borderRadius: 8 }}>
          <button
            disabled={!canRun || loading}
            onClick={handleRun}
            style={{
              background: !canRun || loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: !canRun || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '실행 중... (AI 처리)' : '실행'}
          </button>
          {error && (
            <div style={{ color: 'red', marginTop: 8 }}>에러: {error.message}</div>
          )}
        </section>

        {(loading || result) && (
          <section style={{ marginTop: 16, background: 'white', padding: 16, borderRadius: 8 }}>
            <h3>결과</h3>
            {loading ? (
              <div>AI가 데이터 확인중입니다.</div>
            ) : (
              result && (
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </pre>
              )
            )}
          </section>
        )}
      </div>
    </Layout>
  )
}
