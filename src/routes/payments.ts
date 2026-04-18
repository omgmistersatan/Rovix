import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { createPixCharge, getPixStatus } from '../services/vexopay.js';

const router = Router();
router.use(requireAuth);

router.post('/pix-checkout', async (req, res, next) => {
  try {
    const { packId } = z.object({ packId: z.string().min(1) }).parse(req.body);
    const pack = await prisma.coinPack.findUnique({ where: { id: packId } });
    if (!pack || !pack.active) throw new HttpError(404, 'Pacote não encontrado');

    const order = await prisma.coinOrder.create({
      data: {
        userId: req.authUser!.id,
        coinPackId: pack.id,
        amount: pack.price,
        coins: pack.coins,
        status: 'PENDING',
      },
    });

    const provider = await createPixCharge({
      amount: Number(pack.price),
      description: `${pack.title} - Rovix Coins`,
      externalId: order.id,
    });

    const updated = await prisma.coinOrder.update({
      where: { id: order.id },
      data: {
        providerOrderId: provider.transactionId,
        providerStatus: provider.status,
        qrCodeText: provider.copyPaste,
        qrCodeImage: provider.qrCode,
        expiresAt: provider.expiresAt ? new Date(provider.expiresAt) : null,
      },
    });

    res.status(201).json({
      transactionId: provider.transactionId,
      orderId: updated.id,
      pix: {
        amount: Number(updated.amount),
        qrCode: updated.qrCodeImage,
        copyPaste: updated.qrCodeText,
        expiresAt: updated.expiresAt?.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pix-status', async (req, res, next) => {
  try {
    const transactionId = z.string().min(1).parse(req.query.transactionId);
    const order = await prisma.coinOrder.findFirst({ where: { providerOrderId: transactionId, userId: req.authUser!.id } });
    if (!order) throw new HttpError(404, 'Pedido não encontrado');

    const provider = await getPixStatus(transactionId);
    const providerStatus = provider.status;

    if (['PAID', 'COMPLETED', 'APPROVED'].includes(providerStatus.toUpperCase()) && order.status !== 'PAID') {
      await prisma.$transaction([
        prisma.coinOrder.update({
          where: { id: order.id },
          data: { status: 'PAID', providerStatus, paidAt: new Date() },
        }),
        prisma.user.update({
          where: { id: order.userId },
          data: { walletCoins: { increment: order.coins } },
        }),
      ]);
    } else {
      await prisma.coinOrder.update({ where: { id: order.id }, data: { providerStatus } });
    }

    const freshOrder = await prisma.coinOrder.findUniqueOrThrow({ where: { id: order.id } });
    res.json({
      data: {
        orderId: freshOrder.id,
        providerStatus: freshOrder.providerStatus,
        status: freshOrder.status,
        walletCredited: freshOrder.status === 'PAID',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
