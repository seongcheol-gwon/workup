import { ApolloServer } from 'apollo-server-micro'
import { typeDefs, resolvers, ensureUploadParsing } from '../../src/server/schema'
import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
})

const start = apolloServer.start()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await start
  await ensureUploadParsing(req, res)
  return apolloServer.createHandler({ path: '/api/graphql' })(req as any, res as any)
}
