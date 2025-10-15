import { Request, Response, NextFunction } from 'express';

// Extend the Request interface to include companyId
declare global {
  namespace Express {
    interface Request {
      companyId?: number;
    }
  }
}

/**
 * Middleware to extract company context from request headers or query parameters
 * This allows the frontend to specify which company context should be used for data isolation
 */
export function extractCompanyContext(req: Request, res: Response, next: NextFunction) {
  // Check for company ID in headers (preferred method)
  const companyIdHeader = req.headers['x-company-id'];
  const contextModeHeader = req.headers['x-context-mode'];
  
  // Check for company ID in query parameters (fallback)
  const companyIdQuery = req.query.companyId;
  
  let companyId: number | undefined;
  
  // If explicitly in individual mode, don't set company ID
  if (contextModeHeader === 'individual') {
    companyId = undefined;
    console.log(`🏢 [CONTEXT] Explicit individual mode for user`);
  } else if (companyIdHeader && typeof companyIdHeader === 'string') {
    const parsed = parseInt(companyIdHeader);
    if (!isNaN(parsed)) {
      companyId = parsed;
      console.log(`🏢 [CONTEXT] Company mode: ${companyId}`);
    }
  } else if (companyIdQuery && typeof companyIdQuery === 'string') {
    const parsed = parseInt(companyIdQuery);
    if (!isNaN(parsed)) {
      companyId = parsed;
      console.log(`🏢 [CONTEXT] Company mode (query): ${companyId}`);
    }
  }
  
  // Add company ID to request object
  req.companyId = companyId;
  
  next();
}

/**
 * Middleware to verify that the user has access to the specified company
 * Should be used after authentication middleware
 */
export async function verifyCompanyAccess(req: any, res: Response, next: NextFunction) {
  const { companyId } = req;
  const userId = req.user?.id;
  
  // If no company ID is specified, continue (individual mode)
  if (!companyId) {
    return next();
  }
  
  // If no user, this should have been caught by authentication middleware
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  try {
    const { storage } = await import('../storage');
    
    // Check if user has access to the specified company
    const membership = await storage.getCompanyMembership(companyId, userId);
    
    if (!membership || !membership.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }
    
    // Add membership info to request for potential use in route handlers
    req.companyMembership = membership;
    
    next();
  } catch (error) {
    console.error('Error verifying company access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify company access'
    });
  }
}

/**
 * Helper function to determine the effective company ID for queries
 * Returns the company ID if specified and user has access, otherwise null (individual mode)
 */
export function getEffectiveCompanyId(req: any): number | null {
  return req.companyId || null;
}

/**
 * Helper function to build company-scoped where conditions for database queries
 */
export function buildCompanyScopeCondition(req: any, userIdField: string = 'createdBy') {
  const companyId = getEffectiveCompanyId(req);
  const userId = req.user?.id;
  
  if (companyId) {
    // Company mode: return data for the specific company
    return {
      companyId: companyId
    };
  } else {
    // Individual mode: return data for the user where no company is specified
    return {
      [userIdField]: userId,
      companyId: null // Explicitly filter for individual data
    };
  }
}