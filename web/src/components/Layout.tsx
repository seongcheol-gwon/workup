import Link from 'next/link'
import React, { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          background: '#111827',
          color: 'white',
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>메뉴</h3>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ margin: '8px 0' }}>
              <Link href="/excel" style={{ color: 'white', textDecoration: 'none' }}>
                엑셀 정보 가져오기
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main style={{ flex: 1, background: '#f3f4f6' }}>{children}</main>
    </div>
  )
}
