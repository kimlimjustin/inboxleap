import { storage } from '../storage.js';
import { notificationService } from '../services/agentNotificationService.js';
import { claudeService } from '../services/claudeService.js';
import { escapeHtml } from '../utils/escape.js';
import type { EmailData, CommandResult } from '../types/interfaces.js';

export class PollyAgent {
  public agentName = 'Polly';
  public agentType: 'team' = 'team';
  public description = 'Creates polls from questions in your emails, collects votes and shares real-time results.';
  
  // Agent configuration
  public serviceDomain = 'inboxleap.com';

  private emailDomain = `polly@${this.serviceDomain}`;

  /**
   * Determines if this agent should handle the given email
   */
  canHandle(email: EmailData): boolean {
    // Handle direct emails to polly@inboxleap.com
    if (email.to.some((addr: string) => addr.toLowerCase().includes('polly@'))) {
      return true;
    }

    // Handle reply emails for existing polls
    if (this.isReplyEmail(email) && email.subject?.toLowerCase().includes('poll')) {
      return true;
    }

    return false;
  }

  /**
   * Get list of emails this agent has already processed
   */
  getHandledEmails(): string[] {
    // Return empty array for now - could track processed message IDs
    return [];
  }

  /**
   * Main processing method for new poll creation emails
   */
  async process(email: EmailData): Promise<CommandResult> {
    console.log(`🗳️ [POLLY] Processing email from ${email.from}: "${email.subject}"`);

    try {
      // Check if this is a reply to existing poll
      if (this.isReplyEmail(email)) {
        return await this.handleVoteReply(email);
      }

      // Extract poll information using Claude AI
      const pollData = await this.extractPollFromEmail(email);
      
      if (!pollData.question || !pollData.options.length) {
        console.warn('🗳️ [POLLY] Could not extract valid poll from email');
        await this.sendErrorEmail(email, 'Unable to extract poll question and options from your email.');
        return {
          success: false,
          message: 'Unable to extract poll question and options from email',
          data: { email: email.messageId }
        };
      }

      // Create poll in database
      const poll = await this.createPoll(email, pollData);

      // Send confirmation email with voting link
      await this.sendPollCreatedEmail(email, poll, pollData);

      // Send voting invitations to all recipients
      await this.sendVotingInvitations(email, poll, pollData);

      console.log(`🗳️ [POLLY] Successfully created poll ${poll.id}: "${pollData.question}"`);

      return {
        success: true,
        message: `Poll "${pollData.question}" created successfully`,
        data: { 
          pollId: poll.id, 
          question: pollData.question,
          optionsCount: pollData.options.length,
          invitationsSent: [...email.to, ...email.cc].filter(addr => !addr.toLowerCase().includes('polly@')).length
        }
      };

    } catch (error) {
      console.error('🗳️ [POLLY] Error processing email:', error);
      await this.sendErrorEmail(email, 'An error occurred while creating your poll. Please try again.');
      return {
        success: false,
        message: 'Error processing poll creation email',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Handle follow-up interactions (reply emails with votes)
   */
  async handleFollowup(email: EmailData): Promise<CommandResult> {
    console.log(`🗳️ [POLLY] Handling follow-up email from ${email.from}`);
    return await this.handleVoteReply(email);
  }

  /**
   * Extract poll information from email using Claude AI
   */
  private async extractPollFromEmail(email: EmailData): Promise<{
    question: string;
    options: { id: string; text: string; order: number }[];
    type: 'single_choice' | 'multiple_choice';
    expiresInDays?: number;
    isAnonymous?: boolean;
  }> {
    const prompt = `
Extract poll information from this email:

Subject: ${email.subject}
Body: ${email.body}

Please extract:
1. The main poll question
2. The voting options (A, B, C, etc. or numbered options)
3. Whether it's single or multiple choice (default to single)
4. If there's an expiration mentioned

Return a JSON object with this structure:
{
  "question": "the poll question",
  "options": [
    {"id": "1", "text": "Option A text", "order": 1},
    {"id": "2", "text": "Option B text", "order": 2}
  ],
  "type": "single_choice" | "multiple_choice",
  "expiresInDays": number or null,
  "isAnonymous": boolean (default false)
}

Examples of poll formats to look for:
- "What's your preference? A) Option 1 B) Option 2 C) Option 3"
- "Which meeting time works? 1. 9 AM 2. 1 PM 3. 3 PM"
- "Pick your favorites (multiple choice): Red, Blue, Green, Yellow"
- "Vote by replying with your choice..."
`;

    try {
      const response = await claudeService.sendMessage(prompt);
      const pollData = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      
      return {
        question: pollData.question || '',
        options: Array.isArray(pollData.options) ? pollData.options : [],
        type: pollData.type || 'single_choice',
        expiresInDays: pollData.expiresInDays || null,
        isAnonymous: pollData.isAnonymous || false
      };
    } catch (error) {
      console.error('🗳️ [POLLY] Error extracting poll data:', error);
      return {
        question: '',
        options: [],
        type: 'single_choice'
      };
    }
  }

  /**
   * Create poll in database
   */
  private async createPoll(email: EmailData, pollData: any): Promise<any> {
    const userId = await this.getOrCreateUser(email.from);
    
    // Try to find associated project based on recipients
    let projectId = null;
    if (email.to.length > 1 || email.cc.length > 0) {
      // Get all participants (excluding polly email)
      const participants = [...email.to, ...email.cc]
        .filter(addr => !addr.toLowerCase().includes('polly@'))
        .map(addr => addr.toLowerCase().trim());
      
      if (participants.length > 0) {
        const project = await storage.findProjectByTopicAndParticipants(
          email.subject || 'Poll Project', 
          participants
        );
        projectId = project?.id || null;
      }
    }

    // Calculate expiration date
    let expiresAt = null;
    if (pollData.expiresInDays && typeof pollData.expiresInDays === 'number') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + pollData.expiresInDays);
    }

    return await storage.createPoll({
      title: pollData.question,
      description: `Poll created from email: "${email.subject}"`,
      type: pollData.type,
      options: pollData.options,
      createdBy: userId,
      projectId,
      isAnonymous: pollData.isAnonymous || false,
      allowMultipleVotes: false, // Could be enhanced later
      expiresAt,
      status: 'active',
      emailMessageId: email.messageId
    });
  }

  /**
   * Handle vote replies
   */
  private async handleVoteReply(email: EmailData): Promise<CommandResult> {
    try {
      // Find the original poll based on email thread or subject
      const originalPoll = await this.findOriginalPoll(email);
      
      if (!originalPoll) {
        console.warn('🗳️ [POLLY] Could not find original poll for reply');
        await this.sendErrorEmail(email, 'Could not find the original poll. Please vote using the web link.');
        return {
          success: false,
          message: 'Could not find original poll for vote reply',
          data: { email: email.messageId }
        };
      }

      // Extract vote choice from email
      const voteChoice = await this.extractVoteFromReply(email, originalPoll);
      
      if (!voteChoice.selectedOptions.length) {
        console.warn('🗳️ [POLLY] Could not extract vote choice from reply');
        await this.sendErrorEmail(email, 'Could not understand your vote. Please use the voting options provided.');
        return {
          success: false,
          message: 'Could not understand vote choice from email',
          data: { email: email.messageId, pollId: originalPoll.id }
        };
      }

      // Check if user can vote
      const userId = await this.getOrCreateUser(email.from);
      const canVote = await storage.canUserVote(originalPoll.id, userId);
      
      if (!canVote) {
        await this.sendErrorEmail(email, 'You have already voted in this poll or the poll is no longer active.');
        return {
          success: false,
          message: 'User cannot vote (already voted or poll inactive)',
          data: { email: email.messageId, pollId: originalPoll.id, userId }
        };
      }

      // Record vote
      const vote = await storage.createVote({
        pollId: originalPoll.id,
        userId,
        selectedOptions: voteChoice.selectedOptions,
        comment: voteChoice.comment || null
      });

      // Send vote confirmation
      await this.sendVoteConfirmationEmail(email, originalPoll, voteChoice);

      // Optionally broadcast results to interested parties
      await this.broadcastResultsUpdate(originalPoll);

      console.log(`🗳️ [POLLY] Recorded vote from ${email.from} for poll ${originalPoll.id}`);

      return {
        success: true,
        message: `Vote recorded successfully for poll "${originalPoll.title}"`,
        data: {
          pollId: originalPoll.id,
          voteId: vote.id,
          selectedOptions: voteChoice.selectedOptions,
          voter: email.from
        }
      };

    } catch (error) {
      console.error('🗳️ [POLLY] Error handling vote reply:', error);
      await this.sendErrorEmail(email, 'An error occurred while recording your vote. Please try again.');
      return {
        success: false,
        message: 'Error processing vote reply',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Find original poll from reply email
   */
  private async findOriginalPoll(email: EmailData): Promise<any> {
    // Try to find by message ID reference
    if (email.inReplyTo) {
      const poll = await storage.getPollByMessageId(email.inReplyTo);
      if (poll) return poll;
    }

    // Try to extract poll ID from subject
    const pollIdMatch = email.subject?.match(/poll #?(\d+)/i);
    if (pollIdMatch) {
      const pollId = parseInt(pollIdMatch[1]);
      return await storage.getPoll(pollId);
    }

    return null;
  }

  /**
   * Extract vote choice from reply email
   */
  private async extractVoteFromReply(email: EmailData, poll: any): Promise<{
    selectedOptions: string[];
    comment?: string;
  }> {
    const prompt = `
Extract the vote choice from this reply email for the poll:

Poll Question: ${poll.title}
Options: ${JSON.stringify(poll.options)}

Email Body: ${email.body}

The user might have replied with:
- A letter (A, B, C)
- A number (1, 2, 3)  
- The option text directly
- Multiple choices if it's a multiple choice poll

Return JSON:
{
  "selectedOptions": ["option_id1", "option_id2"],
  "comment": "any additional comment"
}
`;

    try {
      const response = await claudeService.sendMessage(prompt);
      const voteData = JSON.parse(response.replace(/```json\n?|\n?```/g, ''));
      
      return {
        selectedOptions: Array.isArray(voteData.selectedOptions) ? voteData.selectedOptions : [],
        comment: voteData.comment || null
      };
    } catch (error) {
      console.error('🗳️ [POLLY] Error extracting vote:', error);
      return { selectedOptions: [] };
    }
  }

  /**
   * Send poll created confirmation email
   */
  private async sendPollCreatedEmail(email: EmailData, poll: any, pollData: any): Promise<void> {
    const pollLink = `${process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com'}/teams/polly?poll=${poll.id}`;
    
    const optionsList = pollData.options
      .map((opt: any) => `${opt.id}. ${escapeHtml(opt.text)}`)
      .join('<br>');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .poll-question { font-size: 20px; font-weight: bold; margin: 20px 0; color: #1f2937; }
    .options { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .vote-button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .instructions { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; font-size: 12px; color: #6b7280; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🗳️ Poll Created Successfully!</h1>
  </div>
  
  <div class="content">
    <div class="poll-question">
      ${escapeHtml(pollData.question)}
    </div>
    
    <div class="options">
      <strong>Voting Options:</strong><br>
      ${optionsList}
    </div>
    
    <div class="instructions">
      <strong>How to Vote:</strong><br>
      • Click the button below to vote online<br>
      • Or reply to this email with your choice (e.g., "A" or "1")<br>
      • Share this poll with others by forwarding this email
    </div>
    
    <div style="text-align: center;">
      <a href="${pollLink}" class="vote-button">Vote Now</a>
    </div>
    
    <p><strong>Poll Details:</strong></p>
    <ul>
      <li>Type: ${poll.type === 'single_choice' ? 'Single Choice' : 'Multiple Choice'}</li>
      <li>Anonymous: ${poll.isAnonymous ? 'Yes' : 'No'}</li>
      ${poll.expiresAt ? `<li>Expires: ${poll.expiresAt.toLocaleDateString()}</li>` : ''}
    </ul>
  </div>
  
  <div class="footer">
    <p>🤖 Generated with <a href="https://claude.ai/code">Claude Code</a></p>
    <p>Co-Authored-By: Claude &lt;noreply@anthropic.com&gt;</p>
  </div>
</body>
</html>`;

    await notificationService.sendEmail({
      to: email.from,
      subject: `Poll Created: ${escapeHtml(pollData.question)}`,
      html: htmlContent,
      text: `Poll Created: ${pollData.question}\n\nVote at: ${pollLink}\n\nOr reply with your choice.`
    });
  }

  /**
   * Send voting invitations to all recipients
   */
  private async sendVotingInvitations(email: EmailData, poll: any, pollData: any): Promise<void> {
    const pollLink = `${process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com'}/teams/polly?poll=${poll.id}`;
    
    // Get all recipients (excluding polly and sender)
    const recipients = [...email.to, ...email.cc]
      .filter(addr => 
        !addr.toLowerCase().includes('polly@') && 
        addr.toLowerCase() !== email.from.toLowerCase()
      );

    if (recipients.length === 0) return;

    const optionsList = pollData.options
      .map((opt: any) => `${opt.id}. ${escapeHtml(opt.text)}`)
      .join('<br>');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .poll-question { font-size: 20px; font-weight: bold; margin: 20px 0; color: #1f2937; }
    .options { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .vote-button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; font-size: 12px; color: #6b7280; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🗳️ You're Invited to Vote!</h1>
  </div>
  
  <div class="content">
    <p><strong>${escapeHtml(email.from)}</strong> has invited you to vote in this poll:</p>
    
    <div class="poll-question">
      ${escapeHtml(pollData.question)}
    </div>
    
    <div class="options">
      <strong>Your Options:</strong><br>
      ${optionsList}
    </div>
    
    <div style="text-align: center;">
      <a href="${pollLink}" class="vote-button">Cast Your Vote</a>
    </div>
    
    <p><em>You can also vote by replying to this email with your choice (e.g., "A", "1", or the option text).</em></p>
  </div>
  
  <div class="footer">
    <p>🤖 Generated with <a href="https://claude.ai/code">Claude Code</a></p>
  </div>
</body>
</html>`;

    // Send to all recipients
    for (const recipient of recipients) {
      try {
        await notificationService.sendEmail({
          to: recipient,
          subject: `Vote: ${escapeHtml(pollData.question)}`,
          html: htmlContent,
          text: `You've been invited to vote!\n\nQuestion: ${pollData.question}\n\nVote at: ${pollLink}\n\nOr reply with your choice.`
        });
      } catch (error) {
        console.error(`🗳️ [POLLY] Error sending invitation to ${recipient}:`, error);
      }
    }

    console.log(`🗳️ [POLLY] Sent voting invitations to ${recipients.length} recipients`);
  }

  /**
   * Send vote confirmation email
   */
  private async sendVoteConfirmationEmail(email: EmailData, poll: any, voteChoice: any): Promise<void> {
    const pollLink = `${process.env.DASHBOARD_URL || process.env.APP_URL || 'https://inboxleap.com'}/teams/polly?poll=${poll.id}`;
    
    // Get poll results
    const results = await storage.getPollResults(poll.id);
    
    const selectedOptionTexts = voteChoice.selectedOptions.map((optionId: string) => {
      const option = poll.options.find((o: any) => o.id === optionId);
      return option ? option.text : optionId;
    }).join(', ');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .vote-summary { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .results-button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; font-size: 12px; color: #6b7280; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Vote Recorded!</h1>
  </div>
  
  <div class="content">
    <div class="vote-summary">
      <strong>Your Vote:</strong> ${escapeHtml(selectedOptionTexts)}<br>
      ${voteChoice.comment ? `<strong>Comment:</strong> ${escapeHtml(voteChoice.comment)}` : ''}
    </div>
    
    <p><strong>Poll:</strong> ${escapeHtml(poll.title)}</p>
    <p><strong>Total Votes So Far:</strong> ${results.uniqueVoters} people have voted</p>
    
    <div style="text-align: center;">
      <a href="${pollLink}" class="results-button">View Results</a>
    </div>
    
    <p><em>Thank you for participating! You can view live results and poll details at any time.</em></p>
  </div>
  
  <div class="footer">
    <p>🤖 Generated with <a href="https://claude.ai/code">Claude Code</a></p>
  </div>
</body>
</html>`;

    await notificationService.sendEmail({
      to: email.from,
      subject: `Vote Confirmed: ${escapeHtml(poll.title)}`,
      html: htmlContent,
      text: `Vote Confirmed!\n\nYour vote: ${selectedOptionTexts}\n\nView results: ${pollLink}`
    });
  }

  /**
   * Send error email
   */
  private async sendErrorEmail(email: EmailData, errorMessage: string): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .error-message { background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .help-section { background: #f0f9ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🗳️ Polly - Unable to Process</h1>
  </div>
  
  <div class="content">
    <div class="error-message">
      <strong>Error:</strong> ${escapeHtml(errorMessage)}
    </div>
    
    <div class="help-section">
      <strong>How to Create a Poll:</strong><br>
      Send an email to polly@${this.serviceDomain} with:<br>
      • A clear question<br>
      • Multiple choice options (A, B, C or 1, 2, 3)<br>
      • CC recipients who should vote<br><br>
      
      <strong>Example:</strong><br>
      Subject: Team Lunch Vote<br>
      Body: Which restaurant should we pick?<br>
      A) Italian Bistro<br>
      B) Sushi Place<br>
      C) Mexican Grill
    </div>
  </div>
</body>
</html>`;

    await notificationService.sendEmail({
      to: email.from,
      subject: 'Polly - Unable to Process Your Request',
      html: htmlContent,
      text: `Error: ${errorMessage}\n\nFor help creating polls, visit our documentation.`
    });
  }

  /**
   * Broadcast results update to stakeholders
   */
  private async broadcastResultsUpdate(poll: any): Promise<void> {
    // This could notify all voters about updated results
    // For now, we'll keep it simple and just log
    console.log(`🗳️ [POLLY] Results updated for poll ${poll.id}`);
  }

  /**
   * Check if email is a reply
   */
  private isReplyEmail(email: EmailData): boolean {
    return !!(email.inReplyTo || email.subject?.toLowerCase().startsWith('re:'));
  }

  /**
   * Get or create user for email address
   */
  private async getOrCreateUser(email: string): Promise<string> {
    let user = await storage.getUserByEmail(email);
    if (!user) {
      user = await storage.createUserFromEmail(email);
      if (!user) {
        throw new Error(`Failed to create user for email: ${email}`);
      }
    }
    return user.id;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    console.log('🗳️ PollyAgent initialized - Ready to handle voting and polling');
  }

  /**
   * Cleanup the agent
   */
  async cleanup(): Promise<void> {
    console.log('🗳️ PollyAgent cleanup completed');
  }
}