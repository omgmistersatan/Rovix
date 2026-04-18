import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireCreator } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { slugify } from '../utils/slug.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth, requireCreator);

const schema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().min(10).max(1000),
  genre: z.string().min(2).max(40),
  thumbnailUrl: z.string().url(),
  studioName: z.string().min(2).max(80),
});

router.get('/games', async (req, res, next) => {
  try {
    const games = await prisma.game.findMany({ where: { creatorId: req.authUser!.id }, orderBy: { createdAt: 'desc' } });
    res.json({ games });
  } catch (error) {
    next(error);
  }
});

router.post('/games', async (req, res, next) => {
  try {
    const payload = schema.parse(req.body);
    const baseSlug = slugify(payload.title) || 'game';
    const slug = `${baseSlug}-${Date.now()}`;
    const game = await prisma.game.create({
      data: {
        ...payload,
        slug,
        creatorId: req.authUser!.id,
      },
    });
    res.status(201).json({ game });
  } catch (error) {
    next(error);
  }
});

router.post('/games/:id/publish', async (req, res, next) => {
  try {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } });
    if (!game || game.creatorId != req.authUser!.id) throw new HttpError(404, 'Jogo não encontrado');
    const updated = await prisma.game.update({ where: { id: req.params.id }, data: { status: 'PUBLISHED' } });
    res.json({ game: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
