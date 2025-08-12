import Link from 'next/link'
import React from 'react'
import Layout from '../src/components/Layout'
import { Card, Typography, Button } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'

export default function Home() {
  return (
    <Layout>
      <Card>
        <Typography.Title level={2}>환영합니다</Typography.Title>
        <Typography.Paragraph>
          좌측 메뉴에서 기능을 선택하세요. 아래 버튼을 눌러 바로 이동할 수 있습니다.
        </Typography.Paragraph>
        <Link href="/excel">
          <Button type="primary" icon={<FileExcelOutlined />}>Sheet Sense</Button>
        </Link>
      </Card>
    </Layout>
  )
}
