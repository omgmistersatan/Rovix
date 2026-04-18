import { prisma } from '../lib/prisma.js';

export async function getWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, walletCoins: true },
  });

  if (!user) {
    throw new Error('Usuário não encontrado.');
  }

  return user;
}
