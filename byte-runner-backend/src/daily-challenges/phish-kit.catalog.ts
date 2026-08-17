/**
 * Phish Kit catalog — parts-based lure construction + the simulated office.
 *
 * PARTS-ONLY BY DESIGN: no free text anywhere; every possible lure is
 * fictional-by-construction (invented domains/companies) and safe to
 * screenshot outside the game. This file is duplicated in the frontend
 * (lib/game/phishKit/catalog.ts) — the resolver validates part IDs against
 * this copy, so the two MUST stay in sync. Bump PHISH_KIT_CATALOG_VERSION
 * on any content change.
 */

export const PHISH_KIT_CATALOG_VERSION = 1;

export type TellCategory =
  | 'sender-spoof'
  | 'urgent-pressure'
  | 'request-action'
  | 'suspicious-payload'
  | 'too-good'
  | 'context-mismatch';

export type Lever = 'urgency' | 'authority' | 'fear' | 'greed' | 'curiosity' | 'trust';

export type LureSlot = 'sender' | 'pretext' | 'pressure' | 'payload';

export interface LurePart {
  id: string;
  slot: LureSlot;
  label: string;
  rendered: string;
  tell: TellCategory;
  subtlety: 1 | 2 | 3;
  levers: Lever[];
}

export interface OfficePersona {
  id: string;
  name: string;
  role: string;
  vigilance: 1 | 2 | 3;
  weaknesses: Lever[];
  blindSpots: TellCategory[];
}

const senders: LurePart[] = [
  { id: 'snd-cfo', slot: 'sender', label: '“CFO” · lookalike domain', rendered: 'M. Okafor <m.okafor@fin-techsolut1ons.co>', tell: 'sender-spoof', subtlety: 2, levers: ['authority'] },
  { id: 'snd-helpdesk', slot: 'sender', label: 'IT Helpdesk · internal-sounding', rendered: 'IT Helpdesk <helpdesk@byterunner-support.net>', tell: 'sender-spoof', subtlety: 2, levers: ['trust', 'authority'] },
  { id: 'snd-ceo-assist', slot: 'sender', label: 'CEO’s assistant · typo domain', rendered: 'A. Reyes (EA to CEO) <a.reyes@nvrdax-loglstics.net>', tell: 'sender-spoof', subtlety: 3, levers: ['authority'] },
  { id: 'snd-bank', slot: 'sender', label: 'Your bank · subdomain trick', rendered: 'Secure Alerts <no-reply@alerts.trustmark-online.com>', tell: 'sender-spoof', subtlety: 3, levers: ['fear', 'trust'] },
  { id: 'snd-hr', slot: 'sender', label: 'HR · display-name spoof', rendered: 'Human Resources 📋 <hr-policies@bytema1l.co>', tell: 'sender-spoof', subtlety: 1, levers: ['trust'] },
  { id: 'snd-payroll', slot: 'sender', label: 'Payroll · urgent tone', rendered: 'Payroll Team <payroll@byterunner-hr.co>', tell: 'sender-spoof', subtlety: 2, levers: ['urgency'] },
  { id: 'snd-courier', slot: 'sender', label: 'Courier · missed delivery', rendered: 'SwiftShip Express <parcel@swiftship-deliveries.info>', tell: 'sender-spoof', subtlety: 1, levers: ['curiosity'] },
  { id: 'snd-vendor', slot: 'sender', label: 'Known vendor · changed bank', rendered: 'PaperTrail Supplies <accounts@papertra1l-supplies.com>', tell: 'sender-spoof', subtlety: 3, levers: ['trust'] },
  { id: 'snd-security', slot: 'sender', label: '“Security” · scare sender', rendered: 'Account Security <security@verify-account-now.xyz>', tell: 'sender-spoof', subtlety: 1, levers: ['fear'] },
  { id: 'snd-lottery', slot: 'sender', label: 'Prize office', rendered: 'International Prize Registry <claims@your-winding.com>', tell: 'too-good', subtlety: 1, levers: ['greed'] },
  { id: 'snd-recruit', slot: 'sender', label: 'Recruiter · dream job', rendered: 'Talent Partners <careers@talentpath-recruiting.co>', tell: 'context-mismatch', subtlety: 2, levers: ['greed', 'curiosity'] },
  { id: 'snd-colleague', slot: 'sender', label: 'Colleague · personal address', rendered: 'Sam from Sales <sam.kowalski92@freem4il.com>', tell: 'context-mismatch', subtlety: 2, levers: ['trust'] },
];

const pretexts: LurePart[] = [
  { id: 'pre-invoice', slot: 'pretext', label: 'Unpaid invoice · final notice', rendered: 'Our records show invoice #INV-20841 remains UNPAID despite two reminders.', tell: 'urgent-pressure', subtlety: 2, levers: ['fear', 'urgency'] },
  { id: 'pre-suspend', slot: 'pretext', label: 'Account suspension', rendered: 'Your account will be permanently suspended within 24 hours.', tell: 'urgent-pressure', subtlety: 1, levers: ['fear', 'urgency'] },
  { id: 'pre-bonus', slot: 'pretext', label: 'Unclaimed bonus', rendered: 'You were selected for a Q3 performance bonus that remains unclaimed.', tell: 'too-good', subtlety: 2, levers: ['greed'] },
  { id: 'pre-wire', slot: 'pretext', label: 'CEO requests a wire', rendered: 'I’m boarding a flight — I need you to process a discreet payment before we land.', tell: 'request-action', subtlety: 3, levers: ['authority', 'urgency'] },
  { id: 'pre-payroll-fix', slot: 'pretext', label: 'Payroll detail update', rendered: 'To avoid delays in this month’s salary, confirm your banking details today.', tell: 'request-action', subtlety: 2, levers: ['urgency', 'fear'] },
  { id: 'pre-login', slot: 'pretext', label: 'Unusual sign-in detected', rendered: 'A sign-in from Lagos, NG was detected on your account. Was this you?', tell: 'urgent-pressure', subtlety: 2, levers: ['fear'] },
  { id: 'pre-package', slot: 'pretext', label: 'Customs fee on parcel', rendered: 'Your parcel is held at customs — a 1.99 settlement fee releases it today.', tell: 'too-good', subtlety: 1, levers: ['curiosity', 'greed'] },
  { id: 'pre-policy', slot: 'pretext', label: 'New policy acknowledgment', rendered: 'All staff must acknowledge the revised Data Handling Policy by 5 PM.', tell: 'context-mismatch', subtlety: 3, levers: ['authority', 'urgency'] },
  { id: 'pre-meeting', slot: 'pretext', label: 'Emergency meeting link', rendered: 'Emergency all-hands starting NOW — join with your company login.', tell: 'request-action', subtlety: 3, levers: ['urgency', 'authority'] },
  { id: 'pre-refund', slot: 'pretext', label: 'Duplicate payment refund', rendered: 'We accidentally charged you twice. Provide card details to receive your refund.', tell: 'request-action', subtlety: 2, levers: ['greed'] },
  { id: 'pre-onsite', slot: 'pretext', label: 'Visitor badge photo', rendered: 'Send a photo of your ID badge so reception can issue your visitor pass.', tell: 'context-mismatch', subtlety: 3, levers: ['trust'] },
  { id: 'pre-gift', slot: 'pretext', label: 'Shared gift card', rendered: 'I’m out of gift cards for the client dinner — can you grab two and send the codes?', tell: 'request-action', subtlety: 3, levers: ['authority', 'trust'] },
  { id: 'pre-verify', slot: 'pretext', label: 'Verify to keep access', rendered: 'Failure to verify your identity within 12 hours will revoke all access.', tell: 'urgent-pressure', subtlety: 1, levers: ['fear', 'urgency'] },
  { id: 'pre-interview', slot: 'pretext', label: 'Interview opportunity', rendered: 'Your CV impressed us. Complete the pre-interview form to lock your slot.', tell: 'too-good', subtlety: 2, levers: ['greed', 'curiosity'] },
  { id: 'pre-share', slot: 'pretext', label: 'Shared a file with you', rendered: 'Sam shared “Q4_compensation_review.xlsx” with you. Open to view.', tell: 'suspicious-payload', subtlety: 2, levers: ['curiosity'] },
  { id: 'pre-password', slot: 'pretext', label: 'Password expiring', rendered: 'Your password expires in 4 hours. Reset now to avoid losing access to payroll.', tell: 'urgent-pressure', subtlety: 2, levers: ['urgency', 'fear'] },
];

const pressures: LurePart[] = [
  { id: 'prs-deadline', slot: 'pressure', label: 'Hard deadline', rendered: 'This must be completed before 5:00 PM today. No exceptions.', tell: 'urgent-pressure', subtlety: 1, levers: ['urgency'] },
  { id: 'prs-secret', slot: 'pressure', label: 'Keep this quiet', rendered: 'Please keep this between us for now — formal approval follows later.', tell: 'context-mismatch', subtlety: 3, levers: ['authority', 'trust'] },
  { id: 'prs-audit', slot: 'pressure', label: 'Audit threat', rendered: 'Non-compliance will be reported to the audit committee.', tell: 'urgent-pressure', subtlety: 2, levers: ['fear'] },
  { id: 'prs-first', slot: 'pressure', label: 'First responders win', rendered: 'The first 20 respondents receive priority processing.', tell: 'too-good', subtlety: 2, levers: ['greed', 'urgency'] },
  { id: 'prs-escalate', slot: 'pressure', label: 'Escalation threat', rendered: 'If unresolved, this escalates to your manager immediately.', tell: 'urgent-pressure', subtlety: 1, levers: ['fear'] },
  { id: 'prs-exclusive', slot: 'pressure', label: 'Exclusive invitation', rendered: 'You’ve been chosen — this invitation is non-transferable.', tell: 'too-good', subtlety: 2, levers: ['greed', 'curiosity'] },
  { id: 'prs-confirm', slot: 'pressure', label: 'Confirm immediately', rendered: 'Reply “CONFIRMED” immediately so we know you received this.', tell: 'request-action', subtlety: 2, levers: ['urgency'] },
  { id: 'prs-outage', slot: 'pressure', label: 'Maintenance window', rendered: 'Systems go offline in 30 minutes for maintenance. Act now.', tell: 'urgent-pressure', subtlety: 2, levers: ['urgency', 'fear'] },
  { id: 'prs-favor', slot: 'pressure', label: 'Personal favor', rendered: 'I wouldn’t ask if it weren’t important — I need this handled personally.', tell: 'context-mismatch', subtlety: 3, levers: ['trust', 'authority'] },
  { id: 'prs-limited', slot: 'pressure', label: 'Limited stock', rendered: 'Only 3 vouchers remain — they go fast.', tell: 'too-good', subtlety: 1, levers: ['greed'] },
  { id: 'prs-mystery', slot: 'pressure', label: 'Curiosity hook', rendered: 'You’ll want to see this before the whole company finds out.', tell: 'too-good', subtlety: 2, levers: ['curiosity'] },
  { id: 'prs-safe', slot: 'pressure', label: 'False reassurance', rendered: 'This link is safe — we verify it daily with our security team.', tell: 'suspicious-payload', subtlety: 3, levers: ['trust'] },
];

const payloads: LurePart[] = [
  { id: 'pay-link', slot: 'payload', label: 'Login link', rendered: '[ VERIFY ACCOUNT NOW → portal-secure-login.click ]', tell: 'suspicious-payload', subtlety: 1, levers: ['urgency'] },
  { id: 'pay-attachment', slot: 'payload', label: 'HTML attachment', rendered: '📎 invoice_20841.html (248 KB)', tell: 'suspicious-payload', subtlety: 2, levers: ['curiosity'] },
  { id: 'pay-reply', slot: 'payload', label: 'Reply with credentials', rendered: 'Reply with your username and password so we can “sync your account”.', tell: 'request-action', subtlety: 2, levers: ['trust'] },
  { id: 'pay-wire', slot: 'payload', label: 'Wire transfer', rendered: 'Wire €12,400 to: IBAN LT00 0000 0000 — reference “CONFIDENTIAL”.', tell: 'request-action', subtlety: 3, levers: ['authority'] },
  { id: 'pay-giftcode', slot: 'payload', label: 'Gift card codes', rendered: 'Send the 16-digit codes from two Apple gift cards, photographed.', tell: 'request-action', subtlety: 2, levers: ['authority'] },
  { id: 'pay-macro', slot: 'payload', label: 'Enable-macro document', rendered: '📎 payroll_update.xlsm — “Enable Content” to view figures', tell: 'suspicious-payload', subtlety: 3, levers: ['curiosity'] },
  { id: 'pay-form', slot: 'payload', label: 'External form', rendered: '[ Complete pre-interview form → talentpath-forms.online ]', tell: 'suspicious-payload', subtlety: 2, levers: ['greed'] },
  { id: 'pay-mfa', slot: 'payload', label: 'MFA code request', rendered: 'We’ll send a verification code — read it back to us to confirm identity.', tell: 'request-action', subtlety: 3, levers: ['trust'] },
  { id: 'pay-update', slot: 'payload', label: 'Fake “security update”', rendered: '[ Install critical patch → updates-byterunner.drv ]', tell: 'suspicious-payload', subtlety: 2, levers: ['fear'] },
  { id: 'pay-photo', slot: 'payload', label: 'Photograph your ID', rendered: 'Photograph the front and back of your ID badge and attach.', tell: 'request-action', subtlety: 3, levers: ['trust'] },
  { id: 'pay-qr', slot: 'payload', label: 'QR code', rendered: 'Scan the code below with your phone to verify instantly. ▦', tell: 'suspicious-payload', subtlety: 2, levers: ['curiosity'] },
  { id: 'pay-app', slot: 'payload', label: 'Rogue app install', rendered: '[ Get the company wellness app → wellnes-app.apk ]', tell: 'suspicious-payload', subtlety: 3, levers: ['greed'] },
];

export const LURE_PARTS: LurePart[] = [...senders, ...pretexts, ...pressures, ...payloads];

/** Daily pool sizes per slot (subset rotates by day-seed — shared puzzle). */
export const POOL_SIZES: Record<LureSlot, number> = { sender: 4, pretext: 6, pressure: 4, payload: 4 };

export const OFFICE_PERSONAS: OfficePersona[] = [
  { id: 'dana', name: 'Dana', role: 'Accounting · rushing payroll', vigilance: 1, weaknesses: ['urgency', 'authority'], blindSpots: ['sender-spoof'] },
  { id: 'mo', name: 'Mo', role: 'Intern · eager to impress', vigilance: 1, weaknesses: ['authority', 'curiosity'], blindSpots: ['suspicious-payload'] },
  { id: 'priya', name: 'Priya', role: 'CFO · sees everything', vigilance: 3, weaknesses: [], blindSpots: [] },
  { id: 'sam', name: 'Sam', role: 'Sales · prize-believer', vigilance: 1, weaknesses: ['greed'], blindSpots: ['too-good'] },
  { id: 'lena', name: 'Lena', role: 'IT · suspicious by trade', vigilance: 3, weaknesses: ['curiosity'], blindSpots: [] },
  { id: 'tomas', name: 'Tomás', role: 'HR · policy-follower', vigilance: 2, weaknesses: ['trust', 'urgency'], blindSpots: ['context-mismatch'] },
  { id: 'grace', name: 'Grace', role: 'Reception · helpful to all', vigilance: 2, weaknesses: ['trust', 'curiosity'], blindSpots: ['request-action'] },
  { id: 'viktor', name: 'Viktor', role: 'Legal · reads everything', vigilance: 2, weaknesses: ['fear'], blindSpots: [] },
];
