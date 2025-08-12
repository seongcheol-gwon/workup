declare module 'apollo-upload-client' {
  export const createUploadLink: any
  const _default: any
  export default _default
}

declare module 'graphql-upload' {
  export const GraphQLUpload: any
  export function processRequest(...args: any[]): Promise<any>
  export type FileUpload = {
    filename: string
    mimetype: string
    encoding: string
    createReadStream: () => any
  }
}

declare module 'graphql-upload/public/index.mjs' {
  export const GraphQLUpload: any
  export function processRequest(...args: any[]): Promise<any>
  export type FileUpload = {
    filename: string
    mimetype: string
    encoding: string
    createReadStream: () => any
  }
}

declare module 'graphql-upload/GraphQLUpload.mjs' {
  const GraphQLUpload: any
  export default GraphQLUpload
}

declare module 'graphql-upload/processRequest.mjs' {
  const processRequest: (...args: any[]) => Promise<any>
  export default processRequest
}
