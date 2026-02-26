# 🚀 Tron Auto-Payment Setup Guide

This guide will help you set up automated USDT payments on Tron testnet.

---

## 📋 Phase 1: Local Development Setup (30 minutes)

### Step 1: Generate Testnet Wallet

```bash
cd byte-runner-backend
npx ts-node scripts/generate-tron-wallet.ts
```

This will output:
- **Address**: Your wallet address (starts with T...)
- **Private Key**: Keep this SECRET!
- **Explorer URL**: View your wallet

**⚠️ IMPORTANT**: Save the private key securely! Never commit to git!

---

### Step 2: Get Free Testnet Tokens

1. Go to: https://www.trongrid.io/shasta
2. Enter your wallet address from Step 1
3. Click "Get TRX" (for gas fees) - get ~1000 TRX
4. Click "Get Test USDT" - get ~1000 USDT

**Verify**: Visit the explorer URL to see your tokens arrive (30-60 seconds)

---

### Step 3: Configure Environment

Copy the example file:
```bash
cp .env.tron.example .env.local
```

Edit `.env` or `.env.local` and add:
```env
TRON_NETWORK=shasta
TRON_HOT_WALLET_ADDRESS=<your_address_from_step1>
TRON_HOT_WALLET_PRIVATE_KEY=<your_private_key_from_step1>
USDT_CONTRACT_ADDRESS=TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs
MAX_DAILY_PAYOUT_USDT=1000
MAX_SINGLE_PAYOUT_USDT=100
HOT_WALLET_MIN_BALANCE_USDT=10
```

---

### Step 4: Start Backend

```bash
npm run start:dev
```

You should see:
```
✅ TronWeb connected successfully
Hot wallet balance: 1000 TRX, 1000 USDT
```

---

## 🧪 Phase 2: Test Transfers (15 minutes)

### Test 1: Check Balance

Open your browser console and check backend logs for wallet balance.

### Test 2: Create Test Withdrawal

1. Sign in to your app
2. Play game and earn $1 from hourly challenge
3. Go to profile → Request withdrawal
4. Enter:
   - Amount: $1.00
   - Payment Method: USDT
   - Tron Address: (create another test wallet or use https://testnet.bittorrent.com/faucet)

### Test 3: Process Withdrawal

**Option A: Auto-approve small amounts**
Edit `balance.service.ts` to auto-approve amounts < $10 for testing.

**Option B: Manual testing**
```bash
# In your database or admin panel, approve the withdrawal:
UPDATE withdrawals SET status = 'approved' WHERE id = '<withdrawal_id>';

# Then in your backend, trigger processing:
# (You'll need to add an endpoint or call this manually)
```

**View Transaction**:
- Check backend logs for TxID
- Visit: https://shasta.tronscan.org/#/transaction/<txid>

---

## 🔐 Phase 3: Security Checklist

### Before Production:

- [ ] Generate MAINNET wallet using hardware wallet (Ledger/Trezor)
- [ ] **NEVER** use the testnet private key
- [ ] Set up TronGrid Pro account for API key
- [ ] Fund hot wallet with limited amount ($50-100 max)
- [ ] Lower daily limits: MAX_DAILY_PAYOUT_USDT=50
- [ ] Lower single limits: MAX_SINGLE_PAYOUT_USDT=10
- [ ] Set up monitoring alerts for low balance
- [ ] Test refill process from cold wallet
- [ ] Add admin notifications for failures
- [ ] Enable withdrawal review for amounts > $5
- [ ] Document emergency procedures

---

## 📊 Phase 4: Monitoring & Maintenance

### Daily Checks:
1. Hot wallet balance (TRX and USDT)
2. Failed transactions count
3. Daily payout total
4. Fraud flags

### Weekly Tasks:
1. Refill hot wallet if needed
2. Review failed withdrawals
3. Check transaction costs
4. Review fraud patterns

### Monthly Tasks:
1. Rotate hot wallet if high volume
2. Review security practices
3. Update safety limits based on usage

---

## 🔧 Troubleshooting

### "Insufficient TRX for gas fees"
- Each USDT transfer costs ~5-10 TRX
- Keep at least 50 TRX in hot wallet
- Refill when below 20 TRX

### "Transaction timeout"
- Network might be slow
- Transaction likely still succeeded, check explorer
- Wait for confirmation before retrying

### "Invalid Tron address"
- User entered wrong address format
- Address must start with 'T'
- Must be 34 characters long

### "Daily limit reached"
- Safety feature working correctly
- Wait until next day (UTC midnight)
- Or increase MAX_DAILY_PAYOUT_USDT

---

## 📚 Useful Links

- **Testnet Faucet**: https://www.trongrid.io/shasta
- **Testnet Explorer**: https://shasta.tronscan.org
- **TronGrid API**: https://www.trongrid.io/
- **TronWeb Docs**: https://developers.tron.network/docs/tronweb
- **Mainnet Explorer**: https://tronscan.org

---

## 🎯 Next Steps

After testnet works perfectly:

1. **Get TronGrid Pro API Key** ($49/month for 100K requests)
2. **Generate Production Wallet** (use hardware wallet!)
3. **Update environment variables** to mainnet
4. **Fund hot wallet** with small amount first ($50)
5. **Test with small withdrawal** ($1)
6. **Monitor closely** for first week
7. **Gradually increase** hot wallet balance

---

## ⚠️ Production Environment Variables

```env
# PRODUCTION - Use these values
TRON_NETWORK=mainnet
TRONGRID_API_KEY=<your_trongrid_pro_key>
TRON_HOT_WALLET_ADDRESS=<hardware_wallet_address>
TRON_HOT_WALLET_PRIVATE_KEY=<encrypted_private_key>
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
MAX_DAILY_PAYOUT_USDT=50
MAX_SINGLE_PAYOUT_USDT=10
HOT_WALLET_MIN_BALANCE_USDT=20
```

**Set these in Railway:**
1. Go to your Railway project
2. Settings → Variables
3. Add each variable
4. Redeploy

---

Good luck! 🎉
