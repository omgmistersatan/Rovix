import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import type { UserRole } from '@prisma/client';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token ausente.' });
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido.' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, error: 'Acesso negado.' });
    }
    return next();
  };
}
