/**
 * Check if an email address is a service email that should not be created as a user
 */
export function parseEmailAddress(input: string): string {
  // Extracts email from formats like: "Name <email@domain.com>" or returns the input as-is
  const match = input?.match(/<([^>]+)>/);
  return (match ? match[1] : input || '').trim();
}

export function isServiceEmail(email: string): boolean {
  const emailAddr = parseEmailAddress(email).toLowerCase();
  const domain = emailAddr.split('@')[1] || '';
  const localPart = emailAddr.split('@')[0] || '';
  
  // Only block system.internal domain completely
  if (domain === 'system.internal') {
    return true;
  }
  
  // For inboxleap.com, only block specific system emails, not agent emails
  if (domain === 'inboxleap.com') {
    const systemPrefixes = ['system', 'admin', 'support', 'service', 'notification'];
    return systemPrefixes.some(prefix => localPart.startsWith(prefix));
  }
  
  return false;
}

/**
 * Check if an email is a reply to a previous email
 */
export function isReplyEmail(subject: string): boolean {
  const lowerSubject = (subject || '').toLowerCase().trim();
  return (
    lowerSubject.startsWith('re:') ||
    lowerSubject.startsWith('reply:') ||
    lowerSubject.startsWith('fw:') ||
    lowerSubject.startsWith('fwd:') ||
    lowerSubject.includes('✅ tasks created from:')
  );
}

/**
 * Get ISO week number for a date
 */
export function getWeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get ISO week-year for a date (the year to which the ISO week belongs)
 */
export function getISOWeekYear(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Generate a week key string for the given date
 */
export function getWeekKey(date: Date = new Date()): string {
  // Use ISO week-year to avoid end/start of year week key mismatches
  return `${getISOWeekYear(date)}-W${getWeekNumber(date)}`;
}

/**
 * Day and Month keys for consistent cache/report periods
 */
export function getDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export type Period = 'day' | 'week' | 'month' | 'year';
export function getPeriodKey(period: Period, date: Date = new Date()): string {
  switch (period) {
    case 'day':
      return getDayKey(date);
    case 'week':
      return getWeekKey(date);
    case 'month':
      return getMonthKey(date);
    case 'year':
    default:
      return String(date.getFullYear());
  }
}

/**
 * Extract agent identifier from Tanya email address
 */
export function sanitizeIdentifier(id?: string, fallback: string = 'default'): string {
  const value = (id ?? fallback).toLowerCase().trim();
  return value.replace(/[^a-z0-9_-]+/g, '-');
}

export function extractT5TAgentIdentifier(email: string, fallback: string = 'default'): string {
  const emailAddr = parseEmailAddress(email).toLowerCase();
  const agentMatch = emailAddr.match(/^t5t(\+([^@]+))?@inboxleap\.com$/i);
  const identifier = agentMatch?.[2] || fallback;
  return sanitizeIdentifier(identifier, fallback);
}

/**
 * Determine importance level based on text content
 */
export function determineImportance(text: string): 'low' | 'medium' | 'high' {
  const highKeywords = ['critical', 'urgent', 'important', 'risk', 'security', 'deadline'];
  const lowKeywords = ['note', 'optional', 'suggestion', 'minor'];
  
  const lowerText = (text || '').toLowerCase();
  
  if (highKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'high';
  }
  
  if (lowKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'low';
  }
  
  return 'medium';
}

/**
 * Determine analysis type based on text content
 */
export function determineAnalysisType(text: string): string {
  const lowerText = (text || '').toLowerCase();
  
  if (lowerText.includes('data') || lowerText.includes('metric')) return 'data-analysis';
  if (lowerText.includes('risk') || lowerText.includes('security')) return 'risk-assessment';
  if (lowerText.includes('recommend') || lowerText.includes('suggest')) return 'recommendation';
  if (lowerText.includes('trend') || lowerText.includes('pattern')) return 'trend-analysis';
  if (lowerText.includes('document') || lowerText.includes('file')) return 'document-analysis';
  
  return 'general-analysis';
}

/**
 * Helpers for cache keys and participant counting
 */
export function buildTanyaCacheKey(agentId: string, period: Period, date: Date = new Date(), companyId?: string): string {
  const id = sanitizeIdentifier(agentId);
  const pk = getPeriodKey(period, date);
  return ['t5t', id, pk, companyId ? `c:${companyId}` : null].filter(Boolean).join(':');
}

export function uniqueParticipantCount(emails: string[]): number {
  const set = new Set<string>();
  for (const e of emails || []) {
    const addr = parseEmailAddress(e).toLowerCase();
    if (addr && !isServiceEmail(addr)) set.add(addr);
  }
  return set.size;
}
