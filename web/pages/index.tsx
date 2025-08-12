import Link from 'next/link'
import React from 'react'
import Layout from '../src/components/Layout'

export default function Home() {
  return (
    <Layout>
      <div style={{ padding: 16 }}>
        <h2>환영합니다</h2>
        <p>좌측 메뉴에서 기능을 선택하세요.</p>
        <p>
          첫 기능: <Link href="/excel">엑셀 정보 가져오기</Link>
        </p>
      </div>
    </Layout>
  )
}
