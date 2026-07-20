import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Env lives in the monorepo root .env; a package-local .env can still override
config({ path: ['.env', '../../.env'], quiet: true })

export default defineConfig({
  // Use compiled files as drizzle-kit loads with CommonJS
  schema: ['./dist/schemas/**/*.schema.js'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
