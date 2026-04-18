import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { prisma } from '../lib/prisma.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function register(req: Request, res: Response) {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);

    return res.status(201).json({
      success: true,
      data: {
        token: result.token,
        user: sanitizeUser(result.user),
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Erro ao registrar.' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);

    return res.json({
      success: true,
      data: {
        token: result.token,
        user: sanitizeUser(result.user),
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Erro ao autenticar.' });
  }
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.auth?.userId } });
  if (!user) {
    return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
  }

  return res.json({ success: true, data: sanitizeUser(user) });
}

function sanitizeUser(user: { id: string; name: string; email: string; role: UserRole; walletCoins: number; creatorBio: string | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletCoins: user.walletCoins,
    creatorBio: user.creatorBio,
  };
}
