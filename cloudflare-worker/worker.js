export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const target = `http://119.28.118.104:8002${url.pathname}${url.search}`

    const proxyReq = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    })

    const response = await fetch(proxyReq)
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: newHeaders })
    }

    return new Response(response.body, { status: response.status, headers: newHeaders })
  },
}
