import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const SITE_URL = 'https://byterunner.co';
const LOGO_URL = 'https://byterunner.co/logo.png';

const METHOD_LABELS: Record<string, string> = {
  amazon_gift_card: 'Amazon Gift Card',
  app_store: 'App Store Gift Card',
  google_play: 'Google Play Gift Card',
  usdt: 'USDT (Tron / TRC20)',
};

const METHOD_ICONS: Record<string, string> = {
  amazon_gift_card: '🛍',
  app_store: '🍎',
  google_play: '▶',
  usdt: '🔷',
};

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ByteRunner</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0e1a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="Byte Runner" width="100" style="height:auto;display:block;margin:0 auto;" />
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f1a2e,#111827);border:1px solid #1e3a2e;border-radius:12px;overflow:hidden;">

              <!-- Green top bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(90deg,#16a34a,#059669);height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 32px 24px;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 8px;color:#374151;font-size:12px;">
                © ${new Date().getFullYear()} Byte Runner · A Cybersecurity Survival Game
              </p>
              <p style="margin:0;font-size:12px;">
                <a href="${SITE_URL}" style="color:#16a34a;text-decoration:none;">${SITE_URL}</a>
                &nbsp;·&nbsp;
                <a href="mailto:connect@byterunner.co" style="color:#374151;text-decoration:none;">connect@byterunner.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, mono = false, highlight = ''): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;color:${highlight || '#f9fafb'};font-size:14px;font-weight:600;vertical-align:top;${mono ? 'font-family:monospace;font-size:12px;word-break:break-all;' : ''}">${value}</td>
    </tr>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private readonly from: string;
  private readonly adminEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('EMAIL_FROM', 'noreply@updates.byterunner.co');
    this.adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL', 'connect@byterunner.co');
  }

  private methodLabel(method: string): string {
    return METHOD_LABELS[method] ?? method;
  }

  private methodIcon(method: string): string {
    return METHOD_ICONS[method] ?? '💰';
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
    const icon = this.methodIcon(withdrawal.payment_method);
    const email = withdrawal.contact_info?.email ?? 'N/A';
    const tronAddress = withdrawal.contact_info?.tron_address ?? null;
    const storeRegion = withdrawal.contact_info?.store_region ?? null;

    const content = `
      <!-- Badge -->
      <div style="display:inline-block;background:#052e16;border:1px solid #16a34a;border-radius:20px;padding:4px 14px;margin-bottom:20px;">
        <span style="color:#4ade80;font-size:12px;font-weight:600;letter-spacing:0.5px;">⚡ ACTION REQUIRED</span>
      </div>

      <h1 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:700;">New Withdrawal Request</h1>
      <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;">A player has requested a payout. Please process it and mark as paid in the admin panel.</p>

      <!-- Amount highlight -->
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Amount Requested</p>
        <p style="margin:0;color:#4ade80;font-size:36px;font-weight:700;">$${amount}</p>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${icon} ${method}${storeRegion ? ` &nbsp;·&nbsp; <span style="color:#fbbf24;font-weight:700;">${storeRegion} Store</span>` : ''}</p>
      </div>

      <!-- Details table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        ${detailRow('User Email', email)}
        ${tronAddress ? detailRow('Tron Address (TRC20)', tronAddress, true) : ''}
        ${storeRegion ? detailRow('Store Region', storeRegion, false, '#fbbf24') : ''}
        ${detailRow('Submitted', new Date(withdrawal.submitted_at).toLocaleString())}
        ${detailRow('Withdrawal ID', withdrawal.id, true, '#6b7280')}
      </table>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="${SITE_URL}/admin" style="display:inline-block;background:linear-gradient(90deg,#16a34a,#059669);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
              Open Admin Panel →
            </a>
          </td>
        </tr>
      </table>`;

    await this.send({
      to: this.adminEmail,
      subject: `[ByteRunner] New ${method} Withdrawal — $${amount}`,
      html: emailWrapper(content),
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
    const icon = this.methodIcon(withdrawal.payment_method);
    const storeRegion = withdrawal.contact_info?.store_region ?? null;

    const content = `
      <!-- Badge -->
      <div style="display:inline-block;background:#052e16;border:1px solid #16a34a;border-radius:20px;padding:4px 14px;margin-bottom:20px;">
        <span style="color:#4ade80;font-size:12px;font-weight:600;letter-spacing:0.5px;">✅ REQUEST RECEIVED</span>
      </div>

      <h1 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:700;">We've Got Your Request!</h1>
      <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;">Your withdrawal request has been submitted. Here's a summary of what you requested:</p>

      <!-- Amount highlight -->
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Withdrawal Amount</p>
        <p style="margin:0;color:#4ade80;font-size:36px;font-weight:700;">$${amount}</p>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${icon} ${method}${storeRegion ? ` &nbsp;·&nbsp; <span style="color:#fbbf24;">${storeRegion} Store</span>` : ''}</p>
      </div>

      <!-- What happens next -->
      <div style="background:#111827;border:1px solid #1f2937;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;font-weight:600;">⏱ What happens next?</p>
        <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">1. Our team reviews your request (usually within a few hours).</p>
        <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">2. We process your payment and send it to the email you provided.</p>
        <p style="margin:0;color:#9ca3af;font-size:13px;">3. You'll receive a confirmation email with your payment details. ✅</p>
      </div>

      <p style="margin:0 0 24px;color:#6b7280;font-size:12px;">Expected processing time: <strong style="color:#9ca3af;">24–48 hours</strong>. If you have questions, reply to this email or contact us at <a href="mailto:${this.adminEmail}" style="color:#16a34a;">${this.adminEmail}</a>.</p>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="${SITE_URL}/profile" style="display:inline-block;background:linear-gradient(90deg,#16a34a,#059669);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
              View Your Profile
            </a>
          </td>
        </tr>
      </table>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Withdrawal Request Received — $${amount}`,
      html: emailWrapper(content),
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
    const icon = this.methodIcon(withdrawal.payment_method);
    const isUsdt = withdrawal.payment_method === 'usdt';
    const details = withdrawal.payment_details;
    const txId = withdrawal.transaction_id;

    let paymentBox = '';
    if (isUsdt && txId) {
      paymentBox = `
        <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:#4ade80;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Transaction Confirmed</p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:12px;font-family:monospace;word-break:break-all;">${txId}</p>
          ${details ? `<a href="${details}" style="display:inline-block;color:#34d399;font-size:13px;text-decoration:none;">View on Tronscan →</a>` : ''}
        </div>`;
    } else if (details) {
      paymentBox = `
        <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 10px;color:#4ade80;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">🎁 Your Payment Details</p>
          <p style="margin:0;color:#f9fafb;font-size:15px;font-family:monospace;font-weight:700;white-space:pre-wrap;word-break:break-all;letter-spacing:0.5px;">${details}</p>
        </div>`;
    }

    const content = `
      <!-- Badge -->
      <div style="display:inline-block;background:#052e16;border:1px solid #16a34a;border-radius:20px;padding:4px 14px;margin-bottom:20px;">
        <span style="color:#4ade80;font-size:12px;font-weight:600;letter-spacing:0.5px;">🎉 PAYMENT COMPLETE</span>
      </div>

      <h1 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:700;">Your Withdrawal is Done!</h1>
      <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;">Great news — your payout has been processed successfully. Keep playing to earn more!</p>

      <!-- Amount highlight -->
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:20px 24px;margin-bottom:24px;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Amount Paid</p>
        <p style="margin:0;color:#4ade80;font-size:36px;font-weight:700;">$${amount}</p>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">${icon} ${method}</p>
      </div>

      ${paymentBox}

      <p style="margin:0 0 24px;color:#6b7280;font-size:12px;">Questions? Reply to this email or reach us at <a href="mailto:${this.adminEmail}" style="color:#16a34a;">${this.adminEmail}</a>.</p>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="${SITE_URL}" style="display:inline-block;background:linear-gradient(90deg,#16a34a,#059669);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
              Play Again 🎮
            </a>
          </td>
        </tr>
      </table>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Your $${amount} Withdrawal is Complete! 🎉`,
      html: emailWrapper(content),
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

    const content = `
      <!-- Badge -->
      <div style="display:inline-block;background:#2a0a0a;border:1px solid #dc2626;border-radius:20px;padding:4px 14px;margin-bottom:20px;">
        <span style="color:#f87171;font-size:12px;font-weight:600;letter-spacing:0.5px;">⚠️ REQUEST UPDATE</span>
      </div>

      <h1 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:700;">Withdrawal Not Processed</h1>
      <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;">We were unable to complete your $${amount} withdrawal at this time. Don't worry — your balance has been restored to your account.</p>

      <!-- Reason box -->
      <div style="background:#2a0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;color:#f87171;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
        <p style="margin:0;color:#fca5a5;font-size:14px;">${reason}</p>
      </div>

      <!-- Restored notice -->
      <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:16px 24px;margin-bottom:24px;">
        <p style="margin:0;color:#4ade80;font-size:14px;">✅ <strong>Your $${amount} has been credited back to your ByteRunner balance.</strong></p>
      </div>

      <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">If you believe this is an error, please contact us at <a href="mailto:${this.adminEmail}" style="color:#16a34a;">${this.adminEmail}</a> and we'll look into it right away.</p>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="${SITE_URL}/profile" style="display:inline-block;background:linear-gradient(90deg,#16a34a,#059669);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">
              View Your Balance
            </a>
          </td>
        </tr>
      </table>`;

    await this.send({
      to: email,
      subject: `[ByteRunner] Withdrawal Update — Action Required`,
      html: emailWrapper(content),
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
