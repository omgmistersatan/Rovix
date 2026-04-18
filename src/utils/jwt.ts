import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = { sub: string; email: string; role: string };

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
