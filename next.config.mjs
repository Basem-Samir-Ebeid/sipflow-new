/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['*.replit.dev', '*.janeway.replit.dev', '*.repl.co'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
