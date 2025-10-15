import { faker } from '@faker-js/faker';

export interface GeneratedEmail {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  messageId: string;
  receivedAt: Date;
  type: string;
}

const SENDER_NAMES = [
  'Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Jessica Williams',
  'Alex Thompson', 'Maria Garcia', 'Robert Taylor', 'Ashley Brown', 'James Wilson',
  'Lisa Anderson', 'Kevin Martinez', 'Amanda Davis', 'Chris Lee', 'Nicole White',
  'Ryan Scott', 'Megan Clark', 'Daniel Lewis', 'Rachel Hall', 'Justin Young'
];

const COMPANY_DOMAINS = [
  'techcorp.com', 'innovategroup.com', 'digitalstudio.co', 'smartsolutions.net',
  'creativeworks.org', 'futuretech.io', 'nexuspartners.com', 'brightideas.co',
  'modernbusiness.net', 'agilecompany.com', 'globalventures.org', 'pinnacletech.io'
];

export class TestEmailGenerator {
  private getRandomSender(): { name: string; email: string } {
    const name = faker.helpers.arrayElement(SENDER_NAMES);
    const domain = faker.helpers.arrayElement(COMPANY_DOMAINS);
    const username = name.toLowerCase().replace(' ', '.');
    return {
      name,
      email: `${username}@${domain}`
    };
  }

  private generateTaskRequestEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const tasks = [
      'Update the quarterly sales report',
      'Review the new product specifications',
      'Organize team meeting for next week',
      'Prepare presentation for client meeting',
      'Analyze customer feedback from survey',
      'Set up new employee onboarding process',
      'Create documentation for API endpoints',
      'Schedule performance reviews',
      'Plan upcoming product launch campaign',
      'Coordinate with vendor for new equipment'
    ];

    const task = faker.helpers.arrayElement(tasks);
    const subject = customSubject ? `${customSubject} ${task}` : `Request: ${task}`;
    
    const textBody = `Hi there,

I hope this email finds you well. I wanted to reach out regarding a task that needs attention.

Task: ${task}

Details:
${faker.lorem.paragraphs(2, '\n\n')}

Timeline: ${faker.helpers.arrayElement(['This week', 'By Friday', 'ASAP', 'Next Monday', 'End of month'])}
Priority: ${faker.helpers.arrayElement(['High', 'Medium', 'Low', 'Urgent'])}

Please let me know if you need any additional information or have questions about this request.

Best regards,
${sender.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hi there,</p>
        <p>I hope this email finds you well. I wanted to reach out regarding a task that needs attention.</p>
        <h3 style="color: #2563eb;">Task: ${task}</h3>
        <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
          <h4>Details:</h4>
          ${faker.lorem.paragraphs(2, '<br><br>')}
        </div>
        <ul>
          <li><strong>Timeline:</strong> ${faker.helpers.arrayElement(['This week', 'By Friday', 'ASAP', 'Next Monday', 'End of month'])}</li>
          <li><strong>Priority:</strong> ${faker.helpers.arrayElement(['High', 'Medium', 'Low', 'Urgent'])}</li>
        </ul>
        <p>Please let me know if you need any additional information or have questions about this request.</p>
        <p>Best regards,<br>${sender.name}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  private generateTeamCollaborationEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const projects = [
      'Q4 Marketing Campaign',
      'Mobile App Redesign',
      'Customer Portal Upgrade',
      'Data Migration Project',
      'Website Performance Optimization',
      'New Product Development',
      'Team Collaboration Platform',
      'Security Audit Implementation',
      'Cloud Infrastructure Setup',
      'User Experience Research'
    ];

    const project = faker.helpers.arrayElement(projects);
    const subject = customSubject ? `${customSubject} Team Update: ${project}` : `Team Update: ${project}`;
    
    const textBody = `Team,

I wanted to share an update on our ${project} project and get everyone aligned on next steps.

Project Status:
${faker.lorem.paragraphs(1)}

What we've accomplished:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Next steps:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Team members involved: ${faker.helpers.arrayElements(SENDER_NAMES, 3).join(', ')}

Please review and let me know your thoughts by ${faker.date.soon({ days: 3 }).toLocaleDateString()}.

Looking forward to hearing from everyone!

Best,
${sender.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Team,</p>
        <p>I wanted to share an update on our <strong>${project}</strong> project and get everyone aligned on next steps.</p>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="color: #0369a1; margin-top: 0;">Project Status:</h3>
          <p>${faker.lorem.paragraphs(1)}</p>
        </div>

        <div style="display: flex; gap: 20px; margin: 20px 0;">
          <div style="flex: 1; background: #f0fdf4; padding: 15px; border-radius: 8px;">
            <h4 style="color: #166534; margin-top: 0;">✅ What we've accomplished:</h4>
            <ul>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
            </ul>
          </div>
          <div style="flex: 1; background: #fefce8; padding: 15px; border-radius: 8px;">
            <h4 style="color: #a16207; margin-top: 0;">🎯 Next steps:</h4>
            <ul>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
            </ul>
          </div>
        </div>

        <p><strong>Team members involved:</strong> ${faker.helpers.arrayElements(SENDER_NAMES, 3).join(', ')}</p>
        <p>Please review and let me know your thoughts by <strong>${faker.date.soon({ days: 3 }).toLocaleDateString()}</strong>.</p>
        <p>Looking forward to hearing from everyone!</p>
        <p>Best,<br>${sender.name}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  private generateQuestionInquiryEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const questions = [
      'How do I reset my password?',
      'What are the system requirements for the new software?',
      'Can you explain the refund policy?',
      'How do I access the team dashboard?',
      'What\'s the process for requesting time off?',
      'How do I update my billing information?',
      'Can someone help me with API integration?',
      'What are the available training sessions?',
      'How do I export my data?',
      'What\'s the difference between the Pro and Basic plans?'
    ];

    const question = faker.helpers.arrayElement(questions);
    const subject = customSubject ? `${customSubject} Question: ${question}` : `Question: ${question}`;
    
    const textBody = `Hi,

I hope you're doing well. I have a question that I'm hoping you can help me with.

${question}

Additional context:
${faker.lorem.paragraphs(1)}

I've already tried:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Any guidance would be greatly appreciated. Please let me know if you need any additional information from my end.

Thank you for your time!

Best regards,
${sender.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hi,</p>
        <p>I hope you're doing well. I have a question that I'm hoping you can help me with.</p>
        
        <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;">
          <h3 style="color: #92400e; margin-top: 0;">❓ ${question}</h3>
        </div>

        <p><strong>Additional context:</strong></p>
        <p>${faker.lorem.paragraphs(1)}</p>

        <p><strong>I've already tried:</strong></p>
        <ul>
          <li>${faker.lorem.sentence()}</li>
          <li>${faker.lorem.sentence()}</li>
        </ul>

        <p>Any guidance would be greatly appreciated. Please let me know if you need any additional information from my end.</p>
        <p>Thank you for your time!</p>
        <p>Best regards,<br>${sender.name}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  private generateUrgentIssueEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const issues = [
      'System is down and users can\'t login',
      'Payment processing is failing',
      'Website is loading extremely slowly',
      'Database connection errors',
      'Email notifications not being sent',
      'API returning 500 errors',
      'Security breach detected',
      'Server disk space at 98%',
      'Critical bug in production',
      'Multiple user reports of data loss'
    ];

    const issue = faker.helpers.arrayElement(issues);
    const subject = customSubject ? `${customSubject} URGENT: ${issue}` : `URGENT: ${issue}`;
    
    const textBody = `URGENT - Immediate attention required

${issue}

Impact: ${faker.helpers.arrayElement(['High', 'Critical', 'Severe'])}
Affected users: ${faker.helpers.arrayElement(['All users', '50+ users', 'Premium customers', 'Admin users'])}
Started: ${faker.date.recent({ days: 1 }).toLocaleTimeString()}

Description:
${faker.lorem.paragraphs(1)}

Error details:
${faker.lorem.sentence()}

Immediate action needed. Please prioritize this issue.

${sender.name}
${sender.email}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: #fecaca; padding: 20px; border: 2px solid #dc2626; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin-top: 0;">🚨 URGENT - Immediate attention required</h2>
          <h3 style="color: #991b1b;">${issue}</h3>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Impact:</strong> <span style="color: #dc2626;">${faker.helpers.arrayElement(['High', 'Critical', 'Severe'])}</span></li>
            <li><strong>Affected users:</strong> ${faker.helpers.arrayElement(['All users', '50+ users', 'Premium customers', 'Admin users'])}</li>
            <li><strong>Started:</strong> ${faker.date.recent({ days: 1 }).toLocaleTimeString()}</li>
          </ul>
        </div>

        <h4>Description:</h4>
        <p>${faker.lorem.paragraphs(1)}</p>

        <h4>Error details:</h4>
        <code style="background: #f1f5f9; padding: 10px; border-radius: 4px; display: block; margin: 10px 0;">
          ${faker.lorem.sentence()}
        </code>

        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #dc2626;">⚠️ Immediate action needed. Please prioritize this issue.</p>
        </div>

        <p>${sender.name}<br>${sender.email}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  private generateProjectUpdateEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const projects = [
      'E-commerce Platform Upgrade',
      'Mobile App Development',
      'Data Analytics Dashboard',
      'Customer Relationship Management',
      'Inventory Management System',
      'HR Portal Implementation',
      'Security Compliance Audit',
      'Cloud Migration Initiative',
      'API Integration Project',
      'User Experience Optimization'
    ];

    const project = faker.helpers.arrayElement(projects);
    const subject = customSubject ? `${customSubject} Project Update: ${project}` : `Project Update: ${project} - Week ${faker.number.int({ min: 1, max: 12 })}`;
    
    const textBody = `Hi everyone,

Here's this week's update for the ${project} project.

Progress Summary:
${faker.lorem.paragraphs(1)}

Milestones completed:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Current Status: ${faker.helpers.arrayElement(['On Track', 'Ahead of Schedule', 'Minor Delays', 'Blocked - Need Input'])}
Completion: ${faker.number.int({ min: 30, max: 95 })}%

Upcoming milestones:
- ${faker.lorem.sentence()} (Due: ${faker.date.soon({ days: 7 }).toLocaleDateString()})
- ${faker.lorem.sentence()} (Due: ${faker.date.soon({ days: 14 }).toLocaleDateString()})

Risks/Issues:
${faker.lorem.sentence()}

Next team meeting: ${faker.date.soon({ days: 5 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '2:00 PM', '10:30 AM', '3:30 PM'])}

Let me know if you have any questions or concerns.

Best,
${sender.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1f2937;">Project Update: ${project}</h2>
        <p style="color: #6b7280;">Week ${faker.number.int({ min: 1, max: 12 })} Status Report</p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📊 Progress Summary</h3>
          <p>${faker.lorem.paragraphs(1)}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px;">
            <h4 style="color: #065f46; margin-top: 0;">✅ Milestones completed:</h4>
            <ul>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
              <li>${faker.lorem.sentence()}</li>
            </ul>
          </div>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px;">
            <h4 style="color: #1e40af; margin-top: 0;">🎯 Status:</h4>
            <p><strong>Current Status:</strong> ${faker.helpers.arrayElement(['On Track', 'Ahead of Schedule', 'Minor Delays', 'Blocked - Need Input'])}</p>
            <p><strong>Completion:</strong> ${faker.number.int({ min: 30, max: 95 })}%</p>
          </div>
        </div>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #92400e; margin-top: 0;">🚀 Upcoming milestones:</h4>
          <ul>
            <li>${faker.lorem.sentence()} <em>(Due: ${faker.date.soon({ days: 7 }).toLocaleDateString()})</em></li>
            <li>${faker.lorem.sentence()} <em>(Due: ${faker.date.soon({ days: 14 }).toLocaleDateString()})</em></li>
          </ul>
        </div>

        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #991b1b; margin-top: 0;">⚠️ Risks/Issues:</h4>
          <p>${faker.lorem.sentence()}</p>
        </div>

        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 Next team meeting:</strong> ${faker.date.soon({ days: 5 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '2:00 PM', '10:30 AM', '3:30 PM'])}</p>
        </div>

        <p>Let me know if you have any questions or concerns.</p>
        <p>Best,<br>${sender.name}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  private generateMeetingScheduleEmail(customSubject?: string): Omit<GeneratedEmail, 'to' | 'type'> {
    const sender = this.getRandomSender();
    const meetingTypes = [
      'Weekly Team Standup',
      'Project Planning Session',
      'Quarterly Review Meeting',
      'Client Presentation',
      'One-on-One Check-in',
      'Department All-Hands',
      'Product Demo',
      'Strategy Planning Session',
      'Performance Review',
      'Budget Planning Meeting'
    ];

    const meetingType = faker.helpers.arrayElement(meetingTypes);
    const subject = customSubject ? `${customSubject} Meeting Request: ${meetingType}` : `Meeting Request: ${meetingType}`;
    
    const textBody = `Hi team,

I'd like to schedule a ${meetingType} for next week. Please let me know your availability.

Meeting Details:
- Topic: ${meetingType}
- Duration: ${faker.helpers.arrayElement(['30 minutes', '45 minutes', '1 hour', '1.5 hours', '2 hours'])}
- Format: ${faker.helpers.arrayElement(['In-person', 'Video call', 'Hybrid', 'Conference room'])}
- Attendees: ${faker.helpers.arrayElements(SENDER_NAMES, 4).join(', ')}

Proposed times:
- ${faker.date.soon({ days: 3 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}
- ${faker.date.soon({ days: 4 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}
- ${faker.date.soon({ days: 5 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}

Agenda:
1. ${faker.lorem.sentence()}
2. ${faker.lorem.sentence()}
3. ${faker.lorem.sentence()}

Please confirm your availability or suggest alternative times that work better for you.

Best regards,
${sender.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1f2937;">Meeting Request: ${meetingType}</h2>
        <p>Hi team,</p>
        <p>I'd like to schedule a <strong>${meetingType}</strong> for next week. Please let me know your availability.</p>

        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">📋 Meeting Details</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Topic:</strong> ${meetingType}</li>
            <li><strong>Duration:</strong> ${faker.helpers.arrayElement(['30 minutes', '45 minutes', '1 hour', '1.5 hours', '2 hours'])}</li>
            <li><strong>Format:</strong> ${faker.helpers.arrayElement(['In-person', 'Video call', 'Hybrid', 'Conference room'])}</li>
            <li><strong>Attendees:</strong> ${faker.helpers.arrayElements(SENDER_NAMES, 4).join(', ')}</li>
          </ul>
        </div>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin-top: 0;">🗓️ Proposed times:</h3>
          <ul>
            <li>${faker.date.soon({ days: 3 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}</li>
            <li>${faker.date.soon({ days: 4 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}</li>
            <li>${faker.date.soon({ days: 5 }).toLocaleDateString()} at ${faker.helpers.arrayElement(['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])}</li>
          </ul>
        </div>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #166534; margin-top: 0;">📝 Agenda:</h3>
          <ol>
            <li>${faker.lorem.sentence()}</li>
            <li>${faker.lorem.sentence()}</li>
            <li>${faker.lorem.sentence()}</li>
          </ol>
        </div>

        <p>Please confirm your availability or suggest alternative times that work better for you.</p>
        <p>Best regards,<br>${sender.name}</p>
      </div>
    `;

    return {
      from: `${sender.name} <${sender.email}>`,
      subject,
      textBody,
      htmlBody,
      messageId: `${faker.string.alphanumeric(10)}@${sender.email.split('@')[1]}`,
      receivedAt: faker.date.recent({ days: 7 })
    };
  }

  public generateEmail(
    type: string,
    targetEmail: string,
    customFromEmail?: string,
    customSubject?: string
  ): GeneratedEmail {
    let baseEmail: Omit<GeneratedEmail, 'to' | 'type'>;

    switch (type) {
      case 'task-request':
        baseEmail = this.generateTaskRequestEmail(customSubject);
        break;
      case 'team-collaboration':
        baseEmail = this.generateTeamCollaborationEmail(customSubject);
        break;
      case 'question-inquiry':
        baseEmail = this.generateQuestionInquiryEmail(customSubject);
        break;
      case 'urgent-issue':
        baseEmail = this.generateUrgentIssueEmail(customSubject);
        break;
      case 'project-update':
        baseEmail = this.generateProjectUpdateEmail(customSubject);
        break;
      case 'meeting-schedule':
        baseEmail = this.generateMeetingScheduleEmail(customSubject);
        break;
      default:
        baseEmail = this.generateTaskRequestEmail(customSubject);
    }

    // Override sender if custom email is provided
    if (customFromEmail) {
      const name = customFromEmail.split('@')[0].replace('.', ' ');
      baseEmail.from = `${name} <${customFromEmail}>`;
    }

    return {
      ...baseEmail,
      to: targetEmail,
      type
    };
  }

  public generateBulkEmails(
    count: number,
    types: string[],
    targetEmails: string[],
    customFromEmail?: string,
    customSubject?: string
  ): GeneratedEmail[] {
    const emails: GeneratedEmail[] = [];

    for (let i = 0; i < count; i++) {
      const randomType = faker.helpers.arrayElement(types);
      const randomTargetEmail = faker.helpers.arrayElement(targetEmails);
      
      emails.push(this.generateEmail(randomType, randomTargetEmail, customFromEmail, customSubject));
    }

    return emails;
  }
}