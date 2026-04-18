import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../utils/hash.js';

export async function listCoinPacks() {
  return prisma.coinPack.findMany({
    where: { active: true },
    orderBy: { coins: 'asc' },
  });
}

export async function seedDefaults() {
  const packs = await prisma.coinPack.count();
  if (packs === 0) {
    await prisma.coinPack.createMany({
      data: [
        { title: 'Starter', description: 'Pacote de entrada', price: 9.9, coins: 80 },
        { title: 'Pro', description: 'Pacote mais popular', price: 24.9, coins: 230 },
        { title: 'Ultra', description: 'Pacote para builders', price: 49.9, coins: 500 },
      ],
    });
  }

  let creator = await prisma.user.findFirst({ where: { role: UserRole.CREATOR } });
  if (!creator) {
    creator = await prisma.user.create({
      data: {
        name: 'Rovix Studio',
        email: 'creator@rovix.local',
        passwordHash: await hashPassword('12345678'),
        role: UserRole.CREATOR,
        creatorBio: 'Conta demo para popular o catálogo inicial.'
      }
    });
  }

  const games = await prisma.game.count();
  if (games === 0) {
    if (creator) {
      await prisma.game.createMany({
        data: [
          {
            title: 'Sky Builders',
            slug: 'sky-builders-demo',
            description: 'Construa ilhas flutuantes e dispute recursos.',
            genre: 'Sandbox',
            thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop',
            studioName: 'Rovix Labs',
            creatorId: creator.id,
            status: 'PUBLISHED',
            featured: true,
            playersOnline: 234,
            visits: 12000,
          },
          {
            title: 'Neon Racers',
            slug: 'neon-racers-demo',
            description: 'Corridas arcade com pistas criadas pela comunidade.',
            genre: 'Racing',
            thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
            studioName: 'Rovix Labs',
            creatorId: creator.id,
            status: 'PUBLISHED',
            playersOnline: 98,
            visits: 7400,
          }
        ]
      });
    }
  }
}
