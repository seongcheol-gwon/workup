import { gql } from 'apollo-server-micro'
import GraphQLJSON from 'graphql-type-json'
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs'
import processRequest from 'graphql-upload/processRequest.mjs'
import type { NextApiRequest, NextApiResponse } from 'next'
import FormData from 'form-data'
import fetch from 'cross-fetch'

type FileUpload = {
  filename: string
  mimetype: string
  encoding?: string
  createReadStream: () => NodeJS.ReadableStream
}

// Ensure graphql-upload can parse multipart requests in Next.js
export async function ensureUploadParsing(req: NextApiRequest, res: NextApiResponse) {
  if (req.method?.toLowerCase() === 'post' && req.headers['content-type']?.includes('multipart/form-data')) {
    // @ts-ignore
    req.filePayload = await processRequest(req, res)
  }
}

export const typeDefs = gql`
  scalar Upload
  scalar JSON

  type Query {
    _health: String
  }

  type Mutation {
    processExcel(files: [Upload!]!, prompt: String!, meta: JSON, mode: String): JSON
    listSheets(file: Upload!, password: String): [String!]!
    listSheetInfo(file: Upload!, password: String): JSON
    savePrompt(prompt: String!, type: String): JSON
  }
`

export const resolvers = {
  Upload: GraphQLUpload as any,
  JSON: GraphQLJSON,
  Query: {
    _health: () => 'ok',
  },
  Mutation: {
    async processExcel(_: any, args: { files: Promise<FileUpload>[]; prompt: string; meta?: any; mode?: string }, ctx: any) {
      const uploads = await Promise.all(args.files)

      const form = new FormData()
      for (const u of uploads) {
        const stream = u.createReadStream()
        form.append('files', stream, { filename: u.filename, contentType: u.mimetype })
      }
      form.append('prompt', args.prompt)
      form.append('meta', JSON.stringify(args.meta || {}))
      if (args.mode) form.append('mode', args.mode)

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
      const resp = await fetch(`${backendUrl}/api/excel/process-multi`, {
        method: 'POST',
        // @ts-ignore
        body: form,
        headers: (form as any).getHeaders ? (form as any).getHeaders() : undefined,
      })

      if (!resp.ok) {
        const text = await resp.text()
        return { error: true, status: resp.status, message: text }
      }
      const data = await resp.json()
      return data
    },
    async listSheets(_: any, args: { file: Promise<FileUpload>; password?: string }) {
      const upload = await args.file
      const form = new FormData()
      const stream = upload.createReadStream()
      form.append('file', stream, { filename: upload.filename, contentType: upload.mimetype })
      if (args.password) form.append('password', args.password)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
      const resp = await fetch(`${backendUrl}/api/excel/list-sheets`, {
        method: 'POST',
        // @ts-ignore
        body: form,
        headers: (form as any).getHeaders ? (form as any).getHeaders() : undefined,
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `Backend error ${resp.status}`)
      }
      const data = await resp.json()
      return Array.isArray(data?.sheets) ? data.sheets : []
    },
    async listSheetInfo(_: any, args: { file: Promise<FileUpload>; password?: string }) {
      const upload = await args.file
      const form = new FormData()
      const stream = upload.createReadStream()
      form.append('file', stream, { filename: upload.filename, contentType: upload.mimetype })
      if (args.password) form.append('password', args.password)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
      const resp = await fetch(`${backendUrl}/api/excel/list-sheet-info`, {
        method: 'POST',
        // @ts-ignore
        body: form,
        headers: (form as any).getHeaders ? (form as any).getHeaders() : undefined,
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(text || `Backend error ${resp.status}`)
      }
      const data = await resp.json()
      return data
    },
    async savePrompt(_: any, args: { prompt: string; type?: string }) {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
      const resp = await fetch(`${backendUrl}/api/prompt/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: args.prompt, type: args.type || 'SHEET' }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        return { error: true, status: resp.status, message: text }
      }
      const data = await resp.json()
      return data
    },
  },
}
