import path from 'node:path'

import { config } from 'dotenv'

import type { NextConfig } from 'next'

// Load the monorepo root .env so all packages share one env file.
// Existing process.env values (shell, CI) are never overridden.
config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true })

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
