import { z } from 'zod';

/**
 * Validation schemas for runtime type checking
 */

// Hierarchy relationship schema
const HierarchyRelationshipSchema = z.object({
  employee: z.string().email(),
  manager: z.string().email(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['cc', 'subject', 'ai_analysis']).optional(),
  lastSeen: z.string().optional()
});

// Department schema
const DepartmentSchema = z.object({
  name: z.string(),
  members: z.array(z.string().email()),
  managers: z.array(z.string().email()).optional(),
  lastSeen: z.string().optional(),
  source: z.enum(['subject_tag', 'ai_analysis']).optional()
});

// Hierarchy data schema
const HierarchyDataSchema = z.object({
  departments: z.record(DepartmentSchema).default({}),
  relationships: z.array(HierarchyRelationshipSchema).default([]),
  lastAnalyzed: z.string().optional(),
  analysisVersion: z.number().default(1)
});

// Polling agent settings schema
export const PollingAgentSettingsSchema = z.object({
  submissionFrequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  maxItems: z.number().min(1).max(20).default(5),
  autoAnalysis: z.boolean().default(true),
  emailDomain: z.string().default('inboxleap.com'),
  companySpecific: z.boolean().default(false),
  isDomainRestricted: z.boolean().default(false),
  allowedDomains: z.array(z.string()).default([]),
  hierarchyData: HierarchyDataSchema.default({
    departments: {},
    relationships: [],
    analysisVersion: 1
  }),
  // Allow additional properties for extensibility
  // This lets us add new settings without breaking existing data
}).passthrough();

export type PollingAgentSettings = z.infer<typeof PollingAgentSettingsSchema>;
export type HierarchyData = z.infer<typeof HierarchyDataSchema>;
export type HierarchyRelationship = z.infer<typeof HierarchyRelationshipSchema>;
export type Department = z.infer<typeof DepartmentSchema>;

/**
 * Safe parser for polling agent settings
 * Returns parsed settings or null on validation error
 */
export function parsePollingAgentSettings(settings: unknown): PollingAgentSettings | null {
  try {
    return PollingAgentSettingsSchema.parse(settings || {});
  } catch (error) {
    console.error('❌ Failed to parse polling agent settings:', error);
    return null;
  }
}