import nodemailer from 'nodemailer';
import postmark from 'postmark';

export type MailSendOptions = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  from?: string; // Preferred From header (e.g., todo@inboxleap.com)
  fallbackFrom?: string; // Optional alternative From header when sending via SMTP fallback
};

function normalizeAddrs(v?: string | string[]): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(', ') : v;
}

function getSmtpFallbackConfig(): { host: string; port: number; secure: boolean; user: string; pass: string } | null {
  // Only allow primary service SMTP by default
  const svcEmail = process.env.SERVICE_EMAIL;
  const svcPass = process.env.SERVICE_EMAIL_PASSWORD;
  const svcHost = process.env.SERVICE_SMTP_HOST;
  const svcPort = parseInt(process.env.SERVICE_SMTP_PORT || '587', 10);

  if (svcEmail && svcPass && svcHost) {
    return { host: svcHost, port: svcPort, secure: svcPort === 465, user: svcEmail, pass: svcPass };
  }

  return null;
}

function getGmailSmtpConfig(): { host: string; port: number; secure: boolean; user: string; pass: string } | null {
  const gmailEmail = process.env.GMAIL_EMAIL;
  const gmailPass = process.env.GMAIL_EMAIL_PASSWORD;
  const gmailHost = process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com';
  const gmailPort = parseInt(process.env.GMAIL_SMTP_PORT || '587', 10);

  if (gmailEmail && gmailPass) {
    return { host: gmailHost, port: gmailPort, secure: gmailPort === 465, user: gmailEmail, pass: gmailPass };
  }
  return null;
}

export async function sendMail(options: MailSendOptions): Promise<boolean> {
  const to = normalizeAddrs(options.to)!;
  const cc = normalizeAddrs(options.cc);
  const bcc = normalizeAddrs(options.bcc);

  // 1) Try Postmark first if configured
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  const postmarkFrom = options.from || process.env.POSTMARK_FROM_EMAIL || process.env.SERVICE_EMAIL;

  if (postmarkToken && postmarkFrom) {
    try {
      const client = new postmark.ServerClient(postmarkToken);
      const headers: Array<{ Name: string; Value: string }> = [];
      if (options.inReplyTo) headers.push({ Name: 'In-Reply-To', Value: options.inReplyTo });
      if (options.references && options.references.length > 0) {
        headers.push({ Name: 'References', Value: options.references.join(' ') });
      }

      await client.sendEmail({
        From: postmarkFrom,
        To: to,
        Cc: cc,
        Bcc: bcc,
        Subject: options.subject,
        TextBody: options.text,
        HtmlBody: options.html,
        MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
        ReplyTo: options.replyTo,
        Headers: headers.length ? headers : undefined,
      });

      console.log(`✅ [MAILER] Postmark email sent to ${to}`);
      return true;
    } catch (err) {
      console.error('⚠️  [MAILER] Postmark send failed, attempting SMTP fallbacks:', err);
      // Fall through to SMTP fallbacks
    }
  } else {
    if (!postmarkToken) console.log('ℹ️  [MAILER] POSTMARK_SERVER_TOKEN not set, using SMTP fallbacks');
    if (!postmarkFrom) console.log('ℹ️  [MAILER] From not set for Postmark, using SMTP fallbacks');
  }

  // 2) Fallback to Service SMTP (if configured)
  const svc = getSmtpFallbackConfig();
  if (svc) {
    try {
      const transporter = nodemailer.createTransport({
        host: svc.host,
        port: svc.port,
        secure: svc.secure,
        auth: { user: svc.user, pass: svc.pass },
      });

      const fromHeader = options.fallbackFrom || options.from || svc.user;

      await transporter.sendMail({
        from: fromHeader,
        to,
        cc,
        bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        headers: {
          ...(options.inReplyTo ? { 'In-Reply-To': options.inReplyTo } : {}),
          ...(options.references && options.references.length > 0
            ? { References: options.references.join(' ') }
            : {}),
        },
      });
      console.log(`✅ [MAILER] Service SMTP email sent to ${to}`);
      return true;
    } catch (smtpErr) {
      console.error('⚠️  [MAILER] Service SMTP send failed, trying Gmail fallback:', smtpErr);
      // Fall through to Gmail
    }
  } else {
    console.log('ℹ️  [MAILER] Service SMTP not configured, trying Gmail fallback');
  }

  // 3) Final fallback to Gmail SMTP (only if configured)
  const gmail = getGmailSmtpConfig();
  if (!gmail) {
    console.error('❌ [MAILER] No SMTP route available (Postmark failed, Service SMTP unavailable/failed, Gmail not configured).');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: gmail.host,
      port: gmail.port,
      secure: gmail.secure,
      auth: { user: gmail.user, pass: gmail.pass },
    });

    // Using Gmail SMTP: to avoid rejection, default From to Gmail user if an arbitrary from is provided
    const fromHeader = options.from && options.from !== gmail.user ? gmail.user : (options.from || gmail.user);
    const replyTo = options.replyTo || options.from; // preserve original reply-to if provided

    await transporter.sendMail({
      from: fromHeader,
      to,
      cc,
      bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo,
      headers: {
        ...(options.inReplyTo ? { 'In-Reply-To': options.inReplyTo } : {}),
        ...(options.references && options.references.length > 0
          ? { References: options.references.join(' ') }
          : {}),
      },
    });
    console.log(`✅ [MAILER] Gmail SMTP email sent to ${to}`);
    return true;
  } catch (gmailErr) {
    console.error('❌ [MAILER] Gmail SMTP send failed:', gmailErr);
    return false;
  }
}
