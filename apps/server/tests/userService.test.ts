import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getOrCreateUserByEmail, signUpOrSignInUser } from '../src/services/userService'
import { storage } from '../src/storage'
import { createMockUser } from './helpers'

// Mock the storage module
vi.mock('../src/storage', () => ({
  storage: {
    getUserByEmail: vi.fn(),
    upsertUser: vi.fn(),
    getUser: vi.fn()
  }
}))

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateUserByEmail', () => {
    it('should return existing user if found', async () => {
      const existingUser = createMockUser({ email: 'test@example.com' })
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingUser)

      const result = await getOrCreateUserByEmail('test@example.com')

      expect(result).toEqual(existingUser)
      expect(storage.getUserByEmail).toHaveBeenCalledWith('test@example.com')
      expect(storage.upsertUser).not.toHaveBeenCalled()
    })

    it('should create new user if not found', async () => {
      const newUser = createMockUser({ email: 'new@example.com' })
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined)
      vi.mocked(storage.upsertUser).mockResolvedValue(newUser)

      const result = await getOrCreateUserByEmail('new@example.com')

      expect(result).toEqual(newUser)
      expect(storage.getUserByEmail).toHaveBeenCalledWith('new@example.com')
      expect(storage.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          authProvider: 'system'
        })
      )
    })

    it('should not create users with service emails @inboxleap.com domain', async () => {
      await expect(getOrCreateUserByEmail('service@inboxleap.com')).rejects.toThrow(
        'Cannot create user for service email: service@inboxleap.com'
      )
      
      expect(storage.getUserByEmail).not.toHaveBeenCalled()
      expect(storage.upsertUser).not.toHaveBeenCalled()
    })

    it('should allow creation of agent emails @inboxleap.com domain', async () => {
      const mockUser = { id: 'user-123', email: 'todo@inboxleap.com' }
      vi.mocked(storage.getUserByEmail).mockResolvedValue(null)
      vi.mocked(storage.upsertUser).mockResolvedValue(mockUser)

      const result = await getOrCreateUserByEmail('todo@inboxleap.com')
      
      expect(result).toEqual(mockUser)
      expect(storage.getUserByEmail).toHaveBeenCalledWith('todo@inboxleap.com')
      expect(storage.upsertUser).toHaveBeenCalled()
    })

    it('should not create users with @system.internal domain', async () => {
      await expect(getOrCreateUserByEmail('agent@system.internal')).rejects.toThrow(
        'Cannot create user for service email: agent@system.internal'
      )
      
      expect(storage.getUserByEmail).not.toHaveBeenCalled()
      expect(storage.upsertUser).not.toHaveBeenCalled()
    })

    it('should update existing user profile if provided', async () => {
      const existingUser = createMockUser({ 
        email: 'test@example.com',
        firstName: null,
        lastName: null
      })
      const updatedUser = { ...existingUser, firstName: 'John', lastName: 'Doe' }
      
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingUser)
      vi.mocked(storage.upsertUser).mockResolvedValue(updatedUser)

      const result = await getOrCreateUserByEmail('test@example.com', {
        firstName: 'John',
        lastName: 'Doe'
      })

      expect(result).toEqual(updatedUser)
      expect(storage.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingUser.id,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        })
      )
    })
  })

  describe('signUpOrSignInUser', () => {
    it('should link to existing system account', async () => {
      const systemUser = createMockUser({ 
        email: 'test@example.com',
        authProvider: 'system'
      })
      const linkedUser = { ...systemUser, authProvider: 'google' }
      
      vi.mocked(storage.getUserByEmail).mockResolvedValue(systemUser)
      vi.mocked(storage.upsertUser).mockResolvedValue(linkedUser)

      const result = await signUpOrSignInUser('test@example.com', {
        id: 'google-123',
        firstName: 'John',
        lastName: 'Doe',
        authProvider: 'google'
      })

      expect(result).toEqual(linkedUser)
      expect(storage.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: systemUser.id,
          authProvider: 'google'
        })
      )
    })

    it('should create new user if none exists', async () => {
      const newUser = createMockUser({ 
        email: 'new@example.com',
        authProvider: 'google'
      })
      
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined)
      vi.mocked(storage.upsertUser).mockResolvedValue(newUser)

      const result = await signUpOrSignInUser('new@example.com', {
        id: 'google-456',
        firstName: 'Jane',
        lastName: 'Doe',
        authProvider: 'google'
      })

      expect(result).toEqual(newUser)
      expect(storage.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'google-456',
          email: 'new@example.com',
          authProvider: 'google'
        })
      )
    })

    it('should return existing non-system user for sign-in', async () => {
      const existingUser = createMockUser({ 
        email: 'existing@example.com',
        authProvider: 'google'
      })
      
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingUser)

      const result = await signUpOrSignInUser('existing@example.com', {
        id: 'google-789',
        firstName: 'John',
        lastName: 'Doe',
        authProvider: 'google'
      })

      expect(result).toEqual(existingUser)
      expect(storage.upsertUser).not.toHaveBeenCalled()
    })
  })
})
