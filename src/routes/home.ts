import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const [games, packs] = await Promise.all([
      prisma.game.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }] }),
      prisma.coinPack.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    res.json({ games, coinPacks: packs });
  } catch (error) {
    next(error);
  }
});

router.get('/wallet', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.id }, select: { walletCoins: true } });
    res.json({ walletCoins: user.walletCoins });
  } catch (error) {
    next(error);
  }
});

export default router;
