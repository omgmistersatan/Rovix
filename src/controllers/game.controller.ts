import { Request, Response } from 'express';
import { z } from 'zod';
import * as gameService from '../services/game.service.js';
import * as storeService from '../services/store.service.js';

const createGameSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  genre: z.string().min(2),
  thumbnailUrl: z.string().url(),
  studioName: z.string().min(2),
});

export async function listHome(_req: Request, res: Response) {
  const [games, coinPacks] = await Promise.all([
    gameService.listPublishedGames(),
    storeService.listCoinPacks(),
  ]);

  return res.json({ success: true, data: { games, coinPacks } });
}

export async function getGame(req: Request, res: Response) {
  const game = await gameService.getGameBySlug(req.params.slug);
  if (!game) {
    return res.status(404).json({ success: false, error: 'Jogo não encontrado.' });
  }
  return res.json({ success: true, data: game });
}

export async function createGame(req: Request, res: Response) {
  try {
    const body = createGameSchema.parse(req.body);
    const game = await gameService.createGame({
      creatorId: req.auth!.userId,
      ...body,
    });
    return res.status(201).json({ success: true, data: game });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Erro ao criar jogo.' });
  }
}

export async function listMyGames(req: Request, res: Response) {
  const games = await gameService.listCreatorGames(req.auth!.userId);
  return res.json({ success: true, data: games });
}

export async function publishGame(req: Request, res: Response) {
  try {
    const game = await gameService.publishGame(req.params.id, req.auth!.userId);
    return res.json({ success: true, data: game });
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Erro ao publicar jogo.' });
  }
}
