import React, { useState } from 'react'
import Layout from '../src/components/Layout'
import PageTitle from '../src/components/PageTitle'
import { Button, Card, Input, Space, Typography, Alert, message } from 'antd'
import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { gql, useMutation } from '@apollo/client'

const SAVE_PROMPT = gql`
  mutation SavePrompt($prompt: String!, $type: String, $name: String) {
    savePrompt(prompt: $prompt, type: $type, name: $name)
  }
`

export default function JsonToSheetPage() {
  const [jsonText, setJsonText] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canSave, setCanSave] = useState(false)
  const [promptName, setPromptName] = useState('')

  const [savePromptMut, { loading: saving }] = useMutation(SAVE_PROMPT, {
    onCompleted: () => {
      message.success('저장되었습니다.')
    },
    onError: (e) => {
      message.error(`저장 실패: ${e.message}`)
    },
  })

  const canRun = jsonText.trim().length > 0 && prompt.trim().length > 0

  const run = async () => {
    setError(null)
    setLoading(true)
    try {
      // Support pipe-delimited prompt: "<prompt>|<filename>"
      const raw = prompt || ''
      const parts = raw.split('|')
      const promptText = parts.length > 1 ? parts[0].trim() : raw.trim()
      const fileNameFromPrompt = parts.length > 1 ? parts.slice(1).join('|').trim() : ''
      // Prefer filename from pipe if provided; otherwise use input field
      const finalSheetName = (fileNameFromPrompt && fileNameFromPrompt.length > 0)
        ? fileNameFromPrompt
        : (sheetName?.trim() || undefined)

      const res = await fetch('/api/json-to-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: jsonText, prompt: promptText, sheetName: finalSheetName }),
      })
      if (!res.ok) {
        throw new Error(`서버 오류: ${res.status} ${res.statusText}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = ((finalSheetName && finalSheetName.trim()) || 'json_to_sheet') + '.xlsx'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      message.success('엑셀 파일이 다운로드되었습니다.')
      setCanSave(true)
    } catch (e: any) {
      setError(e?.message || '실행 실패')
      setCanSave(false)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    const filename = (sheetName?.trim() || 'json_to_sheet')
    const payload = `${prompt}|${filename}`
    const name = promptName.trim()
    await savePromptMut({ variables: { prompt: payload, type: 'JSONTOSHEET', name } })
  }

  return (
    <Layout>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <PageTitle title="Json To Sheet" />

        <Card title="입력 JSON" size="small">
          <Input.TextArea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="여기에 JSON을 붙여넣으세요"
            rows={12}
          />
        </Card>

        <Card title="프롬프트" size="small">
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="프롬프트를 입력하세요 (예: 이 JSON을 표 형식으로 변환하고 필요한 열만 포함)"
            rows={6}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="파일 이름 (확장자 제외, 선택)"
              style={{ maxWidth: 340 }}
            />
            <Input
              value={promptName}
              onChange={(e) => setPromptName(e.target.value)}
              placeholder="이름 (저장 시 필요)"
              style={{ maxWidth: 340 }}
            />
          </div>
        </Card>

        <Card size="small">
          <Space>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={run} disabled={!canRun} loading={loading}>
              실행
            </Button>
            <Button icon={<SaveOutlined />} onClick={save} disabled={!canSave || !promptName.trim()} loading={saving}>
              저장
            </Button>
            {error && <Alert type="error" message={error} showIcon />}
          </Space>
        </Card>
      </Space>
    </Layout>
  )
}
