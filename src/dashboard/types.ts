import type { Request } from 'express';

export interface SessionUser {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string;
  avatar: string | null;
  accessToken: string;
  refreshToken?: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    oauthState?: string;
  }
}

export function getSessionUser(req: Request): SessionUser | undefined {
  return req.session.user;
}

export function getAvatarUrl(user: SessionUser): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  const index = user.discriminator === '0'
    ? Number(BigInt(user.id) >> 22n) % 6
    : Number(user.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
