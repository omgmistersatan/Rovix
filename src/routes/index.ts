import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { login, me, register } from '../controllers/auth.controller.js';
import { createPixCheckout, getCheckoutStatus } from '../controllers/checkout.controller.js';
import { createGame, getGame, listHome, listMyGames, publishGame } from '../controllers/game.controller.js';
import { myWallet } from '../controllers/wallet.controller.js';
import { handleVexopayWebhook } from '../controllers/webhook.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { verifyWebhookSecret } from '../middleware/webhook.middleware.js';

export const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));

router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.get('/api/auth/me', requireAuth, me);

router.get('/api/home', listHome);
router.get('/api/games/:slug', getGame);

router.get('/api/me/wallet', requireAuth, myWallet);
router.post('/api/checkout/pix', requireAuth, createPixCheckout);
router.get('/api/checkout/status/:transactionId', requireAuth, getCheckoutStatus);

router.get('/api/creator/games', requireAuth, requireRole([UserRole.CREATOR, UserRole.ADMIN]), listMyGames);
router.post('/api/creator/games', requireAuth, requireRole([UserRole.CREATOR, UserRole.ADMIN]), createGame);
router.post('/api/creator/games/:id/publish', requireAuth, requireRole([UserRole.CREATOR, UserRole.ADMIN]), publishGame);

router.post('/api/webhooks/vexopay', verifyWebhookSecret, handleVexopayWebhook);
