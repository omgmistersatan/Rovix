import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.jwtSecret, {
    subject: payload.sub,
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
