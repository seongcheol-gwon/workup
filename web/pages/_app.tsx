import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs'
import type { AppProps } from 'next/app'
import React from 'react'

import '../styles.css'

const client = new ApolloClient({
  link: createUploadLink({ uri: '/api/graphql' }) as any,
  cache: new InMemoryCache(),
})

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ApolloProvider client={client}>
      <Component {...pageProps} />
    </ApolloProvider>
  )
}
