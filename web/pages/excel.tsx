import React, { useMemo, useState } from 'react'
import Layout from '../src/components/Layout'
import { gql, useMutation } from '@apollo/client'
import * as XLSX from 'xlsx'
import { Alert, Button, Card, Input, Radio, Select, Space, Table, Tag, Typography, Upload, Spin } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { InboxOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons'

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

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setItems((prev) => {
      const existingNames = new Set(prev.map((p) => p.file.name))
      const dedup = files.filter((f) => !existingNames.has(f.name))
      return [
        ...prev,
        ...dedup.map((f) => ({ file: f, availableSheets: undefined, selectedSheets: [] as string[], needsPassword: false, passwordVerified: false })),
      ]
    })
    for (const f of files) {
      const info = await parseSheetsInfo(f)
      setItems((prev) =>
        prev.map((it) =>
          it.file.name === f.name
            ? {
                ...it,
                availableSheets: info.sheets,
                needsPassword: info.needsPassword,
                passwordVerified: !info.needsPassword,
                selectedSheets: info.sheets.length > 0 ? [...info.sheets] : [],
              }
            : it
        )
      )
    }
  }

  const onUploadChange = async (info: { fileList: UploadFile[] }) => {
    const files: File[] = info.fileList
      .map((f) => f.originFileObj)
      .filter((f): f is any => !!f)
      .map((f) => f as File)
    await addFiles(files)
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
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Typography.Title level={2} style={{ marginTop: 0 }}>엑셀 정보 가져오기</Typography.Title>

        <Card title="엑셀 파일 업로드" size="small">
          <Upload.Dragger
            multiple
            accept=".xls,.xlsx"
            beforeUpload={() => false}
            onChange={onUploadChange}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">파일을 이 영역으로 드래그하거나 클릭하여 업로드</p>
            <p className="ant-upload-hint">엑셀(.xls, .xlsx) 파일을 여러 개 선택할 수 있습니다.</p>
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
                    title: '파일명',
                    dataIndex: ['file', 'name'],
                    key: 'name',
                    render: (_: any, rec: any) => (
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>{rec.file.name}</Typography.Text>
                        {rec.needsPassword ? <Tag color="gold">보호됨</Tag> : <Tag color="green">공개</Tag>}
                      </Space>
                    ),
                  },
                  {
                    title: '비밀번호',
                    key: 'password',
                    render: (_: any, rec: any) => (
                      <Input.Password
                        value={rec.password || ''}
                        onChange={(e) => setPwd(rec.file.name, e.target.value)}
                        placeholder={rec.needsPassword ? '비밀번호 입력' : '비밀번호 불필요'}
                        disabled={!rec.needsPassword || rec.passwordVerified}
                        visibilityToggle
                        style={{ width: 220 }}
                      />
                    ),
                  },
                  {
                    title: '사용 시트 선택',
                    key: 'sheets',
                    render: (_: any, rec: any) => (
                      rec.availableSheets === undefined ? (
                        <Typography.Text type="secondary">시트 읽는 중...</Typography.Text>
                      ) : rec.availableSheets.length === 0 ? (
                        <Typography.Text type="secondary">시트 없음</Typography.Text>
                      ) : (
                        <div>
                          <Select
                            mode="multiple"
                            style={{ minWidth: 260 }}
                            disabled={rec.needsPassword && !rec.passwordVerified}
                            value={rec.selectedSheets || []}
                            onChange={(opts) => {
                              setItems((prev) => prev.map((p) => (p.file.name === rec.file.name ? { ...p, selectedSheets: opts as string[] } : p)))
                            }}
                            options={(rec.availableSheets || []).map((sn: string) => ({ label: sn, value: sn }))}
                          />
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
                    title: '삭제',
                    key: 'actions',
                    render: (_: any, rec: any) => (
                      <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(rec.file.name)}>
                        삭제
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>

        <Card title="프롬프트" size="small">
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
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
