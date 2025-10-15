export type T5TReportKind = 'top5' | 'insights' | 'comprehensive';

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

class T5TCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private inProgress = new Set<string>();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 10) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  private key(agentId: number | string, period: string, kind: T5TReportKind): string {
    return `${kind}:${agentId}:${period}`;
  }

  get<T>(agentId: number | string, period: string, kind: T5TReportKind): { data: T | null; isStale: boolean } {
    const k = this.key(agentId, period, kind);
    const entry = this.cache.get(k);
    if (!entry) return { data: null, isStale: true };
    const isStale = Date.now() - entry.updatedAt > this.ttlMs;
    return { data: entry.data as T, isStale };
  }

  set<T>(agentId: number | string, period: string, kind: T5TReportKind, data: T): void {
    const k = this.key(agentId, period, kind);
    this.cache.set(k, { data, updatedAt: Date.now() });
  }

  markInProgress(agentId: number | string, period: string, kind: T5TReportKind): boolean {
    const k = this.key(agentId, period, kind);
    if (this.inProgress.has(k)) return false;
    this.inProgress.add(k);
    return true;
  }

  unmarkInProgress(agentId: number | string, period: string, kind: T5TReportKind): void {
    const k = this.key(agentId, period, kind);
    this.inProgress.delete(k);
  }

  shouldRefresh(agentId: number | string, period: string, kind: T5TReportKind): boolean {
    const k = this.key(agentId, period, kind);
    const entry = this.cache.get(k);
    if (this.inProgress.has(k)) return false;
    if (!entry) return true;
    return Date.now() - entry.updatedAt > this.ttlMs;
  }

  invalidate(agentId: number | string, period: string, kind: T5TReportKind): void {
    const k = this.key(agentId, period, kind);
    this.cache.delete(k);
    this.inProgress.delete(k);
  }

  invalidateAll(agentId: number | string, period: string): void {
    const kinds: T5TReportKind[] = ['top5', 'insights', 'comprehensive'];
    kinds.forEach(kind => this.invalidate(agentId, period, kind));
  }
}

export const t5tCache = new T5TCacheService(10);
