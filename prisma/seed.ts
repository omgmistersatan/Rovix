import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, GameStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('12345678', 10);

  const creator = await prisma.user.upsert({
    where: { email: 'creator@rovix.local' },
    update: {},
    create: {
      name: 'Creator Demo',
      email: 'creator@rovix.local',
      passwordHash,
      role: UserRole.CREATOR,
      walletCoins: 250,
    },
  });

  await prisma.coinPack.upsert({
    where: { id: 'starter-pack' },
    update: {},
    create: { id: 'starter-pack', title: 'Starter Pack', description: 'Para começar rápido', price: '9.90', coins: 800 },
  });
  await prisma.coinPack.upsert({
    where: { id: 'pro-pack' },
    update: {},
    create: { id: 'pro-pack', title: 'Pro Pack', description: 'Mais moedas para a sua conta', price: '24.90', coins: 2300 },
  });
  await prisma.coinPack.upsert({
    where: { id: 'mega-pack' },
    update: {},
    create: { id: 'mega-pack', title: 'Mega Pack', description: 'Pacote popular', price: '49.90', coins: 5000 },
  });

  await prisma.game.upsert({
    where: { slug: 'sky-blocks-demo' },
    update: {},
    create: {
      title: 'Sky Blocks Demo',
      slug: 'sky-blocks-demo',
      description: 'Sandbox social com exploração e crafting.',
      genre: 'Sandbox',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200',
      studioName: 'Rovix Labs',
      featured: true,
      status: GameStatus.PUBLISHED,
      playersOnline: 124,
      visits: 19874,
      creatorId: creator.id,
    },
  });

  await prisma.game.upsert({
    where: { slug: 'tower-run-demo' },
    update: {},
    create: {
      title: 'Tower Run Demo',
      slug: 'tower-run-demo',
      description: 'Corrida casual com fases rápidas e multiplayer.',
      genre: 'Obby',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200',
      studioName: 'Studio Nova',
      featured: true,
      status: GameStatus.PUBLISHED,
      playersOnline: 48,
      visits: 8930,
      creatorId: creator.id,
    },
  });
}

main().finally(async () => prisma.$disconnect());
