import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { signAccessToken } from '../utils/jwt.js';

const router = Router();

const passwordSchema = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres').max(72);
const registerSchema = z.object({
  name: z.string().min(2, 'Informe seu nome').max(60),
  email: z.string().email('Email inválido').transform((value) => value.toLowerCase().trim()),
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.enum(['PLAYER', 'CREATOR']).default('PLAYER'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'As senhas não coincidem' });
  }
  if (!/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Use maiúscula, minúscula e número' });
  }
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
});

function toUserResponse(user: { id: string; name: string; email: string; role: string; walletCoins: number }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletCoins: user.walletCoins,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: payload.email } });
    if (exists) throw new HttpError(409, 'Email já cadastrado');

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        role: payload.role,
      },
    });

    const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new HttpError(401, 'Email ou senha inválidos');

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) throw new HttpError(401, 'Email ou senha inválidos');

    const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ token, user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.id } });
    res.json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
