import Link from 'next/link'
import React, { PropsWithChildren, useMemo } from 'react'
import { Layout as AntLayout, Menu, theme, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'

const { Header, Sider, Content, Footer } = AntLayout

export default function Layout({ children }: PropsWithChildren) {
  const { token } = theme.useToken()
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
      <Sider breakpoint="lg" collapsedWidth={64} style={{ background: token.colorBgContainer }}>
        <div style={{ padding: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            메뉴
          </Typography.Title>
        </div>
        <Menu mode="inline" items={items} defaultSelectedKeys={["/excel"]} />
      </Sider>
      <AntLayout>
        <Header style={{ background: token.colorBgContainer, padding: '0 24px' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Automation Console
          </Typography.Title>
        </Header>
        <Content style={{ margin: 0, background: token.colorBgLayout }}>
          <div style={{ padding: 24 }}>{children}</div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>© {new Date().getFullYear()} Musinsa Automation</Footer>
      </AntLayout>
    </AntLayout>
  )
}
