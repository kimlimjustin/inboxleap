import { beforeAll, afterAll } from 'vitest'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Global test setup
beforeAll(async () => {
  console.log('🧪 Setting up test environment...')
  
  // Ensure we're using a test database or mock
  if (!process.env.DATABASE_URL?.includes('test') && !process.env.NODE_ENV?.includes('test')) {
    console.warn('⚠️  Warning: Not using a test database. Consider setting NODE_ENV=test')
  }
})

// Global test cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
})
