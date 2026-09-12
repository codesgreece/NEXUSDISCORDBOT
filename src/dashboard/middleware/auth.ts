import { NextFunction, Request, Response } from 'express';
import { getSessionUser } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user?.accessToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
