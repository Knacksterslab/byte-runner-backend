# Admin Panel Setup & Usage Guide 🛡️

Complete guide for managing contests through the admin dashboard.

---

## 🚀 Setup Instructions

### 1. Configure Admin Emails

Add your email(s) to the backend `.env` file:

```bash
# In: byte-runner-backend/.env
ADMIN_EMAILS=your-email@example.com,second-admin@example.com
```

**Important:** 
- Use comma-separated list for multiple admins
- Must match the email you signed up with
- Case-insensitive matching

---

### 2. Run Database Migrations

If you haven't already, run the complete schema in Supabase SQL Editor:

```sql
-- Phase 1: Shares table (already done)
-- Phase 2: Contests tables
-- Phase 3: Badges tables

-- See: byte-runner-backend/supabase/schema.sql for full schema
```

---

### 3. Restart Backend

```bash
cd byte-runner-backend
npm run start:dev
```

The backend will load:
- AdminGuard middleware
- Contest admin endpoints
- Badge system
- Prize claims system

---

## 🎮 How to Use Admin Panel

### Access the Admin Panel

1. **Sign in** to the game with your admin email
2. Visit: `http://localhost:3000/admin`
3. If you're not admin, you'll be redirected with "Access denied" message

---

### Create a Contest

**Step 1: Click "Create New Contest"**

**Step 2: Fill the form:**

| Field | Example | Required |
|-------|---------|----------|
| Contest Name | "Launch Week Championship" | ✅ Yes |
| Description | "Compete for $1,000 in prizes!" | No |
| Start Date | Select date/time | ✅ Yes |
| End Date | Select date/time (7 days later) | ✅ Yes |
| Status | "active" to make live | ✅ Yes |
| Prize Pool | See JSON format below | No |

**Prize Pool JSON Format:**
```json
{
  "1": "$500 + Founder Badge",
  "2": "$250",
  "3": "$100",
  "4": "$25",
  "5": "$25",
  "6": "$25",
  "7": "$25",
  "8": "$25",
  "9": "$25",
  "10": "$25"
}
```

Or use ranges:
```json
{
  "1": "$500",
  "2-3": "$100 each",
  "4-10": "$25 each"
}
```

**Step 3: Click "Create Contest"**

Contest is now live! Users will see it on `/contests` page.

---

### Edit a Contest

1. Find contest in the list
2. Click **pencil icon** (Edit)
3. Modify any fields
4. Click "Update Contest"

**Common edits:**
- Change status from "upcoming" → "active" to start
- Change status from "active" → "ended" to close
- Update prize pool
- Extend end date

---

### Delete a Contest

1. Click **trash icon** (Delete)
2. Confirm deletion
3. Contest and all entries are removed

⚠️ **Warning:** This cannot be undone!

---

## 🎯 Contest Management Workflow

### Before Launch

```
1. Create contest with status: "upcoming"
2. Set start date to launch day
3. Announce contest on social media
4. Build hype! 🔥
```

### Launch Day

```
1. Edit contest → Change status to "active"
2. Users can now enter by playing
3. Monitor leaderboard: /contests/[id]
4. Watch entries roll in!
```

### During Contest

```
1. Check leaderboard regularly
2. Engage with top players on social
3. Share leaderboard updates
4. Create urgency ("Only 2 days left!")
```

### After Contest Ends

```
1. Edit contest → Change status to "ended"
2. Check final leaderboard
3. Manually create prize_claims for winners (SQL for now)
4. Contact winners via email
5. Process prizes
```

---

## 📊 Admin API Endpoints

Protected by `AdminGuard` (requires admin email):

**POST /contests/admin/create**
- Create new contest
- Body: CreateContestDto

**PATCH /contests/admin/:id**
- Update existing contest
- Body: Partial<CreateContestDto>

**DELETE /contests/admin/:id**
- Delete contest and all entries
- No body required

**GET /contests/admin/check**
- Verify admin access
- Returns: `{ isAdmin: true }`

---

## 🛡️ Security

**Admin Guard checks:**
1. ✅ User is authenticated (SuperTokens session)
2. ✅ User email is in ADMIN_EMAILS list
3. ✅ Case-insensitive email matching

**Protection:**
- All admin endpoints require both SupertokensGuard AND AdminGuard
- Non-admins get 401 Unauthorized
- No admin badge/UI shown to regular users

---

## 🎁 Prize Management (Manual for now)

After contest ends, manually create prize claims in Supabase:

```sql
-- For each winner (top 10):
INSERT INTO public.prize_claims (contest_id, user_id, rank, prize_description)
VALUES (
  'contest-uuid-here',
  'winner-user-uuid-here',
  1, -- their rank
  '$500 + Founder Badge'
);
```

Then email winners to claim their prizes.

**Future enhancement:** Auto-create prize claims when contest ends.

---

## 💡 Best Practices

### Contest Timing
- **Launch Week:** 7-day contest
- **Monthly:** Start 1st, end last day
- **Flash:** 24-48 hour contests for urgency

### Prize Structure
- **Top-heavy:** Big prize for 1st (attracts competitors)
- **Long tail:** Small prizes for 4-10 (more winners = more shares)
- **Founder badge:** Special recognition for early adopters

### Promotion
- Announce contest 3 days before start
- Daily leaderboard updates on social
- "Only X hours left!" urgency posts
- Winner announcement with screenshots

### Multiple Contests
- Run one major contest per month
- Add weekly mini-contests ($50-100 prize pool)
- Holiday-themed contests
- Community voting for next contest themes

---

## 🐛 Troubleshooting

**"Access denied" when visiting /admin:**
- Check ADMIN_EMAILS in .env
- Verify email matches your signup email
- Restart backend after changing .env
- Check backend logs for auth errors

**Contest form not submitting:**
- Check browser console for errors
- Verify all required fields filled
- Check date format (should be datetime-local)
- Prize pool JSON must be valid

**Contest not appearing on /contests:**
- Check contest status (must be 'active', 'upcoming', or 'ended')
- Verify dates are correct
- Check backend API: GET /contests

**Users can't enter contest:**
- Status must be "active"
- Current time must be between start_date and end_date
- Check backend logs for validation errors

---

## 📈 Contest Analytics (Future)

Future enhancements for admin dashboard:

- **Live stats:** Total entries, unique players, avg score
- **Entry timeline:** Graph of entries over time
- **Player demographics:** New vs returning players
- **Share tracking:** Contest-specific share counts
- **Export:** Download leaderboard as CSV
- **Bulk actions:** Clone contest, archive old contests
- **Preview mode:** Test contest before going live

---

## 🎊 Ready to Launch!

**Quick Start Checklist:**
- [ ] Add your email to ADMIN_EMAILS in .env
- [ ] Restart backend
- [ ] Visit /admin
- [ ] Create your first contest
- [ ] Set status to "active"
- [ ] Announce on social media
- [ ] Watch players compete! 🏆

---

**Questions?**
- Admin access not working? Check .env and email
- Need help with prize pool JSON? See examples above
- Want to add more admin features? Let me know!

**You're all set! Go create some contests! 🚀**
