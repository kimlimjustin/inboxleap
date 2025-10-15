import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSubCompany, getCompanyHierarchy } from '../src/services/companyRegistrationService';

// Mock storage
vi.mock('../src/storage', () => ({
  storage: {
    getUser: vi.fn(),
    getCompany: vi.fn(),
    createCompany: vi.fn(),
    createCompanyMembership: vi.fn(),
    getCompanyMemberships: vi.fn(),
    getCompaniesByIds: vi.fn(),
  },
}));

// Mock db for hierarchy queries
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    with: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  },
}));

describe('CompanyRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSubCompany', () => {
    it('should create a sub-company successfully', async () => {
      const { storage } = await import('../src/storage');
      
      // Mock user exists
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock parent company exists
      vi.mocked(storage.getCompany).mockResolvedValue({
        id: 1,
        name: 'Parent Company',
        description: 'Parent company description',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock company creation
      const mockSubCompany = {
        id: 2,
        name: 'Sub Company',
        description: 'Sub company description',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.mocked(storage.createCompany).mockResolvedValue(mockSubCompany);

      // Mock membership creation
      const mockMembership = {
        id: 1,
        userId: 'user123',
        companyId: 2,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      };
      vi.mocked(storage.createCompanyMembership).mockResolvedValue(mockMembership);

      const result = await createSubCompany('user123', 1, {
        name: 'Sub Company',
        description: 'Sub company description',
        companyType: 'subsidiary'
      });

      expect(result.company.name).toBe('Sub Company');
      expect(result.company.parentCompanyId).toBe(1);
      expect(result.company.companyType).toBe('subsidiary');
      expect(result.membership.role).toBe('admin');
      expect(storage.createCompany).toHaveBeenCalledWith({
        name: 'Sub Company',
        description: 'Sub company description',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123'
      });
    });

    it('should throw error when user does not exist', async () => {
      const { storage } = await import('../src/storage');
      
      vi.mocked(storage.getUser).mockResolvedValue(undefined);

      await expect(createSubCompany('nonexistent', 1, {
        name: 'Sub Company',
        companyType: 'subsidiary'
      })).rejects.toThrow('User not found');
    });

    it('should throw error when parent company does not exist', async () => {
      const { storage } = await import('../src/storage');
      
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      vi.mocked(storage.getCompany).mockResolvedValue(undefined);

      await expect(createSubCompany('user123', 999, {
        name: 'Sub Company',
        companyType: 'subsidiary'
      })).rejects.toThrow('Parent company not found');
    });

    it('should inherit parent company settings when requested', async () => {
      const { storage } = await import('../src/storage');
      
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Parent company with domain restrictions
      vi.mocked(storage.getCompany).mockResolvedValue({
        id: 1,
        name: 'Parent Company',
        description: 'Parent company description',
        domainRestrictions: { enabled: true, domains: ['example.com'] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const mockSubCompany = {
        id: 2,
        name: 'Sub Company',
        description: 'Sub company description',
        domainRestrictions: { enabled: true, domains: ['example.com'] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.mocked(storage.createCompany).mockResolvedValue(mockSubCompany);

      const mockMembership = {
        id: 1,
        userId: 'user123',
        companyId: 2,
        role: 'admin',
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date()
      };
      vi.mocked(storage.createCompanyMembership).mockResolvedValue(mockMembership);

      const result = await createSubCompany('user123', 1, {
        name: 'Sub Company',
        companyType: 'subsidiary',
        inheritParentSettings: true
      });

      expect(storage.createCompany).toHaveBeenCalledWith({
        name: 'Sub Company',
        domainRestrictions: { enabled: true, domains: ['example.com'] },
        parentCompanyId: 1,
        companyType: 'subsidiary',
        createdBy: 'user123'
      });
    });

    it('should validate company type', async () => {
      const { storage } = await import('../src/storage');
      
      vi.mocked(storage.getUser).mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: null,
        password: null,
        authProvider: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      vi.mocked(storage.getCompany).mockResolvedValue({
        id: 1,
        name: 'Parent Company',
        description: 'Parent company description',
        domainRestrictions: { enabled: false, domains: [] },
        parentCompanyId: null,
        companyType: 'main',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Test all valid company types
      const validTypes = ['subsidiary', 'division', 'project'] as const;
      
      for (const companyType of validTypes) {
        vi.mocked(storage.createCompany).mockResolvedValueOnce({
          id: 2,
          name: 'Test Company',
          description: null,
          domainRestrictions: { enabled: false, domains: [] },
          parentCompanyId: 1,
          companyType,
          createdBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        vi.mocked(storage.createCompanyMembership).mockResolvedValueOnce({
          id: 1,
          userId: 'user123',
          companyId: 2,
          role: 'admin',
          isActive: true,
          joinedAt: new Date(),
          updatedAt: new Date()
        });

        const result = await createSubCompany('user123', 1, {
          name: 'Test Company',
          companyType
        });

        expect(result.company.companyType).toBe(companyType);
      }
    });
  });

  describe('getCompanyHierarchy', () => {
    it('should return company hierarchy successfully', async () => {
      const { db } = await import('../src/db');
      
      // Mock hierarchy query results
      const mockHierarchy = [
        {
          id: 1,
          name: 'Parent Company',
          parent_company_id: null,
          company_type: 'main',
          level: 0,
          path: '1'
        },
        {
          id: 2,
          name: 'Subsidiary A',
          parent_company_id: 1,
          company_type: 'subsidiary',
          level: 1,
          path: '1.2'
        },
        {
          id: 3,
          name: 'Division B',
          parent_company_id: 2,
          company_type: 'division',
          level: 2,
          path: '1.2.3'
        }
      ];

      vi.mocked(db.execute).mockResolvedValue(mockHierarchy);

      const result = await getCompanyHierarchy(1);

      expect(result).toHaveProperty('rootCompany');
      expect(result).toHaveProperty('hierarchy');
      expect(result).toHaveProperty('totalCompanies');
      expect(result).toHaveProperty('maxDepth');

      expect(result.rootCompany.id).toBe(1);
      expect(result.rootCompany.name).toBe('Parent Company');
      expect(result.totalCompanies).toBe(3);
      expect(result.maxDepth).toBe(2);
      expect(Array.isArray(result.hierarchy)).toBe(true);
    });

    it('should handle single company (no hierarchy)', async () => {
      const { db } = await import('../src/db');
      
      // Mock single company result
      const mockHierarchy = [
        {
          id: 1,
          name: 'Single Company',
          parent_company_id: null,
          company_type: 'main',
          level: 0,
          path: '1'
        }
      ];

      vi.mocked(db.execute).mockResolvedValue(mockHierarchy);

      const result = await getCompanyHierarchy(1);

      expect(result.totalCompanies).toBe(1);
      expect(result.maxDepth).toBe(0);
      expect(result.hierarchy).toHaveLength(1);
    });

    it('should handle database errors gracefully', async () => {
      const { db } = await import('../src/db');
      
      vi.mocked(db.execute).mockRejectedValue(new Error('Database connection failed'));

      await expect(getCompanyHierarchy(1)).rejects.toThrow('Database connection failed');
    });

    it('should handle empty hierarchy results', async () => {
      const { db } = await import('../src/db');
      
      vi.mocked(db.execute).mockResolvedValue([]);

      const result = await getCompanyHierarchy(999);

      expect(result.totalCompanies).toBe(0);
      expect(result.maxDepth).toBe(0);
      expect(result.hierarchy).toHaveLength(0);
      expect(result.rootCompany).toBeNull();
    });

    it('should correctly calculate hierarchy depth', async () => {
      const { db } = await import('../src/db');
      
      // Mock deep hierarchy
      const mockHierarchy = [
        { id: 1, name: 'Root', parent_company_id: null, company_type: 'main', level: 0, path: '1' },
        { id: 2, name: 'L1-A', parent_company_id: 1, company_type: 'subsidiary', level: 1, path: '1.2' },
        { id: 3, name: 'L1-B', parent_company_id: 1, company_type: 'subsidiary', level: 1, path: '1.3' },
        { id: 4, name: 'L2-A', parent_company_id: 2, company_type: 'division', level: 2, path: '1.2.4' },
        { id: 5, name: 'L3-A', parent_company_id: 4, company_type: 'project', level: 3, path: '1.2.4.5' }
      ];

      vi.mocked(db.execute).mockResolvedValue(mockHierarchy);

      const result = await getCompanyHierarchy(1);

      expect(result.maxDepth).toBe(3);
      expect(result.totalCompanies).toBe(5);
    });

    it('should properly structure hierarchy tree', async () => {
      const { db } = await import('../src/db');
      
      const mockHierarchy = [
        { id: 1, name: 'Parent', parent_company_id: null, company_type: 'main', level: 0, path: '1' },
        { id: 2, name: 'Child A', parent_company_id: 1, company_type: 'subsidiary', level: 1, path: '1.2' },
        { id: 3, name: 'Child B', parent_company_id: 1, company_type: 'division', level: 1, path: '1.3' },
        { id: 4, name: 'Grandchild', parent_company_id: 2, company_type: 'project', level: 2, path: '1.2.4' }
      ];

      vi.mocked(db.execute).mockResolvedValue(mockHierarchy);

      const result = await getCompanyHierarchy(1);

      expect(result.hierarchy).toHaveLength(4);
      
      // Check root company
      const rootCompany = result.hierarchy.find(c => c.level === 0);
      expect(rootCompany?.name).toBe('Parent');
      
      // Check children
      const children = result.hierarchy.filter(c => c.level === 1);
      expect(children).toHaveLength(2);
      expect(children.map(c => c.name)).toContain('Child A');
      expect(children.map(c => c.name)).toContain('Child B');
      
      // Check grandchild
      const grandchild = result.hierarchy.find(c => c.level === 2);
      expect(grandchild?.name).toBe('Grandchild');
    });
  });
});