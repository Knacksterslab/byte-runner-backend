import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const METHOD_LABELS: Record<string, string> = {
  amazon_gift_card: 'Amazon Gift Card',
  app_store: 'App Store Gift Card',
  google_play: 'Google Play Gift Card',
  usdt: 'USDT (Tron / TRC20)',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private readonly from: string;
  private readonly adminEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('EMAIL_FROM', 'updates@byterunner.co');
    this.adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL', 'connect@byterunner.co');
  }

  private methodLabel(method: string): string {
    return METHOD_LABELS[method] ?? method;
  }

  /** Notify admin that a new withdrawal request was submitted */
  async sendWithdrawalRequestedToAdmin(withdrawal: {
    id: string;
    amount_cents: number;
    payment_method: string;
    contact_info: any;
    submitted_at: string;
  }): Promise<void> {
    const amount = (withdrawal.amount_cents / 100).toFixed(2);
    const method = this.methodLabel(withdrawal.payment_method);
    const email = withdrawal.contact_info?.email ?? 'N/A';
    const tronAddress = withdrawal.contact_info?.tron_address ?? null;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111;color:#eee;padding:24px;border-radius:8px;">
        <h2 style="color:#22c55e;margin-top:0;">💸 New Withdrawal Request</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#aaa;width:160px;">Amount</td><td style="padding:8px 0;font-weight:bold;color:#fff;">$${amount}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa;">Method</td><td style="padding:8px 0;color:#fff;">${method}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa;">User Email</td><td style="padding:8px 0;color:#fff;">${email}</td></tr>
          ${tronAddress ? `<tr><td style="padding:8px 0;color:#aaa;">Tron Address</td><td style="padding:8px 0;color:#fff;font-family:monospace;font-size:13px;">${tronAddress}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#aaa;">Submitted</td><td style="padding:8px 0;color:#fff;">${new Date(withdrawal.submitted_at).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa;">Withdrawal ID</td><td style="padding:8px 0;color:#aaa;font-family:monospace;font-size:12px;">${withdrawal.id}</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#1a2a1a;border-left:3px solid #22c55e;border-radius:4px;">
          <p style="margin:0;color:#86efac;font-size:14px;">Go to the admin panel → Withdrawals tab to mark as paid once you've processed this.</p>
        </div>
      </div>`;

    await this.send({
      to: this.adminEmail,
      subject: `[ByteRunner] New ${method} Withdrawal — $${amount}`,
      html,
    });
  }

  /** Confirm to user that their withdrawal request was received */
  async sendWithdrawalReceivedToUser(withdrawal: {
    amount_cents: number;
    payment_method: string;
    contact_info: any;
  }): Promise<void> {
    const email = withdrawal.contact_info?.email;
    if (!email) return;

    const amount = (withdrawal.amount_cents / 100).toFixed(2);
    const method = this.methodLabel(withdrawal.payment_method);

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111;color:#eee;padding:24px;border-radius:8px;">
        <h2 style="color:#22c55e;margin-top:0;">✅ Withdrawal Request Received</h2>
        <p style="color:#ccc;">Hi! We've received your withdrawal request. Here are the details:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#aaa;width:160px;">Amount</td><td style="padding:8px 0;font-weight:bold;color:#fff;">$${amount}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa;">Method</td><td style="padding:8px 0;color:#fff;">${method}</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:#1a2a1a;border-left:3px solid #22c55e;border-radius:4px;">
          <p style="margin:0;color:#86efac;font-size:14px;">We'll process your withdrawal within <strong>24–48 hours</strong>. You'll receive another email with your payment details once it's done.</p>
        </div>
        <p style="margin-top:24px;color:#666;font-size:12px;">If you didn't request this, please contact us at ${this.adminEmail}</p>
      </div>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Withdrawal Request Received — $${amount}`,
      html,
    });
  }

  /** Notify user their withdrawal has been paid, including payment details */
  async sendWithdrawalPaidToUser(withdrawal: {
    amount_cents: number;
    payment_method: string;
    contact_info: any;
    payment_details: string | null;
    transaction_id: string | null;
  }): Promise<void> {
    const email = withdrawal.contact_info?.email;
    if (!email) return;

    const amount = (withdrawal.amount_cents / 100).toFixed(2);
    const method = this.methodLabel(withdrawal.payment_method);
    const isUsdt = withdrawal.payment_method === 'usdt';
    const details = withdrawal.payment_details;
    const txId = withdrawal.transaction_id;

    let detailsHtml = '';
    if (isUsdt && txId) {
      detailsHtml = `
        <div style="margin-top:20px;padding:16px;background:#0f2020;border:1px solid #166534;border-radius:6px;">
          <p style="margin:0 0 8px;color:#86efac;font-weight:bold;">Transaction ID:</p>
          <p style="margin:0;font-family:monospace;font-size:13px;color:#6ee7b7;word-break:break-all;">${txId}</p>
          ${details ? `<p style="margin:8px 0 0;color:#aaa;font-size:13px;">${details}</p>` : ''}
        </div>`;
    } else if (details) {
      detailsHtml = `
        <div style="margin-top:20px;padding:16px;background:#0f2020;border:1px solid #166534;border-radius:6px;">
          <p style="margin:0 0 8px;color:#86efac;font-weight:bold;">Payment Details:</p>
          <p style="margin:0;font-family:monospace;font-size:14px;color:#fff;white-space:pre-wrap;">${details}</p>
        </div>`;
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111;color:#eee;padding:24px;border-radius:8px;">
        <h2 style="color:#22c55e;margin-top:0;">🎉 Your Withdrawal Has Been Processed!</h2>
        <p style="color:#ccc;">Great news! Your withdrawal has been completed.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#aaa;width:160px;">Amount</td><td style="padding:8px 0;font-weight:bold;color:#fff;">$${amount}</td></tr>
          <tr><td style="padding:8px 0;color:#aaa;">Method</td><td style="padding:8px 0;color:#fff;">${method}</td></tr>
        </table>
        ${detailsHtml}
        <p style="margin-top:24px;color:#666;font-size:12px;">Questions? Reply to this email or contact us at ${this.adminEmail}</p>
      </div>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Withdrawal Complete — $${amount} ${method}`,
      html,
    });
  }

  /** Notify user their withdrawal was rejected */
  async sendWithdrawalRejectedToUser(withdrawal: {
    amount_cents: number;
    payment_method: string;
    contact_info: any;
    notes: string | null;
  }): Promise<void> {
    const email = withdrawal.contact_info?.email;
    if (!email) return;

    const amount = (withdrawal.amount_cents / 100).toFixed(2);
    const reason = withdrawal.notes ?? 'Please contact support for details.';

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#111;color:#eee;padding:24px;border-radius:8px;">
        <h2 style="color:#ef4444;margin-top:0;">⚠️ Withdrawal Request Update</h2>
        <p style="color:#ccc;">Unfortunately, we were unable to process your $${amount} withdrawal at this time.</p>
        <div style="margin-top:16px;padding:16px;background:#2a1010;border-left:3px solid #ef4444;border-radius:4px;">
          <p style="margin:0;color:#fca5a5;font-size:14px;"><strong>Reason:</strong> ${reason}</p>
        </div>
        <p style="margin-top:20px;color:#ccc;font-size:14px;">Your balance has been restored. Please contact us at <a href="mailto:${this.adminEmail}" style="color:#22c55e;">${this.adminEmail}</a> if you have any questions.</p>
      </div>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Withdrawal Request — Action Required`,
      html,
    });
  }

  private async send(params: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: `ByteRunner <${this.from}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      if (error) {
        this.logger.error(`Failed to send email to ${params.to}: ${JSON.stringify(error)}`);
      } else {
        this.logger.log(`Email sent to ${params.to}: "${params.subject}"`);
      }
    } catch (err) {
      this.logger.error(`Email exception to ${params.to}:`, err);
    }
  }
}
