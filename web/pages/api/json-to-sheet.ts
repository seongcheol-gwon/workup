import type { NextApiRequest, NextApiResponse } from 'next'

// Proxy API route to forward JSON-to-Sheet requests to Spring backend
// Config via env BACKEND_BASE_URL (server-side). Defaults to http://localhost:8080
const BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:8080'

export const config = {
  api: {
    bodyParser: false, // We will forward the raw body
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    // Read raw body (since we disabled bodyParser)
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      req.on('end', () => resolve())
      req.on('error', (err) => reject(err))
    })
    const body = Buffer.concat(chunks)

    const targetUrl = `${BASE_URL}/api/json-to-sheet`
    const backendResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        // Forward only relevant headers
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body,
    })

    // Forward status and headers
    res.status(backendResp.status)

    const contentType = backendResp.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)

    const contentDisposition = backendResp.headers.get('content-disposition')
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition)

    // Some proxies need explicit cache-control off for downloads
    const cacheControl = backendResp.headers.get('cache-control')
    if (cacheControl) res.setHeader('Cache-Control', cacheControl)

    // Stream body
    const arrayBuffer = await backendResp.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    res.end(buffer)
  } catch (e: any) {
    res.status(500).json({ error: 'PROXY_FAILED', message: e?.message || String(e) })
  }
}
