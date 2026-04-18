import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function createOrder(params: { userId: string; coinPackId: string; amount: number; coins: number }) {
  return prisma.order.create({
    data: {
      userId: params.userId,
      coinPackId: params.coinPackId,
      amount: new Prisma.Decimal(params.amount),
      coins: params.coins,
      status: OrderStatus.PENDING,
    },
  });
}

export async function attachProviderTx(orderId: string, providerTxId: string, providerStatus?: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      providerTxId,
      providerStatus,
    },
  });
}

export async function updateOrderByProviderTx(providerTxId: string, status: OrderStatus, providerStatus: string) {
  return prisma.order.update({
    where: { providerTxId },
    data: {
      status,
      providerStatus,
    },
  });
}

export async function creditOrderIfNeeded(providerTxId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { providerTxId } });
    if (!order) {
      throw new Error('Pedido não encontrado para a transação.');
    }

    if (order.creditedAt) {
      return order;
    }

    await tx.user.update({
      where: { id: order.userId },
      data: { walletCoins: { increment: order.coins } },
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        creditedAt: new Date(),
      },
    });
  });
}
