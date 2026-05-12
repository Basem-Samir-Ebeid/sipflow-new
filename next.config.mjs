/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '*.replit.dev',
    '*.janeway.replit.dev',
    '*.repl.co',
    '*.kirk.replit.dev',
    '*.picard.replit.dev',
  ],
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pg'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
