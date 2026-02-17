# Fraud Prevention Test Suite

## Overview

Comprehensive test script to verify all Phase 1 anti-fraud checks including edge cases.

## Setup

Make sure you have your Supabase credentials set in environment variables:

```bash
# .env file
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Running Tests

```bash
# Option 1: Using npm script
npm run test:fraud

# Option 2: Direct execution
npx ts-node test-fraud-prevention.ts
```

## What Gets Tested

### ✅ Test 1: Account Age Check (24 hour requirement)
- **1a**: New account (< 1h old) → Should be rejected
- **1b**: 23 hour old account → Should be rejected (edge case)
- **1c**: 25 hour old account → Should be accepted

### ✅ Test 2: Minimum Runs Check (5 games requirement)
- **2a**: 0 runs → Should be rejected
- **2b**: 4 runs → Should be rejected (edge case)
- **2c**: Exactly 5 runs → Should be accepted
- **2d**: 10 runs → Should be accepted

### ✅ Test 3: Daily Win Limit (3 wins per day max)
- **3a**: 0 wins today → Should be accepted
- **3b**: 2 wins today → Should be accepted
- **3c**: Exactly 3 wins today → Should be rejected for 4th attempt (edge case)
- **3d**: Wins from yesterday → Should not count towards today's limit

### ✅ Test 4: Withdrawal Velocity (1 per week max)
- **4a**: No previous withdrawal → Should be accepted
- **4b**: Withdrew 2 days ago → Should be rejected
- **4c**: Withdrew 6d 23h ago → Should be rejected (edge case)
- **4d**: Withdrew 8 days ago → Should be accepted

### ✅ Test 5: Fraud Score Accumulation (7-day window)
- **5a**: No fraud flags → Score = 0, should pass
- **5b**: Flags totaling 5 points → Should be accepted (below threshold)
- **5c**: Flags totaling 6 points → Should be rejected (at threshold)
- **5d**: Flags older than 7 days → Should not count towards score

## Test Output

The test suite provides detailed output:

```
============================================================
🛡️  FRAUD PREVENTION TEST SUITE
============================================================

📝 TEST 1: Account Age Check (24 hour requirement)
  ✅ New account correctly identified (age: 0.00h)
  ✅ 23h account correctly rejected (age: 23.00h)
  ✅ Old account correctly accepted (age: 25.00h)

📝 TEST 2: Minimum Runs Check (5 games requirement)
  ✅ User with 0 runs correctly identified
  ✅ User with 4 runs correctly rejected
  ✅ User with exactly 5 runs correctly accepted
  ✅ User with 10 runs correctly accepted

... (more tests)

============================================================
📊 TEST RESULTS SUMMARY
============================================================

Total Tests: 20
✅ Passed: 20
❌ Failed: 0
Success Rate: 100.0%

============================================================
```

## Edge Cases Covered

1. **Boundary Testing**
   - 23h vs 24h account age
   - 4 vs 5 runs
   - 2 vs 3 wins
   - 6d 23h vs 7d withdrawal interval

2. **Time Windows**
   - Daily reset for win limits (midnight boundary)
   - 7-day sliding window for fraud scores
   - Week boundary for withdrawal velocity

3. **Score Thresholds**
   - Score = 5 (passes) vs Score = 6 (fails)
   - Cumulative scoring from multiple flags
   - Expired flags exclusion

4. **Data Isolation**
   - Yesterday's wins don't affect today
   - Old fraud flags don't count
   - Separate user contexts

## Cleanup

The test script automatically cleans up all test data:
- Deletes all test users
- Cascades to delete runs, transactions, flags
- Leaves production data untouched

Test users are identifiable by:
- Username pattern: `*_test`
- Email pattern: `*@test.com`
- Supertokens ID: `test_*`

## Troubleshooting

### Error: SUPABASE_SERVICE_ROLE_KEY is required
**Fix**: Set the environment variable in your `.env` file

### Error: Connection refused
**Fix**: Make sure Supabase is running (local or cloud)

### Tests fail with "User not found"
**Fix**: Check that schema migrations have been applied

### Cleanup errors
**Fix**: Tests should still complete; manual cleanup may be needed

## What to Check After Running

1. **All tests pass** (100% success rate)
2. **No test data remains** (check users table)
3. **Fraud flags created during tests** (should be cleaned up)
4. **No errors in logs** (backend should show no errors)

## Integration with CI/CD

You can add this to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run fraud prevention tests
  run: npm run test:fraud
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Next Steps

After tests pass:
1. Deploy to staging
2. Run tests against staging
3. Monitor first few hours of production
4. Review fraud logs for false positives
5. Adjust thresholds if needed
