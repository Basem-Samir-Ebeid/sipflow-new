/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
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
}

export default nextConfig
