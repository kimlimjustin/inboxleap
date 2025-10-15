import { EventEmitter } from "events";
import { SMTPServer, SMTPServerSession, SMTPServerAuthentication, SMTPServerDataStream } from "smtp-server";
import { emailConfigManager } from './EmailConfigManager';

export class SMTPServerManager extends EventEmitter {
  private smtpServer: SMTPServer | null = null;
  private smtpServerRunning = false;

  async startSMTPServer() {
    if (this.smtpServerRunning) {
      console.log("📧 SMTP server already running");
      return;
    }

    const smtpPort = parseInt(process.env.SMTP_PORT || "2525");
    const validUsers = emailConfigManager.getValidSMTPUsers();
    
    if (validUsers.length === 0) {
      console.log("⚠️  No valid SMTP users configured - SMTP server will not start");
      return;
    }

    this.smtpServer = new SMTPServer({
      secure: false,
      authOptional: false,
      allowInsecureAuth: true,
      
      onAuth: (auth: SMTPServerAuthentication, session: SMTPServerSession, callback: (err?: Error | null, response?: any) => void) => {
        const { username, password } = auth;
        const user = validUsers.find(u => u.username === username && u.password === password);
        
        if (!user) {
          console.log(`❌ SMTP auth failed for user: ${username}`);
          return callback(new Error("Invalid username or password"));
        }
        
        console.log(`✅ SMTP auth successful for user: ${username}`);
        callback(null, { user: username });
      },

      onData: async (stream: SMTPServerDataStream, session: SMTPServerSession, callback: (err?: Error | null) => void) => {
        try {
          await this.handleSMTPEmail(stream, session);
          callback();
        } catch (error) {
          console.error("❌ Error processing SMTP email:", error);
          callback(error as Error);
        }
      }
    });

    this.smtpServer.listen(smtpPort, () => {
      console.log(`📧 SMTP server listening on port ${smtpPort}`);
      this.smtpServerRunning = true;
      this.emit("smtpServerStarted", smtpPort);
    });

    this.smtpServer.on('error', (error) => {
      console.error('❌ SMTP server error:', error);
      this.smtpServerRunning = false;
      this.emit("smtpServerError", error);
    });

    this.smtpServer.on('close', () => {
      console.log('📧 SMTP server closed');
      this.smtpServerRunning = false;
      this.emit("smtpServerClosed");
    });
  }

  async stopSMTPServer() {
    if (!this.smtpServer) {
      console.log("📧 SMTP server not running");
      return;
    }

    return new Promise<void>((resolve) => {
      this.smtpServer!.close(() => {
        console.log("📧 SMTP server stopped");
        this.smtpServer = null;
        this.smtpServerRunning = false;
        this.emit("smtpServerStopped");
        resolve();
      });
    });
  }

  private async handleSMTPEmail(stream: SMTPServerDataStream, session: SMTPServerSession): Promise<void> {
    return new Promise((resolve, reject) => {
      let emailBuffer = "";
      
      stream.on("data", (chunk) => {
        emailBuffer += chunk.toString();
      });

      stream.on("end", async () => {
        try {
          const fromAddress = session.envelope.mailFrom ? (typeof session.envelope.mailFrom === 'object' ? session.envelope.mailFrom.address : session.envelope.mailFrom) : 'unknown';
          const toAddresses = session.envelope.rcptTo.map(r => typeof r === 'object' ? r.address : r);
          
          console.log(`📧 [SMTP] Received email from ${fromAddress} to ${toAddresses.join(', ')}`);
          console.log(`📧 [SMTP] Email size: ${emailBuffer.length} chars`);
          
          // Emit the email for processing
          this.emit("emailReceived", {
            from: fromAddress,
            to: toAddresses,
            rawContent: emailBuffer,
            session
          });

          resolve();
        } catch (error) {
          console.error("❌ [SMTP] Error processing email:", error);
          reject(error);
        }
      });

      stream.on("error", (error) => {
        console.error("❌ [SMTP] Stream error:", error);
        reject(error);
      });
    });
  }

  isRunning(): boolean {
    return this.smtpServerRunning;
  }

  getServer(): SMTPServer | null {
    return this.smtpServer;
  }
}

export const smtpServerManager = new SMTPServerManager();
