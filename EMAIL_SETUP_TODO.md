# Email Notifications Setup

**Status:** Prize claim emails are currently logged to console only

**Priority:** Implement before first contest with real prizes

---

## Email Service Options

### Option 1: Resend (Recommended for MVP)
**Why:** Simple, generous free tier, developer-friendly

- **Free tier:** 3,000 emails/month, 100 emails/day
- **Paid:** $20/mo for 50,000 emails
- **Setup time:** 15-30 minutes

```bash
npm install resend
```

```typescript
// src/email/email.service.ts
import { Resend } from 'resend';

export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendPrizeClaimConfirmation(data: {
    to: string;
    prize: string;
    rank: number;
    paymentMethod: string;
    usdtWallet?: string;
  }) {
    await this.resend.emails.send({
      from: 'ByteRunner <prizes@byterunner.co>',
      to: data.to,
      subject: `🎉 Claim Your Prize - Rank #${data.rank}!`,
      html: this.getPrizeClaimTemplate(data)
    });
  }
}
```

**Environment variables needed:**
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

---

### Option 2: SendGrid
**Why:** More established, better for high volume

- **Free tier:** 100 emails/day
- **Paid:** Starts at $20/mo for 50,000 emails
- **Setup time:** 30-45 minutes (more complex)

---

### Option 3: AWS SES
**Why:** Cheapest at scale, but complex setup

- **Cost:** $0.10 per 1,000 emails
- **Setup time:** 1-2 hours (requires AWS setup, domain verification)

---

## Email Templates Needed

### 1. Prize Claim Confirmation (Gift Cards)

**Subject:** `🎁 Your ByteRunner Prize - Rank #[X]!`

**Content:**
```
Hi [Username]!

Congratulations on placing #[X] in [Contest Name]!

PRIZE DETAILS:
• Prize: [Prize Description]
• Payment Method: [App Store / Google Play] Gift Card
• Delivery Email: [Email]

WHAT HAPPENS NEXT:
Your gift card code will be sent to this email within 3-5 business days.

Questions? Reply to this email.

Status: Pending Admin Review
Claim ID: [Claim ID]

---
ByteRunner Team
Play smart, stay secure! 🛡️
```

---

### 2. Prize Claim Confirmation (USDT)

**Subject:** `💰 Your ByteRunner Prize - USDT Transfer`

**Content:**
```
Hi [Username]!

Congratulations on placing #[X] in [Contest Name]!

PRIZE DETAILS:
• Prize: [Amount] USDT
• Wallet Address: [Wallet]
• Network: [TRC20 / ERC20]

WHAT HAPPENS NEXT:
We'll send your USDT within 24-48 hours. You'll receive a transaction hash when the transfer is complete.

⚠️ IMPORTANT: If your wallet address is incorrect, reply to this email IMMEDIATELY.

Questions? Reply to this email.

Status: Pending Transfer
Claim ID: [Claim ID]

---
ByteRunner Team
Play smart, stay secure! 🛡️
```

---

### 3. Prize Sent Notification

**Subject:** `✅ Your Prize Has Been Sent!`

**Content:**
```
Hi [Username]!

Great news! Your prize has been sent.

[If Gift Card:]
Your [App Store/Google Play] gift card code:
[CODE]

Redeem at: [App Store / Google Play]

[If USDT:]
Transaction Hash: [Hash]
View on: [Block Explorer Link]

Enjoy your prize! 🎉

---
ByteRunner Team
```

---

## Implementation Steps

### Step 1: Choose & Setup Email Service (30 mins)
- [ ] Sign up for Resend (or chosen service)
- [ ] Verify domain (prizes@byterunner.co)
- [ ] Get API key
- [ ] Add to `.env`

### Step 2: Create Email Service (1-2 hours)
- [ ] Create `src/email/email.module.ts`
- [ ] Create `src/email/email.service.ts`
- [ ] Create email templates (HTML + text)
- [ ] Add to prize-claims.service.ts

### Step 3: Update Prize Claims Service (30 mins)
- [ ] Remove console.log
- [ ] Add email service injection
- [ ] Call sendPrizeClaimConfirmation()
- [ ] Add error handling for failed emails

### Step 4: Add Admin Notifications (1 hour)
- [ ] Email admin when claim submitted
- [ ] Email user when admin marks as paid
- [ ] Email user with gift code or txn hash

### Step 5: Testing (30 mins)
- [ ] Test all email templates
- [ ] Test with real email addresses
- [ ] Check spam folder delivery
- [ ] Verify links work

---

## Quick Start (Resend - 30 minutes)

```bash
# Install
npm install resend

# Add to .env
RESEND_API_KEY=your_key_here
```

```typescript
// src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendPrizeClaimConfirmation(data: {
    to: string;
    username: string;
    prize: string;
    rank: number;
    contestName: string;
    paymentMethod: 'app_store' | 'google_play' | 'usdt';
    usdtWallet?: string;
    usdtNetwork?: string;
    claimId: string;
  }) {
    if (!this.resend) {
      console.log('Email service not configured - skipping');
      return;
    }

    const subject = data.paymentMethod === 'usdt'
      ? `💰 Your ByteRunner Prize - USDT Transfer`
      : `🎁 Your ByteRunner Prize - Gift Card`;

    const html = this.getClaimConfirmationTemplate(data);

    try {
      await this.resend.emails.send({
        from: 'ByteRunner Prizes <prizes@byterunner.co>',
        to: data.to,
        subject,
        html,
      });
      console.log(`✅ Prize claim email sent to ${data.to}`);
    } catch (error) {
      console.error('Failed to send prize claim email:', error);
      // Don't throw - we don't want to fail the claim if email fails
    }
  }

  private getClaimConfirmationTemplate(data: any): string {
    // Return HTML template based on payment method
    if (data.paymentMethod === 'usdt') {
      return `
        <h2>🎉 Congratulations ${data.username}!</h2>
        <p>You placed <strong>#${data.rank}</strong> in ${data.contestName}!</p>
        
        <h3>Prize Details:</h3>
        <ul>
          <li>Prize: ${data.prize} USDT</li>
          <li>Wallet: <code>${data.usdtWallet}</code></li>
          <li>Network: ${data.usdtNetwork?.toUpperCase()}</li>
        </ul>
        
        <h3>What Happens Next:</h3>
        <p>We'll send your USDT within 24-48 hours. You'll receive a transaction hash when complete.</p>
        
        <p><strong>⚠️ IMPORTANT:</strong> If your wallet address is incorrect, reply IMMEDIATELY.</p>
        
        <p>Claim ID: ${data.claimId}</p>
      `;
    } else {
      const storeName = data.paymentMethod === 'app_store' ? 'App Store' : 'Google Play';
      return `
        <h2>🎉 Congratulations ${data.username}!</h2>
        <p>You placed <strong>#${data.rank}</strong> in ${data.contestName}!</p>
        
        <h3>Prize Details:</h3>
        <ul>
          <li>Prize: ${data.prize}</li>
          <li>Payment: ${storeName} Gift Card</li>
          <li>Delivery Email: ${data.to}</li>
        </ul>
        
        <h3>What Happens Next:</h3>
        <p>Your gift card code will be sent within 3-5 business days.</p>
        
        <p>Claim ID: ${data.claimId}</p>
      `;
    }
  }
}

// src/email/email.module.ts
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

```typescript
// Update src/prize-claims/prize-claims.module.ts
import { EmailModule } from '../email/email.module';

@Module({
  imports: [SupabaseModule, UsersModule, EmailModule],
  // ...
})
```

```typescript
// Update src/prize-claims/prize-claims.service.ts
constructor(
  private readonly supabaseService: SupabaseService,
  private readonly emailService: EmailService,  // Add this
) {}

// In submitClaim method, replace console.log with:
await this.emailService.sendPrizeClaimConfirmation({
  to: contactInfo.email,
  username: 'User', // Get from users table
  prize: claim.prize_description,
  rank: claim.rank,
  contestName: 'Contest', // Get from contests table
  paymentMethod: contactInfo.payment_method,
  usdtWallet: contactInfo.usdt_wallet,
  usdtNetwork: contactInfo.usdt_network,
  claimId: claim.id,
});
```

---

## Cost Estimates

**For 100 prize claims/month:**
- Resend: Free (under 3,000/mo)
- SendGrid: Free (under 100/day)
- AWS SES: $0.01 (100 emails)

**For 1,000 prize claims/month:**
- Resend: Free (under 3,000/mo)
- SendGrid: $20/mo
- AWS SES: $0.10

**Bottom line:** Resend is perfect for MVP and scales well.

---

## Testing Checklist

Before going live:
- [ ] Send test email to yourself
- [ ] Check spam folder
- [ ] Test all payment method types
- [ ] Verify links work
- [ ] Test error handling (invalid email)
- [ ] Test with real user email
- [ ] Verify email delivery time (<1 min)
