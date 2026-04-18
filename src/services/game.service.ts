import { GameStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listPublishedGames() {
  return prisma.game.findMany({
    where: { status: GameStatus.PUBLISHED },
    orderBy: [{ featured: 'desc' }, { visits: 'desc' }, { createdAt: 'desc' }],
    include: { creator: { select: { id: true, name: true } } },
  });
}

export async function listCreatorGames(creatorId: string) {
  return prisma.game.findMany({
    where: { creatorId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getGameBySlug(slug: string) {
  return prisma.game.findUnique({
    where: { slug },
    include: { creator: { select: { id: true, name: true } } },
  });
}

export async function createGame(params: {
  creatorId: string;
  title: string;
  description: string;
  genre: string;
  thumbnailUrl: string;
  studioName: string;
}) {
  const slug = slugify(params.title);

  return prisma.game.create({
    data: {
      creatorId: params.creatorId,
      title: params.title,
      slug: `${slug}-${Date.now()}`,
      description: params.description,
      genre: params.genre,
      thumbnailUrl: params.thumbnailUrl,
      studioName: params.studioName,
      status: GameStatus.DRAFT,
    },
  });
}

export async function publishGame(gameId: string, creatorId: string) {
  const game = await prisma.game.findFirst({ where: { id: gameId, creatorId } });
  if (!game) {
    throw new Error('Jogo não encontrado para este criador.');
  }

  return prisma.game.update({
    where: { id: gameId },
    data: { status: GameStatus.PUBLISHED },
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
