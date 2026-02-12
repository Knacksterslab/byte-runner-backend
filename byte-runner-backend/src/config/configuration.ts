export default () => ({
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    apiDomain: process.env.API_DOMAIN || 'http://localhost:3000',
    websiteDomain: process.env.WEBSITE_DOMAIN || 'http://localhost:3000',
    appName: process.env.APP_NAME || 'Byte Runner',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  supertokens: {
    connectionUri: process.env.SUPERTOKENS_CONNECTION_URI || '',
    apiKey: process.env.SUPERTOKENS_API_KEY || '',
    apiBasePath: process.env.SUPERTOKENS_API_BASE_PATH || '/auth',
    websiteBasePath: process.env.SUPERTOKENS_WEBSITE_BASE_PATH || '/auth',
  },
  runs: {
    runTokenSecret: process.env.RUN_TOKEN_SECRET || '',
    runTokenTtlSeconds: parseInt(process.env.RUN_TOKEN_TTL_SECONDS || '3600', 10),
    maxScorePerSecond: parseInt(process.env.MAX_SCORE_PER_SECOND || '500', 10),
    maxDistancePerSecond: parseInt(process.env.MAX_DISTANCE_PER_SECOND || '200', 10),
  },
  rateLimit: {
    ttlSeconds: parseInt(process.env.RATE_LIMIT_TTL_SECONDS || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_LIMIT || '15', 10),
  },
  leaderboard: {
    windowHours: parseInt(process.env.LEADERBOARD_WINDOW_HOURS || '24', 10),
  },
  admin: {
    emails: process.env.ADMIN_EMAILS?.split(',') || [],
  },
});
