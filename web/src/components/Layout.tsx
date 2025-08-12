import Link from 'next/link'
import React, { PropsWithChildren, useMemo, useState } from 'react'
import { Layout as AntLayout, Menu, theme, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'

const { Header, Sider, Content, Footer } = AntLayout

export default function Layout({ children }: PropsWithChildren) {
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = useState(false)
  const items = useMemo(
    () => [
      {
        key: '/excel',
        icon: <FileExcelOutlined />,
        label: <Link href="/excel">엑셀 정보 가져오기</Link>,
      },
    ],
    []
  )

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={64}
        style={{ background: token.colorBgContainer }}
      >
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Replace menu text with Logo image */}
          <img
            src="/logo.png"
            alt="Musinsa Automation Logo"
            style={{
              height: collapsed ? 9 : 42,
              objectFit: 'contain',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
        <Menu mode="inline" items={items} defaultSelectedKeys={["/excel"]} />
      </Sider>
      <AntLayout>
        <Content style={{ margin: 0, background: token.colorBgLayout }}>
          <div style={{ padding: 24 }}>{children}</div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>© {new Date().getFullYear()} Musinsa Automation</Footer>
      </AntLayout>
    </AntLayout>
  )
}
