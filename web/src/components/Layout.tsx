import Link from 'next/link'
import React, { PropsWithChildren, useMemo, useState } from 'react'
import { Layout as AntLayout, Menu, theme, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import { useRouter } from 'next/router'

const { Header, Sider, Content, Footer } = AntLayout

export default function Layout({ children }: PropsWithChildren) {
  const { token } = theme.useToken()
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const items = useMemo(
    () => [
      {
        key: '/excel',
        icon: <FileExcelOutlined />,
        label: <Link href="/excel">Sheet Sense</Link>,
      },
      {
        key: '/json-to-sheet',
        icon: <FileExcelOutlined />,
        label: <Link href="/json-to-sheet">Json To Sheet</Link>,
      },
      {
        key: '/workflow',
        icon: <FileExcelOutlined />,
        label: <Link href="/workflow">Workflow</Link>,
      },
    ],
    []
  )

  // Determine the active menu key based on the current pathname
  const activeKey = useMemo(() => {
    const path = router.pathname || '/'
    if (path.startsWith('/excel')) return '/excel'
    if (path.startsWith('/json-to-sheet')) return '/json-to-sheet'
    if (path.startsWith('/workflow')) return '/workflow'
    // Fallback: if on index or other route, select none
    return ''
  }, [router.pathname])

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
        <Menu mode="inline" items={items} selectedKeys={activeKey ? [activeKey] : []} />
      </Sider>
      <AntLayout>
        <Content style={{ margin: 0, background: token.colorBgLayout }}>
          <div style={{ padding: 24 }}>{children}</div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>© {new Date().getFullYear()} Workup MUSINSA</Footer>
      </AntLayout>
    </AntLayout>
  )
}
