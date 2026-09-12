import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`[CONFIG] Missing required environment variable: ${key}`);
    console.error(`[CONFIG] Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key]?.trim() || fallback;
}

/** Bot credentials (always required) */
const token = requireEnv('DISCORD_TOKEN');
const clientId = requireEnv('CLIENT_ID');
const guildId = requireEnv('GUILD_ID');

/** OAuth / dashboard — optional at boot; validated when dashboard routes need them */
const discordClientId = optionalEnv('DISCORD_CLIENT_ID', clientId);
const discordClientSecret = optionalEnv('DISCORD_CLIENT_SECRET');
const discordRedirectUri = optionalEnv(
  'DISCORD_REDIRECT_URI',
  'http://localhost:3001/api/auth/callback',
);
const sessionSecret = optionalEnv('SESSION_SECRET', 'dev-change-me-nexus-session');
const databaseUrl = optionalEnv('DATABASE_URL', path.join(process.cwd(), 'data', 'nexus.sqlite'));
const port = Number(optionalEnv('PORT', '3001'));
const dashboardOrigin = optionalEnv('DASHBOARD_ORIGIN', 'http://localhost:5173');

export const config = {
  token,
  clientId,
  guildId,
  discordClientId,
  discordClientSecret,
  discordRedirectUri,
  sessionSecret,
  databaseUrl,
  port,
  dashboardOrigin,
  isProd: process.env.NODE_ENV === 'production',
} as const;

export function assertDashboardAuthConfig(): void {
  if (!config.discordClientSecret) {
    throw new Error(
      'DISCORD_CLIENT_SECRET is required for Discord OAuth. Add it to your .env file.',
    );
  }
  if (!config.sessionSecret || config.sessionSecret === 'dev-change-me-nexus-session') {
    if (config.isProd) {
      throw new Error('SESSION_SECRET must be set to a strong value in production.');
    }
    console.warn('[CONFIG] Using default SESSION_SECRET — set a strong value before production.');
  }
}
