import { Express } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../googleAuth';

export function registerCompanyIntelligenceRoutes(app: Express) {
  // Set up company intelligence (Tanya for a specific company)
  app.post('/api/company-intelligence/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { companyId, companyName, agentName, companyDescription, isDomainRestricted, allowedDomains, createSubCompany, parentCompanyId, companyType } = req.body;
      
      // AGENT-LEVEL SUB-COMPANY: Create sub-company with intelligence in one step
      if (createSubCompany && companyName) {
        const { quickCreateCompanyForAgent, getCompanyIntelligenceInstructions } = await import('../services/companyIntelligence');

        console.log(`🚀 [COMPANY-INTEL] Agent-level company creation: ${companyName}`);
        
        const result = await quickCreateCompanyForAgent(userId, {
          name: companyName,
          description: companyDescription,
          parentCompanyId: parentCompanyId,
          companyType: companyType || 'project',
          agentName: agentName
        });
        
        // If requires main company registration
        if (result.requiresMainCompany) {
          return res.status(422).json({
            success: false,
            requiresMainCompany: true,
            message: result.message,
            nextSteps: {
              registerMainCompany: '/api/companies/register',
              thenSetupIntelligence: '/api/company-intelligence/setup'
            }
          });
        }
        
        // If needs parent company selection
        if (result.availableParents) {
          return res.status(422).json({
            success: false,
            requiresParentSelection: true,
            message: result.message,
            availableParents: result.availableParents,
            instructions: 'Please specify parentCompanyId in your request to create the sub-company under a specific parent.'
          });
        }
        
        // If successful, return agent details
        const instructions = getCompanyIntelligenceInstructions(companyName, result.emailAddress!);
        
        return res.status(201).json({
          success: true,
          message: `Sub-company and intelligence setup completed for ${companyName}`,
          data: {
            agent: result.agent,
            emailAddress: result.emailAddress,
            companyId: result.companyId,
            companyName,
            isSubCompany: true,
            instructions: instructions.instructions,
            sampleEmail: instructions.sampleEmail
          }
        });
      }
      
      // NEW API: Use companyId if provided (preferred)
      if (companyId && typeof companyId === 'number') {
        const { setupCompanyIntelligence, getCompanyIntelligenceInstructions } = 
          await import('../services/companyIntelligence');
        
        console.log(`🏢 [COMPANY-INTEL] Setting up intelligence for company ID: ${companyId}`);
        
        const result = await setupCompanyIntelligence(userId, companyId, agentName);
        const instructions = getCompanyIntelligenceInstructions(result.agent.organizationName || 'Company', result.emailAddress);
        
        return res.status(201).json({
          success: true,
          message: `Intelligence setup completed for company`,
          data: {
            agent: result.agent,
            emailAddress: result.emailAddress,
            companyId: result.companyId,
            companyName: result.agent.organizationName,
            instructions: instructions.instructions,
            sampleEmail: instructions.sampleEmail
          }
        });
      }
      
      // LEGACY API: Use companyName (backward compatibility)
      if (!companyName || typeof companyName !== 'string') {
        return res.status(400).json({ 
          success: false,
          message: 'Either companyId (number) or companyName (string) is required. For new users, please register your company first at /api/companies/register' 
        });
      }
      
      if (isDomainRestricted !== undefined && typeof isDomainRestricted !== 'boolean') {
        return res.status(400).json({ message: 'isDomainRestricted must be a boolean' });
      }
      
      if (allowedDomains !== undefined && !Array.isArray(allowedDomains)) {
        return res.status(400).json({ message: 'allowedDomains must be an array of strings' });
      }
      
      if (allowedDomains && allowedDomains.some((domain: string) => typeof domain !== 'string' || !domain.includes('@'))) {
        return res.status(400).json({ message: 'allowedDomains must contain valid email domain strings starting with @' });
      }
      
      const { setupCompanyIntelligenceLegacy, validateCompanyName, getCompanyIntelligenceInstructions } = 
        await import('../services/companyIntelligence');
      
      const validation = validateCompanyName(companyName);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      console.log(`🏢 [COMPANY-INTEL] Legacy setup for company: ${companyName}`);
      
      const result = await setupCompanyIntelligenceLegacy(
        userId, 
        companyName, 
        companyDescription,
        isDomainRestricted,
        allowedDomains
      );
      
      // If company registration is required
      if (result.requiresCompanyRegistration) {
        return res.status(422).json({
          success: false,
          requiresCompanyRegistration: true,
          message: result.message,
          nextSteps: {
            registerCompany: '/api/companies/register',
            setupIntelligence: '/api/company-intelligence/setup'
          }
        });
      }
      
      // If successful, return agent details
      const instructions = getCompanyIntelligenceInstructions(companyName, result.emailAddress!);
      
      res.status(201).json({
        success: true,
        message: `Intelligence setup completed for ${companyName}`,
        data: {
          agent: result.agent,
          emailAddress: result.emailAddress,
          companyId: result.companyId,
          companyName,
          instructions: instructions.instructions,
          sampleEmail: instructions.sampleEmail
        }
      });
      
    } catch (error) {
      console.error('🚨 [COMPANY-INTEL] Error setting up company intelligence:', error);
      res.status(500).json({
        message: 'Failed to set up company intelligence',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get user's company intelligence agents
  app.get('/api/company-intelligence', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const { getUserCompanyIntelligence } = await import('../services/companyIntelligence');

      const companyAgents = await getUserCompanyIntelligence(userId);
      
      res.json({
        success: true,
        agents: companyAgents,
        count: companyAgents.length
      });
      
    } catch (error) {
      console.error('🚨 [COMPANY-INTEL] Error getting company intelligence:', error);
      res.status(500).json({
        message: 'Failed to get company intelligence',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Get company intelligence instructions
  app.get('/api/company-intelligence/:agentId/instructions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      
      const agent = await storage.getPollingAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Intelligence agent not found' });
      }
      
      const hasAccess = await storage.userHasAccessToPollingAgent(userId, agentId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this intelligence agent' });
      }
      
      if (!agent.organizationName || !agent.organizationId) {
        return res.status(400).json({ message: 'This is not a company-specific intelligence agent' });
      }
      
      const { getCompanyIntelligenceInstructions } = await import('../services/companyIntelligence');
      
      const instructions = getCompanyIntelligenceInstructions(agent.organizationName, agent.emailAddress);
      
      res.json({
        success: true,
        companyName: agent.organizationName,
        emailAddress: agent.emailAddress,
        instructions: instructions.instructions,
        sampleEmail: instructions.sampleEmail
      });
      
    } catch (error) {
      console.error('🚨 [COMPANY-INTEL] Error getting instructions:', error);
      res.status(500).json({
        message: 'Failed to get company intelligence instructions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
