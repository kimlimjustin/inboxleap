import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/db', () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

describe('AgentInstanceService todo instance behaviour', () => {
  let AgentInstanceService: any;
  let db: any;

  const setupInsertMock = () => {
    const inserted: any[] = [];
    db.insert.mockReset();
    db.insert.mockImplementation(() => ({
      values: (value: any) => {
        inserted.push(value);
        return {
          returning: () => Promise.resolve([{ id: inserted.length, ...value }]),
        };
      },
    }));
    return inserted;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ AgentInstanceService } = await import('../src/services/agentInstanceService'));
    ({ db } = await import('../src/db'));
    db.select.mockReset();
  });

  it('always uses the shared todo inbox for every instance', async () => {
    const service = new AgentInstanceService();
    const inserted = setupInsertMock();

    const validateSpy = vi.spyOn(service as any, 'validateEmailUnique');
    const getUserInstancesSpy = vi.spyOn(service, 'getUserInstances');

    const first = await service.createInstance('user-1', 'todo', 'primary');
    const second = await service.createInstance('user-1', 'todo', 'team');

    expect(first.emailAddress).toBe('todo@inboxleap.com');
    expect(second.emailAddress).toBe('todo@inboxleap.com');
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(true);
    expect(inserted).toHaveLength(2);
    expect(inserted[0].emailAddress).toBe('todo@inboxleap.com');
    expect(inserted[1].emailAddress).toBe('todo@inboxleap.com');
    expect(validateSpy).not.toHaveBeenCalled();
    expect(getUserInstancesSpy).not.toHaveBeenCalled();
  });

  it('returns null when looking up the shared todo inbox by email', async () => {
    const service = new AgentInstanceService();
    db.select.mockImplementation(() => {
      throw new Error('should not query db for shared inbox');
    });

    await expect(service.getInstanceByEmailWithIdentity('todo@inboxleap.com')).resolves.toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('uses the shared inbox for the primary Tanya topic', async () => {
    const service = new AgentInstanceService();
    const inserted = setupInsertMock();

    vi.spyOn(service, 'getUserInstances').mockResolvedValue([]);
    vi.spyOn(service as any, 'generateDefaultEmail').mockResolvedValue('t5t@inboxleap.com');
    const customEmailSpy = vi.spyOn(service as any, 'generateCustomEmail').mockReturnValue('t5t+ops@inboxleap.com');
    const validateSpy = vi.spyOn(service as any, 'validateEmailUnique').mockResolvedValue(undefined);

    const result = await service.createInstance('user-2', 't5t', 'primary');

    expect(result.emailAddress).toBe('t5t@inboxleap.com');
    expect(result.isDefault).toBe(true);
    expect(customEmailSpy).not.toHaveBeenCalled();
    expect(validateSpy).not.toHaveBeenCalled();
    expect(inserted[0].isDefault).toBe(true);
  });

  it('generates unique emails for non-primary Tanya topics', async () => {
    const service = new AgentInstanceService();
    const inserted = setupInsertMock();

    vi.spyOn(service, 'getUserInstances').mockResolvedValue([]);
    const customEmailSpy = vi.spyOn(service as any, 'generateCustomEmail').mockReturnValue('t5t+ops@inboxleap.com');
    const validateSpy = vi.spyOn(service as any, 'validateEmailUnique').mockResolvedValue(undefined);

    const result = await service.createInstance('user-3', 't5t', 'ops');

    expect(result.emailAddress).toBe('t5t+ops@inboxleap.com');
    expect(result.isDefault).toBe(false);
    expect(customEmailSpy).toHaveBeenCalled();
    expect(validateSpy).toHaveBeenCalledWith('t5t+ops@inboxleap.com', undefined);
    expect(inserted[0].isDefault).toBe(false);
  });
});
