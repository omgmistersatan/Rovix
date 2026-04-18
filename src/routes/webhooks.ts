import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

const router = Router();

router.post('/vexopay', async (req, res, next) => {
  try {
    if (env.vexopayWebhookSecret) {
      const provided = req.header('x-webhook-secret');
      if (provided !== env.vexopayWebhookSecret) {
        return res.status(401).json({ error: 'Webhook não autorizado' });
      }
    }

    const body = req.body ?? {};
    const event = String(body.event ?? body.type ?? '');
    const transactionId = String(body.transactionId ?? body.id ?? body.data?.id ?? body.data?.transactionId ?? '');
    const externalId = String(body.external_id ?? body.externalId ?? body.data?.external_id ?? '');
    const providerStatus = String(body.status ?? body.data?.status ?? event ?? 'UNKNOWN');

    const order = await prisma.coinOrder.findFirst({
      where: {
        OR: [
          transactionId ? { providerOrderId: transactionId } : undefined,
          externalId ? { id: externalId } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!order) return res.json({ ok: true, ignored: true });

    const isPaidEvent = ['payment.completed', 'payment.approved', 'PAID', 'COMPLETED', 'APPROVED'].includes(providerStatus);
    if (isPaidEvent && order.status !== 'PAID') {
      await prisma.$transaction([
        prisma.coinOrder.update({
          where: { id: order.id },
          data: { status: 'PAID', providerStatus, paidAt: new Date() },
        }),
        prisma.user.update({ where: { id: order.userId }, data: { walletCoins: { increment: order.coins } } }),
      ]);
    } else {
      await prisma.coinOrder.update({ where: { id: order.id }, data: { providerStatus } });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
