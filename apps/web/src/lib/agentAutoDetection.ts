import { AGENTS } from '@/config/agents';

// Keywords and patterns for detecting email intent
export interface DetectionPattern {
  agentId: string;
  keywords: string[];
  subjectPatterns: RegExp[];
  contentPatterns: RegExp[];
  attachmentTypes?: string[];
  priority: number; // Higher number = higher priority in case of conflicts
}

export const DETECTION_PATTERNS: DetectionPattern[] = [
  // Task Manager (Todo) - Project and task-related emails
  {
    agentId: 'todo',
    priority: 8,
    keywords: [
      'task', 'todo', 'deadline', 'priority', 'project', 'milestone', 'deliverable',
      'assign', 'responsible', 'due date', 'schedule', 'planning', 'roadmap',
      'backlog', 'sprint', 'kanban', 'workflow', 'progress', 'status update',
      'action item', 'checklist', 'requirement', 'scope', 'timeline'
    ],
    subjectPatterns: [
      /\[TASK\]/i,
      /\[PROJECT\]/i,
      /\[TODO\]/i,
      /action\s+required/i,
      /deadline/i,
      /due\s+date/i,
      /project\s+update/i,
      /milestone/i
    ],
    contentPatterns: [
      /need\s+to\s+(do|complete|finish)/i,
      /please\s+(complete|finish|work\s+on)/i,
      /deadline\s+is/i,
      /due\s+(on|by)/i,
      /assign(ed)?\s+to/i,
      /responsible\s+for/i,
      /priority\s+(high|medium|low)/i,
      /project\s+plan/i
    ]
  },

  // Poll Creator (formerly Polly) - Voting and decision-making emails
  {
    agentId: 'polly',
    priority: 9,
    keywords: [
      'poll', 'vote', 'survey', 'choice', 'option', 'decide', 'decision',
      'which', 'what time', 'when', 'where', 'prefer', 'opinion',
      'consensus', 'meeting time', 'feedback', 'selection', 'ballot'
    ],
    subjectPatterns: [
      /\[POLL\]/i,
      /\[VOTE\]/i,
      /which\s+(time|option|day)/i,
      /when\s+(should|can|do)/i,
      /meeting\s+time/i,
      /vote\s+on/i,
      /decision\s+needed/i
    ],
    contentPatterns: [
      /which\s+(option|time|day|choice)/i,
      /vote\s+(for|on)/i,
      /what\s+(time|day|option)/i,
      /when\s+(works|is\s+best)/i,
      /prefer(ence)?/i,
      /option\s+\d/i,
      /choice\s+[a-z]/i,
      /meeting\s+time/i,
      /please\s+(vote|choose|select)/i
    ]
  },

  // Document Analyzer (formerly Alex) - File and attachment analysis
  {
    agentId: 'alex',
    priority: 10, // Highest priority when attachments present
    keywords: [
      'attachment', 'document', 'file', 'pdf', 'analyze', 'review',
      'contract', 'report', 'proposal', 'specification', 'diagram',
      'spreadsheet', 'presentation', 'image', 'scan', 'upload'
    ],
    subjectPatterns: [
      /\[DOCUMENT\]/i,
      /\[ATTACHMENT\]/i,
      /please\s+review/i,
      /document\s+review/i,
      /contract\s+review/i,
      /file\s+analysis/i
    ],
    contentPatterns: [
      /attached\s+(file|document)/i,
      /please\s+(review|analyze)/i,
      /see\s+attached/i,
      /attachment\s+contains/i,
      /document\s+(review|analysis)/i,
      /file\s+(attached|included)/i
    ],
    attachmentTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.png', '.svg']
  },

  // Knowledge Base (FAQ) - Questions and help requests
  {
    agentId: 'faq',
    priority: 7,
    keywords: [
      'how', 'help', 'question', 'procedure', 'policy', 'sop', 'guide',
      'instruction', 'manual', 'documentation', 'explain', 'clarify',
      'process', 'step', 'guideline', 'standard', 'compliance'
    ],
    subjectPatterns: [
      /\[HELP\]/i,
      /\[FAQ\]/i,
      /\[QUESTION\]/i,
      /how\s+to/i,
      /help\s+with/i,
      /need\s+help/i,
      /procedure\s+for/i
    ],
    contentPatterns: [
      /how\s+(do|can)\s+i/i,
      /what\s+is\s+the\s+(process|procedure)/i,
      /need\s+(help|assistance)/i,
      /can\s+you\s+(help|explain)/i,
      /what\s+are\s+the\s+steps/i,
      /policy\s+(says|states)/i,
      /according\s+to\s+(sop|policy)/i
    ]
  },

  // Top 5 Things (formerly Tanya) - Analysis and reporting
  {
    agentId: 't5t',
    priority: 6,
    keywords: [
      'analysis', 'report', 'trend', 'insight', 'summary', 'overview',
      'metrics', 'data', 'analytics', 'dashboard', 'intelligence',
      'pattern', 'statistics', 'kpi', 'performance', 'issue', 'problem'
    ],
    subjectPatterns: [
      /\[ANALYSIS\]/i,
      /\[REPORT\]/i,
      /\[INSIGHT\]/i,
      /weekly\s+(report|analysis)/i,
      /trend\s+analysis/i,
      /performance\s+report/i
    ],
    contentPatterns: [
      /trend\s+(analysis|report)/i,
      /need\s+(insights|analysis)/i,
      /top\s+\d+/i,
      /most\s+(common|frequent)/i,
      /analyze\s+(trends|patterns)/i,
      /intelligence\s+report/i,
      /what\s+are\s+the\s+(main|top|key)/i
    ]
  },

  // Survey Creator (formerly Sally) - Feedback and surveys
  {
    agentId: 'sally',
    priority: 8,
    keywords: [
      'survey', 'feedback', 'satisfaction', 'rating', 'opinion',
      'employee', 'customer', 'sentiment', 'questionnaire', 'form',
      'evaluation', 'assessment', 'review', 'response', 'input'
    ],
    subjectPatterns: [
      /\[SURVEY\]/i,
      /\[FEEDBACK\]/i,
      /employee\s+(survey|feedback)/i,
      /customer\s+(satisfaction|feedback)/i,
      /feedback\s+request/i
    ],
    contentPatterns: [
      /(employee|customer|team)\s+(satisfaction|feedback)/i,
      /create\s+(survey|questionnaire)/i,
      /collect\s+feedback/i,
      /sentiment\s+analysis/i,
      /feedback\s+(form|survey)/i,
      /opinion\s+(survey|poll)/i
    ]
  }
];

export interface EmailContent {
  subject: string;
  body: string;
  attachments?: string[];
  recipients?: string[];
  cc?: string[];
}

export interface DetectionResult {
  agentId: string;
  confidence: number;
  reasons: string[];
  agent: any;
}

export function detectBestAgent(emailContent: EmailContent): DetectionResult {
  const results: Array<{ agentId: string; score: number; reasons: string[] }> = [];

  for (const pattern of DETECTION_PATTERNS) {
    let score = 0;
    const reasons: string[] = [];

    // Check subject line
    const subjectText = emailContent.subject.toLowerCase();
    pattern.subjectPatterns.forEach(regex => {
      if (regex.test(emailContent.subject)) {
        score += 15;
        reasons.push(`Subject matches ${pattern.agentId} pattern`);
      }
    });

    // Check content patterns
    const bodyText = emailContent.body.toLowerCase();
    pattern.contentPatterns.forEach(regex => {
      if (regex.test(emailContent.body)) {
        score += 12;
        reasons.push(`Content matches ${pattern.agentId} pattern`);
      }
    });

    // Check keywords in subject and body
    const fullText = `${subjectText} ${bodyText}`;
    pattern.keywords.forEach(keyword => {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 5;
        reasons.push(`Contains keyword: ${keyword}`);
      }
    });

    // Check attachments (bonus for Document Analyzer)
    if (pattern.attachmentTypes && emailContent.attachments && emailContent.attachments.length > 0) {
      const hasMatchingAttachment = emailContent.attachments.some(filename =>
        pattern.attachmentTypes!.some(ext => filename.toLowerCase().endsWith(ext))
      );
      if (hasMatchingAttachment) {
        score += 20;
        reasons.push(`Has relevant attachments`);
      }
    }

    // Apply priority weighting
    score = score * (pattern.priority / 10);

    if (score > 0) {
      results.push({ agentId: pattern.agentId, score, reasons });
    }
  }

  // Sort by score and return best match
  results.sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    // Default to Task Manager if no clear match
    const defaultAgent = AGENTS.find(a => a.id === 'todo');
    return {
      agentId: 'todo',
      confidence: 0.3,
      reasons: ['No clear match found, defaulting to Task Manager'],
      agent: defaultAgent
    };
  }

  const bestMatch = results[0];
  const agent = AGENTS.find(a => a.id === bestMatch.agentId);
  const confidence = Math.min(bestMatch.score / 50, 1); // Normalize to 0-1

  return {
    agentId: bestMatch.agentId,
    confidence,
    reasons: bestMatch.reasons.slice(0, 3), // Top 3 reasons
    agent
  };
}

export function getRoutingExplanation(result: DetectionResult): string {
  const agentName = result.agent?.name || result.agentId;
  const confidencePercent = Math.round(result.confidence * 100);

  if (result.confidence >= 0.8) {
    return `High confidence (${confidencePercent}%): This email appears to be perfect for ${agentName}. ${result.reasons[0]}.`;
  } else if (result.confidence >= 0.6) {
    return `Good match (${confidencePercent}%): This email seems suitable for ${agentName}. ${result.reasons[0]}.`;
  } else if (result.confidence >= 0.4) {
    return `Moderate match (${confidencePercent}%): ${agentName} might be appropriate. ${result.reasons[0]}.`;
  } else {
    return `Low confidence (${confidencePercent}%): Defaulting to ${agentName}. Consider being more specific about your request.`;
  }
}

// Example usage and test cases
export const TEST_CASES = [
  {
    name: 'Task Assignment',
    email: {
      subject: 'Project deadline approaching - action required',
      body: 'Hi team, we need to complete the following tasks by Friday: 1) Review code 2) Update documentation 3) Test features. Please assign yourselves and update progress.',
      attachments: [],
    },
    expectedAgent: 'todo'
  },
  {
    name: 'Meeting Poll',
    email: {
      subject: 'Which meeting time works best?',
      body: 'Hi everyone, we need to schedule our quarterly review. Which time works for you? Option A: Monday 2pm, Option B: Tuesday 10am, Option C: Wednesday 3pm. Please vote!',
      attachments: [],
    },
    expectedAgent: 'polly'
  },
  {
    name: 'Document Review',
    email: {
      subject: 'Please review attached contract',
      body: 'Hi legal team, please review the attached contract and provide feedback on the terms and conditions.',
      attachments: ['contract.pdf'],
    },
    expectedAgent: 'alex'
  },
  {
    name: 'Help Request',
    email: {
      subject: 'How to submit expense reports?',
      body: 'Hi HR, I need help understanding the process for submitting expense reports. What are the required documents and approval steps?',
      attachments: [],
    },
    expectedAgent: 'faq'
  },
  {
    name: 'Analysis Request',
    email: {
      subject: 'Weekly trend analysis needed',
      body: 'Can you provide insights on the top issues reported this week? Need to understand patterns and prioritize fixes.',
      attachments: [],
    },
    expectedAgent: 't5t'
  },
  {
    name: 'Survey Request',
    email: {
      subject: 'Employee satisfaction survey',
      body: 'We need to create a survey to collect feedback on employee satisfaction and work environment. Can you help design questions?',
      attachments: [],
    },
    expectedAgent: 'sally'
  }
];