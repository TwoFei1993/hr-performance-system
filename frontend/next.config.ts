import type { NextConfig } from 'next'

let backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8002'
if (backendUrl && !backendUrl.startsWith('http')) {
  backendUrl = `https://${backendUrl}`
}

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === '1' ? 'standalone' : undefined,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
