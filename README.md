# InboxLeap

A modern web application that converts emails into organized todo lists using AI. Features team collaboration, project management, intelligent task extraction, and multi-tenant intelligence agents.

## Architecture Overview

### Frontend Stack
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Session-based authentication with Google OAuth integration

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time Communication**: WebSocket support for live updates
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Session Management**: Express sessions with PostgreSQL storage
- **Email Processing**: IMAP/SMTP integration with intelligent routing
- **AI Integration**: Claude API for intelligent task extraction and analysis

### Database Design
- **ORM**: Drizzle ORM with PostgreSQL adapter
- **Database Provider**: Neon Database (serverless PostgreSQL) or self-hosted
- **Schema Location**: `packages/shared/schema.ts` for type-safe database operations
- **Migration Strategy**: Drizzle Kit for schema migrations
- **Multi-tenancy**: Company-based isolation with identity management

## Key Components

### Authentication System
- **Provider**: Google OAuth 2.0 with Passport.js
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **User Management**: Automatic user creation and profile management
- **Security**: HTTP-only cookies with secure session handling
- **Identity Management**: Support for multiple user identities per account

### Email Processing Pipeline
1. **Email Monitoring**:
   - IMAP connection for service and user email accounts
   - SMTP server for receiving emails directly
   - Real-time email parsing and routing

2. **Email Routing System** (`services/email/EmailRouter.ts`):
   - Intelligent recipient-based routing
   - Support for agent-specific emails (todo@, alex@, t5t@, polly@)
   - Company-specific agent routing (e.g., t5t+companyname@)
   - Load balancer routing for general inquiries

3. **AI Task Extraction**:
   - Claude AI analyzes emails and extracts actionable tasks
   - Context-aware project assignment
   - Priority and due date detection
   - Multi-document analysis support

4. **Agent System**:
   - **Todo Agent**: Task creation and management from emails
   - **T5T Agent**: Top-5-Things intelligence summaries
   - **Polly Agent**: Polling and survey management
   - **FAQ Agent**: Frequently asked questions handling
   - **Document Analysis Agent**: Attachment processing (currently being refactored)

5. **Notification System**:
   - Email notifications for task assignments
   - Trust-based notification filtering
   - Queue-based processing with retry logic
   - Postmark integration for reliable email delivery

### Intelligence System
- **Company Intelligence**: AI-powered email analysis and insights
- **Batch Processing**: Efficient processing of multiple emails
- **Fallback Handling**: Graceful degradation when AI is unavailable
- **S3 Email Backup**: Archival and processing of historical emails
- **Agent Management**: Per-company and per-identity agent configurations

### Project Management
- **Multi-project Support**: Users can organize tasks across multiple projects
- **Team Collaboration**: Project sharing and team member management
- **Identity-based Projects**: Support for different user identities (personal vs work)
- **Kanban Board**: Visual task management with drag-and-drop interface
- **Task Status Tracking**: Comprehensive task lifecycle management
- **Real-time Updates**: WebSocket-powered live collaboration

### Security Features
- **Agent Security Layer**: Rate limiting and access control for AI agents
- **Trust System**: User-to-user trust relationships for notifications
- **Opt-out Management**: Email unsubscribe and preference management
- **Blacklist Service**: Automated blocking of suspicious patterns
- **Audit Logging**: Comprehensive activity tracking and compliance

## Setup Instructions

### Prerequisites
- Node.js 18+ and pnpm
- PostgreSQL database (local or cloud)
- Google OAuth application credentials
- Email account for service email (Gmail or custom SMTP)
- Claude AI API key (required for AI features)
- AWS account (optional, for production deployment)

### Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/inboxleap

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
APP_URL=http://localhost:5000
DASHBOARD_URL=http://localhost:5000

# Session
SESSION_SECRET=your_random_session_secret_here

# Service Email (Required)
SERVICE_EMAIL=your-service-email@gmail.com
SERVICE_EMAIL_PASSWORD=your-app-password
SERVICE_IMAP_HOST=imap.gmail.com
SERVICE_IMAP_PORT=993
SERVICE_SMTP_HOST=smtp.gmail.com
SERVICE_SMTP_PORT=587

# Gmail Secondary Account (Optional)
GMAIL_EMAIL=another-email@gmail.com
GMAIL_EMAIL_PASSWORD=your-app-password
GMAIL_IMAP_HOST=imap.gmail.com
GMAIL_IMAP_PORT=993

# Claude AI (Required for AI features)
CLAUDE_API_KEY=your_claude_api_key_here

# Postmark (Optional, for better email delivery)
POSTMARK_SERVER_TOKEN=your_postmark_token
POSTMARK_FROM_EMAIL=noreply@inboxleap.com

# SMTP Server (for receiving emails)
SMTP_SERVER_PORT=2525
SMTP_SERVER_HOST=0.0.0.0
SMTP_USERS=user1:password1,user2:password2

# AWS (Optional, for production)
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your_account_id
```

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5000/api/auth/google/callback` (development)
   - `https://inboxleap.com/api/auth/google/callback` (production)
6. Copy Client ID and Client Secret to your `.env` file

### Installation & Development
```bash
# Install dependencies
pnpm install

# Run database migrations
cd apps/server
pnpm db:push

# Start development server (runs both frontend and backend)
pnpm dev
```

### Production Deployment

#### AWS ECS Deployment
See `aws/README.md` for detailed AWS deployment instructions using Terraform.

```bash
# Build Docker image
docker build -t inboxleap .

# Deploy to AWS ECS (using Terraform)
cd aws/terraform
terraform init
terraform apply
```

#### Manual Production Build
```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## File Structure

```
InboxLeap/
├── apps/
│   ├── server/              # Express.js backend
│   │   ├── src/
│   │   │   ├── agents/      # AI agent implementations
│   │   │   ├── framework/   # Security layer and interfaces
│   │   │   ├── routes/      # API route handlers
│   │   │   ├── services/    # Business logic services
│   │   │   │   ├── email/   # Email processing pipeline
│   │   │   │   ├── handlers/# Agent-specific handlers
│   │   │   │   └── queue/   # Background job processing
│   │   │   ├── storage/     # Database operations
│   │   │   └── index.ts     # Server entry point
│   │   └── migrations/      # Database migrations
│   └── web/                 # React frontend
│       └── src/
│           ├── components/  # Reusable UI components
│           ├── pages/       # Route components
│           └── lib/         # Utility functions
├── packages/
│   └── shared/              # Shared TypeScript definitions
│       └── schema.ts        # Database schema and types
├── aws/                     # AWS deployment configs
│   ├── terraform/           # Infrastructure as code
│   └── README.md           # Deployment guide
└── docs/                    # Documentation
```

## Core Features

### Email-to-Task Conversion
- **AI-powered Extraction**: Claude AI analyzes email content to extract actionable tasks
- **Smart Project Assignment**: Automatically categorizes tasks into relevant projects
- **Priority Detection**: Identifies task urgency from email context
- **Due Date Parsing**: Extracts deadlines from natural language
- **Multi-recipient Support**: Handles CC and BCC for team task distribution

### Intelligence Agents
- **T5T (Top-5-Things)**: Daily/weekly intelligence summaries
- **Custom Agents**: Company-specific intelligence routing
- **Batch Processing**: Efficient handling of multiple emails
- **Historical Analysis**: S3-backed email archive processing

### Project Management
- **Multi-project Workspaces**: Organize tasks across different contexts
- **Identity Support**: Separate personal and work identities
- **Team Collaboration**: Share projects with team members
- **Task Assignment**: Assign tasks with email notifications
- **Status Tracking**: Todo → In Progress → Done workflows

### User Experience
- **Google OAuth Login**: Secure authentication with Google accounts
- **Responsive Design**: Mobile-first UI that works on all devices
- **Dashboard Overview**: Quick stats and recent activity monitoring
- **Real-time Updates**: Live task updates via WebSocket
- **Trust System**: Control who can send you task notifications

### Company & Multi-tenancy
- **Company Management**: Create and manage company workspaces
- **Agent Instances**: Per-company AI agent configurations
- **Company Invitations**: Team member onboarding
- **Role-based Access**: Owner, admin, and member roles
- **Audit Logs**: Track all company activities

## Technical Features

### Email Processing
- **IMAP Monitoring**: Real-time email fetching from multiple accounts
- **SMTP Server**: Direct email reception on custom addresses
- **Email Routing**: Intelligent routing based on recipients
- **Reply Detection**: Thread-aware email processing
- **Opt-out Management**: Unsubscribe handling and preferences

### Security
- **OAuth 2.0**: Industry-standard authentication with Google
- **Session Security**: HTTP-only cookies with CSRF protection
- **Trust Relationships**: User-controlled notification filtering
- **Rate Limiting**: Protection against abuse and spam
- **Input Validation**: Server-side validation using Zod schemas
- **SQL Injection Protection**: Parameterized queries through Drizzle ORM

### Performance
- **Background Jobs**: Queue-based email processing
- **WebSocket Updates**: Real-time collaboration without polling
- **Database Indexing**: Optimized queries for fast retrieval
- **Connection Pooling**: Efficient database connections
- **Batch Processing**: Efficient handling of bulk operations

## AWS Deployment

InboxLeap is production-ready and deployed on AWS ECS. See `aws/README.md` for:
- Terraform infrastructure setup
- ECS task definitions
- RDS PostgreSQL configuration
- Application Load Balancer setup
- CloudWatch logging and monitoring
- Secrets management with AWS Systems Manager

## API Documentation

### Key Endpoints
- `POST /api/auth/google` - Google OAuth login
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/tasks/assigned` - Get assigned tasks
- `POST /api/email/test-processing` - Test email processing
- `GET /api/companies` - List user companies
- `POST /api/agent-instances` - Create AI agent instance

## Troubleshooting

### Email Not Processing
- Check IMAP/SMTP credentials in environment variables
- Verify email monitoring is started in server logs
- Check Claude API key is valid and has credits
- Review email routing logic in `services/email/EmailRouter.ts`

### Database Connection Issues
- Verify DATABASE_URL format is correct
- Check PostgreSQL is running and accessible
- Run migrations: `pnpm db:push`
- Check network connectivity and firewall rules

### Authentication Problems
- Verify Google OAuth credentials are correct
- Check redirect URIs match your configuration
- Ensure APP_URL matches your domain
- Clear browser cookies and try again

## Support

For issues, questions, or contributions, please open an issue on GitHub.
