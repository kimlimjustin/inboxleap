import { describe, it, expect } from 'vitest'
import { emailRouter } from '../src/services/email/EmailRouter'
import { createMockEmail, createMockIntelligenceEmail, createMockTaskEmail } from './helpers'

describe('EmailRouter', () => {
  describe('determineRouteByRecipient', () => {
    it('should route to intelligence for t5t+ emails', () => {
      const email = createMockIntelligenceEmail('acme-corp')
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('intelligence')
    })

    it('should route to intelligence for t5t emails', () => {
      const email = createMockEmail({ to: ['t5t@inboxleap.com'] })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('intelligence')
    })

    it('should route to intelligence for t5t emails', () => {
      const email = createMockEmail({ to: ['t5t@inboxleap.com'] })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('intelligence')
    })

    it('should route to task for todo emails', () => {
      const email = createMockEmail({ to: ['todo@inboxleap.com'] })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('task')
    })

    it('should route to task for todo emails', () => {
      const email = createMockEmail({ to: ['todo@inboxleap.com'] })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('task')
    })

    it('should route to load_balancer for agent emails', () => {
      const email = createMockTaskEmail() // uses agent@inboxleap.com
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('load_balancer')
    })

    it('should return null for non-inboxleap emails', () => {
      const email = createMockEmail({ to: ['user@example.com'] })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBeNull()
    })

    it('should handle CC recipients', () => {
      const email = createMockEmail({ 
        to: ['user@example.com'],
        cc: ['t5t+test-company@inboxleap.com']
      })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('intelligence')
    })

    it('should handle BCC recipients', () => {
      const email = createMockEmail({ 
        to: ['user@example.com'],
        bcc: ['todo@inboxleap.com']
      })
      const route = emailRouter.determineRouteByRecipient(email)
      expect(route).toBe('task')
    })
  })

  describe('extractCompanyIdFromEmail', () => {
    it('should extract company ID from t5t+ emails', () => {
      const companyId = emailRouter.extractCompanyIdFromEmail('t5t+acme-corp@inboxleap.com')
      expect(companyId).toBe('acme-corp')
    })

    it('should return null for non-t5t emails', () => {
      const companyId = emailRouter.extractCompanyIdFromEmail('agent@inboxleap.com')
      expect(companyId).toBeNull()
    })

    it('should return null for malformed t5t emails', () => {
      const companyId = emailRouter.extractCompanyIdFromEmail('t5t@inboxleap.com')
      expect(companyId).toBeNull()
    })

    it('should handle complex company IDs', () => {
      const companyId = emailRouter.extractCompanyIdFromEmail('t5t+big-corp-llc-2023@inboxleap.com')
      expect(companyId).toBe('big-corp-llc-2023')
    })

    it('should handle email addresses with display names', () => {
      const companyId = emailRouter.extractCompanyIdFromEmail('Tanya Agent <t5t+test-co@inboxleap.com>')
      expect(companyId).toBe('test-co')
    })
  })

  describe('isCompanyIntelligenceEmail', () => {
    it('should return true for t5t+ emails', () => {
      const isCompany = emailRouter.isCompanyIntelligenceEmail('t5t+company@inboxleap.com')
      expect(isCompany).toBe(true)
    })

    it('should return false for regular t5t emails', () => {
      const isCompany = emailRouter.isCompanyIntelligenceEmail('t5t@inboxleap.com')
      expect(isCompany).toBe(false)
    })

    it('should return false for non-inboxleap emails', () => {
      const isCompany = emailRouter.isCompanyIntelligenceEmail('test@example.com')
      expect(isCompany).toBe(false)
    })
  })

  describe('getCompanyIdFromEmailData', () => {
    it('should extract company ID from email data recipients', () => {
      const email = createMockIntelligenceEmail('acme-corp')
      const companyId = emailRouter.getCompanyIdFromEmailData(email)
      expect(companyId).toBe('acme-corp')
    })

    it('should return null if no company intelligence emails', () => {
      const email = createMockTaskEmail()
      const companyId = emailRouter.getCompanyIdFromEmailData(email)
      expect(companyId).toBeNull()
    })

    it('should find company ID in CC recipients', () => {
      const email = createMockEmail({
        to: ['user@example.com'],
        cc: ['t5t+test-company@inboxleap.com']
      })
      const companyId = emailRouter.getCompanyIdFromEmailData(email)
      expect(companyId).toBe('test-company')
    })

    it('should find company ID in BCC recipients', () => {
      const email = createMockEmail({
        to: ['user@example.com'],
        bcc: ['t5t+secret-corp@inboxleap.com']
      })
      const companyId = emailRouter.getCompanyIdFromEmailData(email)
      expect(companyId).toBe('secret-corp')
    })
  })

  describe('getTaskAgentEmails', () => {
    it('should return set of task agent emails', () => {
      const emails = emailRouter.getTaskAgentEmails()
      expect(emails.size).toBeGreaterThan(0)
      expect(emails.has('todo@inboxleap.com')).toBe(true)
      expect(emails.has('todo@inboxleap.com')).toBe(true)
      expect(emails.has('tasks@inboxleap.com')).toBe(true)
    })
  })

  describe('getIntelligenceAgentEmails', () => {
    it('should return set of intelligence agent emails', () => {
      const emails = emailRouter.getIntelligenceAgentEmails()
      expect(emails.size).toBeGreaterThan(0)
      expect(emails.has('t5t@inboxleap.com')).toBe(true)
      expect(emails.has('t5t@inboxleap.com')).toBe(true)
      expect(emails.has('intelligence@inboxleap.com')).toBe(true)
    })
  })
})
