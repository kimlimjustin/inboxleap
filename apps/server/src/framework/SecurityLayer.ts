import { EmailData, VisibilityContext, CommandResult, IEmailCommand } from './interfaces.js';
import { storage } from '../storage.js';

// Security policy interfaces
export interface SecurityPolicy {
  name: string;
  description: string;
  priority: number; // Higher numbers = higher priority
  
  // Check if this policy should be applied to the current context
  shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean>;
  
  // Validate the request - return null if allowed, error message if blocked
  validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult>;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
  quarantine?: boolean; // If true, email should be quarantined for review
  rateLimit?: RateLimitInfo;
}

export interface RateLimitInfo {
  requestsAllowed: number;
  windowInSeconds: number;
  currentCount: number;
  resetAt: Date;
}

export interface AgentSecurityConfig {
  agentName: string;
  policies: string[]; // Names of policies to apply
  customSettings: Record<string, any>;
  maxRequestsPerHour?: number;
  trustedDomains?: string[];
  blockedDomains?: string[];
  requireTrust?: boolean; // Require explicit trust relationship
  allowSelfService?: boolean; // Allow users to interact without trust
}

// Built-in security policies
export class RateLimitPolicy implements SecurityPolicy {
  name = 'rate-limit';
  description = 'Limits requests per time window';
  priority = 100;

  private requestCounts = new Map<string, { count: number; resetAt: Date }>();

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    return true; // Apply to all agents
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    const maxRequests = config?.maxRequestsPerHour || 100;
    const windowMs = 60 * 60 * 1000; // 1 hour
    
    const key = `${email.from}:${agent}`;
    const now = new Date();
    
    let rateLimitInfo = this.requestCounts.get(key);
    
    // Reset if window has expired
    if (!rateLimitInfo || rateLimitInfo.resetAt < now) {
      rateLimitInfo = {
        count: 0,
        resetAt: new Date(now.getTime() + windowMs)
      };
    }
    
    rateLimitInfo.count++;
    this.requestCounts.set(key, rateLimitInfo);
    
    const allowed = rateLimitInfo.count <= maxRequests;
    
    return {
      allowed,
      reason: allowed ? undefined : `Rate limit exceeded: ${rateLimitInfo.count}/${maxRequests} requests per hour`,
      rateLimit: {
        requestsAllowed: maxRequests,
        windowInSeconds: 3600,
        currentCount: rateLimitInfo.count,
        resetAt: rateLimitInfo.resetAt
      }
    };
  }
}

export class TrustRelationshipPolicy implements SecurityPolicy {
  name = 'trust-relationship';
  description = 'Validates trust relationships between users';
  priority = 200;

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    return config?.requireTrust === true;
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    try {
      // Get or create user for sender
      let user = await storage.getUserByEmail(email.from);
      if (!user) {
        user = await storage.createUserFromEmail(email.from);
      }

      // Check if user has any trust relationships
      // This is a simplified check - in practice, you'd check trust with specific recipients
      const hasTrustRelationships = true; // Placeholder - implement actual trust check
      
      return {
        allowed: hasTrustRelationships,
        reason: hasTrustRelationships ? undefined : 'No trust relationship found. Please establish trust first.',
        quarantine: !hasTrustRelationships
      };
    } catch (error) {
      console.error('Error validating trust relationship:', error);
      return {
        allowed: false,
        reason: 'Unable to validate trust relationship',
        quarantine: true
      };
    }
  }
}

export class DomainWhitelistPolicy implements SecurityPolicy {
  name = 'domain-whitelist';
  description = 'Allows only whitelisted domains';
  priority = 150;

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    return (config?.trustedDomains?.length || 0) > 0;
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    const trustedDomains = config?.trustedDomains || [];
    
    const senderDomain = email.from.split('@')[1]?.toLowerCase();
    const allowed = trustedDomains.some(domain => 
      senderDomain === domain.toLowerCase() || 
      senderDomain?.endsWith('.' + domain.toLowerCase())
    );
    
    return {
      allowed,
      reason: allowed ? undefined : `Domain ${senderDomain} not in whitelist: ${trustedDomains.join(', ')}`
    };
  }
}

export class DomainBlacklistPolicy implements SecurityPolicy {
  name = 'domain-blacklist';
  description = 'Blocks blacklisted domains';
  priority = 300; // High priority to block early

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    return (config?.blockedDomains?.length || 0) > 0;
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    const config = await SecurityLayer.getInstance().getAgentConfig(agent);
    const blockedDomains = config?.blockedDomains || [];
    
    const senderDomain = email.from.split('@')[1]?.toLowerCase();
    const blocked = blockedDomains.some(domain => 
      senderDomain === domain.toLowerCase() || 
      senderDomain?.endsWith('.' + domain.toLowerCase())
    );
    
    return {
      allowed: !blocked,
      reason: blocked ? `Domain ${senderDomain} is blacklisted` : undefined
    };
  }
}

export class ContentScanningPolicy implements SecurityPolicy {
  name = 'content-scanning';
  description = 'Scans email content for suspicious patterns';
  priority = 75;

  private suspiciousPatterns = [
    /bitcoin|cryptocurrency|crypto/gi,
    /urgent.*transfer.*money/gi,
    /click.*link.*verify/gi,
    /suspended.*account/gi,
    /wire.*transfer.*immediately/gi
  ];

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    return true; // Apply basic content scanning to all agents
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    const content = `${email.subject} ${email.body}`;
    const suspiciousMatches = this.suspiciousPatterns.filter(pattern => pattern.test(content));
    
    if (suspiciousMatches.length > 0) {
      return {
        allowed: false,
        reason: 'Email flagged for suspicious content',
        quarantine: true,
        metadata: {
          matchedPatterns: suspiciousMatches.length,
          contentLength: content.length
        }
      };
    }
    
    return { allowed: true };
  }
}

// Main security layer class
export class SecurityLayer {
  private static instance: SecurityLayer;
  private policies: Map<string, SecurityPolicy> = new Map();
  private agentConfigs: Map<string, AgentSecurityConfig> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): SecurityLayer {
    if (!SecurityLayer.instance) {
      SecurityLayer.instance = new SecurityLayer();
    }
    return SecurityLayer.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🛡️  Initializing Security Layer...');

    // Register built-in policies
    await this.registerPolicy(new RateLimitPolicy());
    await this.registerPolicy(new TrustRelationshipPolicy());
    await this.registerPolicy(new DomainWhitelistPolicy());
    await this.registerPolicy(new DomainBlacklistPolicy());
    await this.registerPolicy(new ContentScanningPolicy());

    // Load agent security configurations
    await this.loadAgentConfigs();

    this.initialized = true;
    console.log('✅ Security Layer initialized');
  }

  async registerPolicy(policy: SecurityPolicy): Promise<void> {
    this.policies.set(policy.name, policy);
    console.log(`🔒 Registered security policy: ${policy.name}`);
  }

  async unregisterPolicy(name: string): Promise<boolean> {
    return this.policies.delete(name);
  }

  async setAgentConfig(config: AgentSecurityConfig): Promise<void> {
    this.agentConfigs.set(config.agentName, config);
    console.log(`🔧 Updated security config for agent: ${config.agentName}`);
  }

  getAgentConfig(agentName: string): AgentSecurityConfig | undefined {
    return this.agentConfigs.get(agentName);
  }

  async validateRequest(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    const config = this.getAgentConfig(agent);
    if (!config) {
      // Default permissive behavior for unconfigured agents
      return { allowed: true };
    }

    // Get applicable policies, sorted by priority (highest first)
    const applicablePolicies: SecurityPolicy[] = [];
    
    for (const policyName of config.policies) {
      const policy = this.policies.get(policyName);
      if (policy && await policy.shouldApply(email, context, agent)) {
        applicablePolicies.push(policy);
      }
    }
    
    applicablePolicies.sort((a, b) => b.priority - a.priority);

    // Validate against each applicable policy
    for (const policy of applicablePolicies) {
      const result = await policy.validate(email, context, agent);
      
      if (!result.allowed) {
        console.warn(`🚨 Security policy '${policy.name}' blocked request from ${email.from} to agent ${agent}: ${result.reason}`);
        return result;
      }
    }

    return { allowed: true };
  }

  // Create a secure wrapper for email commands
  createSecureCommand(agent: string, originalCommand: IEmailCommand): IEmailCommand {
    const securityLayer = this;
    
    return {
      ...originalCommand,
      
      async process(email: EmailData, context: VisibilityContext): Promise<CommandResult> {
        // Validate request through security layer
        const validationResult = await securityLayer.validateRequest(email, context, agent);
        
        if (!validationResult.allowed) {
          return {
            success: false,
            message: validationResult.reason || 'Request blocked by security policy',
            data: {
              securityBlock: true,
              quarantine: validationResult.quarantine,
              rateLimit: validationResult.rateLimit,
              metadata: validationResult.metadata
            }
          };
        }

        // If validation passes, execute original command
        try {
          const result = await originalCommand.process(email, context);
          
          // Log successful execution
          console.log(`✅ Security validation passed for ${agent} command from ${email.from}`);
          
          return result;
        } catch (error) {
          console.error(`❌ Error in secured command execution for ${agent}:`, error);
          throw error;
        }
      },

      async handleFollowup(followup: EmailData, originalContext: VisibilityContext): Promise<CommandResult> {
        // Also validate follow-ups
        const validationResult = await securityLayer.validateRequest(followup, originalContext, agent);
        
        if (!validationResult.allowed) {
          return {
            success: false,
            message: validationResult.reason || 'Follow-up blocked by security policy'
          };
        }

        return await originalCommand.handleFollowup(followup, originalContext);
      }
    };
  }

  private async loadAgentConfigs(): Promise<void> {
    // Default configurations for known agents
    const defaultConfigs: AgentSecurityConfig[] = [
      {
        agentName: 'todo',
        policies: ['rate-limit', 'content-scanning'],
        customSettings: {},
        maxRequestsPerHour: 50,
        allowSelfService: true
      },
      {
        agentName: 'alex',
        policies: ['rate-limit', 'content-scanning', 'trust-relationship'],
        customSettings: {},
        maxRequestsPerHour: 30,
        requireTrust: true,
        allowSelfService: false
      },
      {
        agentName: 't5t',
        policies: ['rate-limit', 'domain-whitelist', 'content-scanning'],
        customSettings: {},
        maxRequestsPerHour: 100,
        trustedDomains: [], // To be configured per deployment
        allowSelfService: true
      },
      {
        agentName: 'faq',
        policies: ['rate-limit', 'content-scanning'],
        customSettings: {},
        maxRequestsPerHour: 200,
        allowSelfService: true
      }
    ];

    for (const config of defaultConfigs) {
      this.agentConfigs.set(config.agentName, config);
    }

    // TODO: Load additional configs from database or configuration file
  }

  // Admin methods for managing security
  async getSecurityStats(): Promise<{
    policies: { name: string; description: string; priority: number }[];
    agents: { name: string; policies: string[]; config: AgentSecurityConfig }[];
    recentBlocks: any[]; // TODO: Implement block logging
  }> {
    return {
      policies: Array.from(this.policies.values()).map(p => ({
        name: p.name,
        description: p.description,
        priority: p.priority
      })),
      agents: Array.from(this.agentConfigs.entries()).map(([name, config]) => ({
        name,
        policies: config.policies,
        config
      })),
      recentBlocks: [] // TODO: Implement
    };
  }

  async updateAgentPolicies(agentName: string, policies: string[]): Promise<boolean> {
    const config = this.agentConfigs.get(agentName);
    if (!config) {
      return false;
    }

    config.policies = policies;
    this.agentConfigs.set(agentName, config);
    
    console.log(`🔄 Updated policies for ${agentName}: ${policies.join(', ')}`);
    return true;
  }
}

// Export singleton instance
export const securityLayer = SecurityLayer.getInstance();