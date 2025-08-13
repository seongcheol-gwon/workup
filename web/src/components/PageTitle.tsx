import React from 'react'
import { Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'

export default function PageTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 0 }}>
      <div style={{ width: 4, height: 28, borderRadius: 2, background: 'linear-gradient(180deg, #1677ff, #52c41a)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#f0f5ff' }}>
          {icon || <FileExcelOutlined style={{ color: '#1677ff' }} />}
        </span>
        <Typography.Title level={3} style={{ margin: 0, background: 'linear-gradient(90deg, #111, #555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {title}
        </Typography.Title>
      </div>
    </div>
  )
}
