import { Brain, Users, FileText, MessageCircle, BarChart3, Vote, Paperclip, HelpCircle, Bot } from "lucide-react";

export interface Agent {
  id: string;
  name: string;
  type: string;
  email: string;
  description: string;
  status: 'Active' | 'Inactive';
  icon: any;
  color: string;
  category: 'teams' | 'intelligence';
  features: string[];
  exampleInput: string;
  exampleOutput: string;
  route?: string; // Dynamic route for agent-specific views
}

export const AGENTS: Agent[] = [
  // TEAMS CATEGORY - Work with teams (to/cc fields)
  {
    id: 'todo',
    name: 'Task Manager',
    type: 'Project Organization',
    email: 'todo@inboxleap.com',
    description: 'Extracts to-dos, priorities, and deadlines. Auto-assigns tasks to recipients and turns threads into project lists.',
    status: 'Active',
    icon: FileText,
    color: 'green',
    category: 'teams',
    route: '/todo',
    features: [
      'Extracts to-dos, priorities, and deadlines',
      'Auto-assigns tasks to recipients',
      'Turns threads into project lists'
    ],
    exampleInput: '"Email todo@inboxleap.com with project requirements and team members"',
    exampleOutput: 'Created project with 5 tasks, assigned to 3 team members with deadlines and priority levels.'
  },
  {
    id: 'polly',
    name: 'Poll Creator',
    type: 'Team Voting',
    email: 'polly@inboxleap.com',
    description: 'Creates polls from questions in your emails, collects votes and shares real-time results.',
    status: 'Active',
    icon: Vote,
    color: 'indigo',
    category: 'teams',
    route: '/teams/polly',
    features: [
      'Creates polls from questions in emails',
      'Collects votes from team members',
      'Shares real-time results'
    ],
    exampleInput: '"Which meeting time works best for everyone? Poll options: 9 AM, 1 PM, 3 PM"',
    exampleOutput: 'Poll created with 3 options, sent to 8 team members, results: 1 PM (4 votes), 9 AM (3 votes), 3 PM (1 vote)'
  },
  {
    id: 'alex',
    name: 'Document Analyzer',
    type: 'File Intelligence',
    email: 'alex@inboxleap.com',
    description: 'Analyzes attachments in email threads, extracts insights from documents, and creates summaries of shared files.',
    status: 'Active',
    icon: Paperclip,
    color: 'orange',
    category: 'teams',
    route: '/teams/alex',
    features: [
      'Analyzes document attachments',
      'Extracts insights from PDFs, images, and documents',
      'Creates summaries of shared files in thread'
    ],
    exampleInput: '"Email alex@inboxleap.com with project documents and team members CC\'d"',
    exampleOutput: 'Analyzed 3 attachments: contract.pdf (5 pages, key terms extracted), diagram.png (flowchart identified), requirements.docx (12 action items found)'
  },
  {
    id: 'faq',
    name: 'Knowledge Base',
    type: 'Company Documentation',
    email: 'faq@inboxleap.com',
    description: 'Maintains organization SOPs and documentation, answers team questions based on uploaded company knowledge base.',
    status: 'Active',
    icon: HelpCircle,
    color: 'cyan',
    category: 'teams',
    route: '/teams/faq',
    features: [
      'Upload and manage company SOPs and documentation',
      'Answers questions based on organization knowledge base',
      'Maintains searchable company procedures and policies'
    ],
    exampleInput: '"Email faq@inboxleap.com asking: How do I submit expense reports?"',
    exampleOutput: 'Based on your expense policy SOP: Submit reports via finance portal within 30 days, include receipts over $25, manager approval required for $500+.'
  },
  {
    id: 'agent',
    name: 'Auto Router',
    type: 'Smart Routing',
    email: 'agent@inboxleap.com',
    description: 'Automatically analyzes email content and routes to the most appropriate specialist agent based on context, keywords, and attachments.',
    status: 'Active',
    icon: Bot,
    color: 'gray',
    category: 'teams',
    route: '/agent',
    features: [
      'Content analysis and intent detection',
      'Automatic routing to specialist agents',
      'Confidence scoring and explanation'
    ],
    exampleInput: '"Email agent@inboxleap.com with any request - I\'ll figure out which specialist can help you best"',
    exampleOutput: 'Analyzed your email and routed to Task Manager (85% confidence) because it contains task assignments and deadlines.'
  },

  // INTELLIGENCE CATEGORY - Company-wide analysis
  {
    id: 't5t',
    name: 'Top 5 Things',
    type: 'Intelligence Analysis',
    email: 't5t@inboxleap.com',
    description: 'Identifies trending topics across all emails and prioritizes issues by frequency and urgency.',
    status: 'Active',
    icon: BarChart3,
    color: 'blue',
    category: 'intelligence',
    route: '/intelligence/t5t',
    features: [
      'Identifies trending topics across all emails',
      'Prioritizes issues by frequency and urgency',
      'Provides actionable insights'
    ],
    exampleInput: '"Email t5t@inboxleap.com, CC: manager@company.com, Subject: [SUPPORT] Weekly Analysis Request"',
    exampleOutput: 'Top 5 Things: 1) Login problems (23 emails), 2) Payment failures (18 emails), 3) Feature requests (12 emails), 4) Database slowdowns (8 emails), 5) UI feedback (6 emails)'
  },
  {
    id: 'sally',
    name: 'Survey Creator',
    type: 'Feedback Analysis',
    email: 'sally@inboxleap.com',
    description: 'Generates surveys from common email questions and analyzes sentiment across departments.',
    status: 'Active',
    icon: MessageCircle,
    color: 'purple',
    category: 'intelligence',
    features: [
      'Generates surveys from common email questions',
      'Analyzes sentiment across departments',
      'Provides comprehensive reporting'
    ],
    exampleInput: '"Survey about employee satisfaction and feedback collection"',
    exampleOutput: 'Survey sent to 150 employees, 87% response rate, sentiment analysis shows 76% positive feedback...'
  }
];

export const getAgentsByCategory = (category: 'teams' | 'intelligence') => {
  return AGENTS.filter(agent => agent.category === category);
};

export const getAgentById = (id: string) => {
  return AGENTS.find(agent => agent.id === id);
};

export const getTeamAgents = () => getAgentsByCategory('teams');
export const getIntelligenceAgents = () => getAgentsByCategory('intelligence');
