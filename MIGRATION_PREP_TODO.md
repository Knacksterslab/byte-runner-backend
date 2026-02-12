# Migration Prep TODO

**When to do this:** When you hit 10-20K active users or $5K+ MRR

**Estimated effort:** 1-2 weeks of focused work

---

## Priority 1: Infrastructure Basics (Do when planning migration)

### 1. Containerization (2-4 hours)
**Why:** Makes deployment platform-agnostic

- [ ] Create `Dockerfile` for backend
- [ ] Create `Dockerfile` for frontend
- [ ] Create `docker-compose.yml` for local development
- [ ] Test local Docker setup
- [ ] Update deployment docs

**Files to create:**
```dockerfile
# byte-runner-backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start:prod"]
```

---

### 2. Database Abstraction Layer (4-8 hours)
**Why:** Swap Supabase for raw Postgres easily

- [ ] Create `src/database/database.interface.ts`
- [ ] Create `src/database/adapters/supabase.adapter.ts`
- [ ] Refactor services to use interface instead of `supabaseService.getClient()`
- [ ] Prepare `postgres.adapter.ts` template (don't implement yet)

**Pattern:**
```typescript
export interface IDatabaseClient {
  from(table: string): QueryBuilder;
  // Add other methods as needed
}
```

---

### 3. Connection Pooling (1-2 hours)
**Why:** Essential for handling concurrent users at scale

- [ ] Add `pg-pool` or connection pooler
- [ ] Configure pool size based on environment
- [ ] Test under load
- [ ] Monitor connection usage

**Add to Supabase config:**
```typescript
{ 
  db: {
    poolSize: process.env.DB_POOL_SIZE || 10
  }
}
```

---

## Priority 2: SuperTokens Self-Hosting Prep (Do 1 month before migration)

### 4. SuperTokens Migration Plan (8-16 hours when executing)
**Why:** Most complex part of migration

- [ ] Document current SuperTokens setup
- [ ] Research SuperTokens self-hosting requirements
- [ ] Plan user/session data export strategy
- [ ] Set up test SuperTokens Core instance
- [ ] Test authentication flow with self-hosted version
- [ ] Plan downtime window for cutover

**Resources:**
- https://supertokens.com/docs/community/getting-started/installation
- Export users from cloud dashboard

---

## Priority 3: Documentation (Do incrementally)

### 5. Infrastructure Documentation (30 mins - 1 hour)

- [ ] Document all environment variables and their purpose
- [ ] List all external services and their configs
- [ ] Document database schema and migrations
- [ ] Create deployment runbook
- [ ] Document monitoring/alerting setup

**Create file:** `INFRASTRUCTURE.md`

---

## Priority 4: Monitoring & Observability (Do before 5K users)

### 6. Add Monitoring (2-4 hours)

- [ ] Add application logging (Winston/Pino)
- [ ] Add performance monitoring (consider Sentry)
- [ ] Add database query logging
- [ ] Set up error alerting
- [ ] Create basic metrics dashboard

---

## Migration Checklist (Use when actually migrating)

### Pre-Migration
- [ ] Backup all databases (Supabase export)
- [ ] Document current infrastructure
- [ ] Set up new VPS
- [ ] Install Docker on VPS
- [ ] Configure firewall rules
- [ ] Set up SSL certificates
- [ ] Configure domain DNS

### Database Migration
- [ ] Export Supabase data (`pg_dump`)
- [ ] Set up new Postgres instance
- [ ] Import data to new Postgres
- [ ] Test data integrity
- [ ] Set up backups on new instance

### SuperTokens Migration
- [ ] Deploy self-hosted SuperTokens Core
- [ ] Export users from SuperTokens Cloud
- [ ] Import users to self-hosted
- [ ] Test authentication flow
- [ ] Update connection string in `.env`

### Application Deployment
- [ ] Build Docker images
- [ ] Deploy backend container
- [ ] Deploy frontend container
- [ ] Update environment variables
- [ ] Test all endpoints

### Cutover
- [ ] Schedule maintenance window
- [ ] Update DNS to point to new VPS
- [ ] Monitor error rates
- [ ] Test user flows
- [ ] Roll back plan if needed

### Post-Migration
- [ ] Monitor for 48 hours
- [ ] Check error logs
- [ ] Verify backups working
- [ ] Document any issues
- [ ] Cancel old services (after 1 week of stability)

---

## Cost Comparison

### Current (Managed Services)
- Railway: $20-200/mo
- Supabase Pro: $25/mo
- SuperTokens Cloud: $99-299/mo
- **Total: $144-524/mo at 10K users**

### After Migration (Self-hosted)
- VPS (8GB RAM, 4 vCPU): $40-80/mo
- Managed Postgres: $50-150/mo (or self-host for free)
- Self-hosted SuperTokens: $0
- **Total: $90-230/mo**

**Savings: ~$50-300/mo**

---

## When NOT to Migrate

Don't migrate if:
- You have < 5,000 monthly active users
- Current costs are < $500/mo
- You're not hitting performance issues
- Your current stack is working fine

**Remember:** Premature optimization is the root of all evil. Ship features first!
