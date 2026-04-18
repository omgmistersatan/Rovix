import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import * as orderService from '../services/order.service.js';
import * as vexopayService from '../services/vexopay.service.js';

export async function createPixCheckout(req: Request, res: Response) {
  const { packId } = req.body as { packId?: string };
  if (!packId) {
    return res.status(400).json({ success: false, error: 'packId é obrigatório.' });
  }

  const [user, pack] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.auth!.userId } }),
    prisma.coinPack.findUnique({ where: { id: packId } }),
  ]);

  if (!user || !pack) {
    return res.status(404).json({ success: false, error: 'Usuário ou pacote não encontrado.' });
  }

  const order = await orderService.createOrder({
    userId: user.id,
    coinPackId: pack.id,
    amount: Number(pack.price),
    coins: pack.coins,
  });

  const pix = await vexopayService.createPixCharge({
    amount: Number(pack.price),
    externalId: order.id,
    payerName: user.name,
    description: `Rovix Coins - ${pack.title}`,
  });

  await orderService.attachProviderTx(order.id, pix.transactionId, pix.status);

  return res.status(201).json({
    success: true,
    data: {
      orderId: order.id,
      pack,
      pix,
    },
  });
}

export async function getCheckoutStatus(req: Request, res: Response) {
  const { transactionId } = req.params;
  const payment = await vexopayService.getPixStatus(transactionId);
  const normalized = mapOrderStatus(payment.status);

  await orderService.updateOrderByProviderTx(transactionId, normalized, payment.status);
  if (payment.status === 'paid') {
    await orderService.creditOrderIfNeeded(transactionId);
  }

  const wallet = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { walletCoins: true },
  });

  return res.json({ success: true, data: { payment, walletCoins: wallet?.walletCoins ?? 0 } });
}

function mapOrderStatus(status: string): OrderStatus {
  if (status === 'paid') return OrderStatus.PAID;
  if (status === 'failed') return OrderStatus.FAILED;
  if (status === 'expired') return OrderStatus.EXPIRED;
  if (status === 'refunded') return OrderStatus.REFUNDED;
  return OrderStatus.PENDING;
}
