# Agent Security Layer Documentation

The Agent Security Layer provides extensible security policies for email agents in the InboxLeap system. This layer can be configured per agent to implement different security requirements.

## Overview

The security layer operates as a middleware between incoming email requests and agent processing, validating requests against configurable policies before allowing command execution.

## Architecture

### Core Components

1. **SecurityLayer** - Main coordinator that manages policies and agent configurations
2. **SecurityPolicy** - Individual security rules that can be applied to agents
3. **AgentSecurityConfig** - Per-agent configuration specifying which policies to apply
4. **Secure Command Wrapper** - Wraps agent commands to enforce security validation

### Built-in Security Policies

#### Rate Limit Policy
- **Name**: `rate-limit`
- **Priority**: 100
- **Purpose**: Limits requests per time window per sender
- **Configuration**: `maxRequestsPerHour` (default: 100)

```typescript
// Example: Limit to 50 requests per hour
{
  agentName: 'Todo',
  policies: ['rate-limit'],
  maxRequestsPerHour: 50
}
```

#### Trust Relationship Policy
- **Name**: `trust-relationship`
- **Priority**: 200
- **Purpose**: Requires explicit trust relationship between users
- **Configuration**: `requireTrust: true`

```typescript
// Example: Require trust for Alex agent
{
  agentName: 'alex',
  policies: ['trust-relationship'],
  requireTrust: true
}
```

#### Domain Whitelist Policy
- **Name**: `domain-whitelist`
- **Priority**: 150
- **Purpose**: Only allow emails from specified domains
- **Configuration**: `trustedDomains` array

```typescript
// Example: Only allow company domains
{
  agentName: 'tanya',
  policies: ['domain-whitelist'],
  trustedDomains: ['company.com', 'inboxleap.com']
}
```

#### Domain Blacklist Policy
- **Name**: `domain-blacklist`
- **Priority**: 300 (High priority)
- **Purpose**: Block emails from specified domains
- **Configuration**: `blockedDomains` array

```typescript
// Example: Block known spam domains
{
  agentName: 'faq',
  policies: ['domain-blacklist'],
  blockedDomains: ['spam.com', 'malicious.net']
}
```

#### Content Scanning Policy
- **Name**: `content-scanning`
- **Priority**: 75
- **Purpose**: Scan email content for suspicious patterns
- **Configuration**: Built-in patterns (extensible)

```typescript
// Example: Basic content scanning
{
  agentName: 'all-agents',
  policies: ['content-scanning']
}
```

## Configuration

### Agent Security Configuration

Each agent can be configured with specific security policies:

```typescript
interface AgentSecurityConfig {
  agentName: string;
  policies: string[];                    // Array of policy names to apply
  customSettings: Record<string, any>;   // Custom policy settings
  maxRequestsPerHour?: number;           // Rate limit setting
  trustedDomains?: string[];             // Whitelist domains
  blockedDomains?: string[];             // Blacklist domains
  requireTrust?: boolean;                // Trust requirement flag
  allowSelfService?: boolean;            // Self-service permission
}
```

### Default Configurations

The system comes with default configurations for known agents:

```typescript
// Todo (Task management agent)
{
  agentName: 'Todo',
  policies: ['rate-limit', 'content-scanning'],
  maxRequestsPerHour: 50,
  allowSelfService: true
}

// Alex (Document processing agent)
{
  agentName: 'alex',
  policies: ['rate-limit', 'content-scanning', 'trust-relationship'],
  maxRequestsPerHour: 30,
  requireTrust: true,
  allowSelfService: false
}

// Tanya (Intelligence agent)
{
  agentName: 'tanya',
  policies: ['rate-limit', 'domain-whitelist', 'content-scanning'],
  maxRequestsPerHour: 100,
  trustedDomains: [], // Configure per deployment
  allowSelfService: true
}

// FAQ (Knowledge base agent)
{
  agentName: 'faq',
  policies: ['rate-limit', 'content-scanning'],
  maxRequestsPerHour: 200,
  allowSelfService: true
}
```

## Usage

### Integrating with Plugin Registry

The security layer integrates with the plugin registry to automatically secure agent commands:

```typescript
// Register a plugin with security
await pluginRegistry.registerPlugin(
  myAgentCommand, 
  metadata, 
  'agent-name' // This enables security layer wrapping
);
```

### Manual Security Validation

You can manually validate requests using the security layer:

```typescript
const validationResult = await securityLayer.validateRequest(
  emailData, 
  visibilityContext, 
  'agent-name'
);

if (!validationResult.allowed) {
  console.log('Request blocked:', validationResult.reason);
  if (validationResult.quarantine) {
    // Handle quarantined email
  }
  return; // Block request
}

// Proceed with processing
```

### Creating Secure Command Wrappers

For custom implementations, you can create secure wrappers:

```typescript
const originalCommand = new MyAgentCommand();
const secureCommand = securityLayer.createSecureCommand('my-agent', originalCommand);

// The secure command will validate all requests automatically
const result = await secureCommand.process(email, context);
```

## Admin API Endpoints

The security layer provides admin endpoints for configuration management:

### Get Security Overview
```http
GET /api/admin/security/overview
```

Returns all policies, agent configurations, and recent security events.

### Get Agent Configuration
```http
GET /api/admin/security/agents/:agentName
```

Returns specific agent security configuration.

### Update Agent Configuration
```http
PUT /api/admin/security/agents/:agentName
Content-Type: application/json

{
  "policies": ["rate-limit", "domain-whitelist"],
  "maxRequestsPerHour": 25,
  "trustedDomains": ["company.com"],
  "requireTrust": true,
  "allowSelfService": false
}
```

### Update Agent Policies
```http
PATCH /api/admin/security/agents/:agentName/policies
Content-Type: application/json

{
  "policies": ["rate-limit", "content-scanning", "domain-blacklist"]
}
```

### Test Security Validation
```http
POST /api/admin/security/agents/:agentName/test
Content-Type: application/json

{
  "email": {
    "subject": "Test Email",
    "from": "test@example.com",
    "to": ["agent@inboxleap.com"],
    "body": "Test content"
  },
  "context": {
    "isTo": true,
    "isCc": false,
    "isBcc": false
  }
}
```

### Bulk Update Multiple Agents
```http
PATCH /api/admin/security/agents
Content-Type: application/json

{
  "agents": [
    {
      "agentName": "Todo",
      "policies": ["rate-limit", "content-scanning"]
    },
    {
      "agentName": "alex",
      "policies": ["rate-limit", "trust-relationship"]
    }
  ]
}
```

## Custom Security Policies

You can create custom security policies by implementing the `SecurityPolicy` interface:

```typescript
export class CustomSecurityPolicy implements SecurityPolicy {
  name = 'custom-policy';
  description = 'My custom security policy';
  priority = 120;

  async shouldApply(email: EmailData, context: VisibilityContext, agent: string): Promise<boolean> {
    // Return true if this policy should be applied
    return true;
  }

  async validate(email: EmailData, context: VisibilityContext, agent: string): Promise<ValidationResult> {
    // Implement your validation logic
    const allowed = /* your validation logic */;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Custom validation failed',
      quarantine: !allowed,
      metadata: { customData: 'example' }
    };
  }
}

// Register the custom policy
await securityLayer.registerPolicy(new CustomSecurityPolicy());
```

## Validation Results

Security validation returns a `ValidationResult` object:

```typescript
interface ValidationResult {
  allowed: boolean;           // Whether request is allowed
  reason?: string;           // Reason for blocking (if blocked)
  metadata?: Record<string, any>; // Additional data
  quarantine?: boolean;      // Should email be quarantined
  rateLimit?: RateLimitInfo; // Rate limiting information
}

interface RateLimitInfo {
  requestsAllowed: number;   // Total requests allowed
  windowInSeconds: number;   // Time window in seconds
  currentCount: number;      // Current request count
  resetAt: Date;            // When counter resets
}
```

## Monitoring and Logging

The security layer provides comprehensive logging:

- **Initialization**: Logs when policies and agents are registered
- **Validation**: Logs when requests are blocked with reasons
- **Configuration**: Logs when agent configurations are updated
- **Errors**: Logs validation errors and policy failures

Example logs:
```
🛡️  Security Layer initialized
🔒 Registered security policy: rate-limit
🔧 Updated security config for agent: Todo
🚨 Security policy 'rate-limit' blocked request from user@example.com to agent Todo: Rate limit exceeded: 51/50 requests per hour
✅ Security validation passed for Todo command from trusted@company.com
```

## Security Best Practices

### 1. Layer Multiple Policies
Combine different policies for defense in depth:

```typescript
{
  agentName: 'critical-agent',
  policies: [
    'domain-blacklist',    // Block known bad actors
    'domain-whitelist',    // Only allow trusted domains
    'trust-relationship',  // Require explicit trust
    'content-scanning',    // Scan for suspicious content
    'rate-limit'          // Prevent abuse
  ]
}
```

### 2. Configure Appropriate Rate Limits
Set rate limits based on agent functionality:
- FAQ agents: Higher limits (100-200/hour)
- Task agents: Medium limits (50-100/hour)  
- Sensitive agents: Lower limits (10-30/hour)

### 3. Use Domain Controls Strategically
- **Whitelist**: For internal/trusted agents
- **Blacklist**: For public-facing agents

### 4. Monitor Security Events
Regularly review security logs and blocked requests to identify:
- Potential attacks
- Misconfigured policies
- Users needing trust relationships

### 5. Test Configuration Changes
Use the test endpoint to validate policy changes before deployment:

```bash
curl -X POST /api/admin/security/agents/my-agent/test \
  -H "Content-Type: application/json" \
  -d '{
    "email": {"from": "test@example.com", "subject": "Test"},
    "context": {"isTo": true, "isCc": false, "isBcc": false}
  }'
```

## Integration with Existing Systems

### Trust Relationships
The security layer integrates with the existing trust system to validate user relationships.

### User Management
User creation and lookup are handled through the existing storage layer.

### Notification System
Security blocks can be integrated with the notification system to alert users about blocked requests.

### WebSocket Updates
Configuration changes can be broadcast via WebSocket for real-time updates.

## Troubleshooting

### Common Issues

#### 1. Requests Always Blocked
- Check if policies are too restrictive
- Verify agent configuration exists
- Check domain whitelist/blacklist settings

#### 2. Rate Limits Too Low
- Increase `maxRequestsPerHour` setting
- Consider different limits for different user tiers

#### 3. Trust Relationship Issues
- Verify trust relationships are properly established
- Check if `requireTrust` is set appropriately

#### 4. Content Scanning False Positives
- Review suspicious content patterns
- Consider customizing content scanning rules

### Debugging

Enable debug logging to see detailed security validation:

```typescript
// In development, log all validation results
const result = await securityLayer.validateRequest(email, context, agent);
console.log('Security validation result:', result);
```

### Testing Security Policies

Use the test framework to validate policies:

```typescript
// Test rate limiting
const email = createTestEmail();
const context = createTestContext();

for (let i = 0; i < 5; i++) {
  const result = await securityLayer.validateRequest(email, context, 'test-agent');
  console.log(`Request ${i + 1}:`, result.allowed);
}
```

This comprehensive security layer ensures that InboxLeap agents operate safely while maintaining flexibility for different use cases and security requirements.
