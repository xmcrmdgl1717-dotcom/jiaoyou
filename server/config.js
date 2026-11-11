'use strict';

const port = Number(process.env.PORT || 3001);

module.exports = {
  port,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.PLAYBACK_SECRET || 'dev-only-change-me',
  trialSeconds: Number(process.env.TRIAL_SECONDS || 20),
  trialTokenTtl: process.env.TRIAL_TOKEN_TTL || '45s',
  paidTokenTtl: process.env.PAID_TOKEN_TTL || '2h',
};
