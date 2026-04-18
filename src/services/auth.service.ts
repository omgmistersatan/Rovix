import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { signAccessToken } from '../utils/jwt.js';

export async function register(params: { name: string; email: string; password: string; role?: UserRole }) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) {
    throw new Error('E-mail já cadastrado.');
  }

  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email,
      passwordHash,
      role: params.role ?? UserRole.PLAYER,
    },
  });

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  return { user, token };
}

export async function login(params: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: params.email } });
  if (!user) {
    throw new Error('Credenciais inválidas.');
  }

  const ok = await comparePassword(params.password, user.passwordHash);
  if (!ok) {
    throw new Error('Credenciais inválidas.');
  }

  const token = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  return { user, token };
}
