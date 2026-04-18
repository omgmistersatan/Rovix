import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import * as orderService from '../services/order.service.js';

export async function handleVexopayWebhook(req: Request, res: Response) {
  const payload = req.body as {
    event?: string;
    data?: {
      transactionId?: string;
      status?: string;
    };
  };

  const transactionId = payload.data?.transactionId;
  if (!transactionId) {
    return res.status(400).json({ success: false, error: 'transactionId ausente.' });
  }

  const status = normalize(payload.data?.status ?? payload.event ?? 'pending');
  await orderService.updateOrderByProviderTx(transactionId, mapOrderStatus(status), status);

  if (status === 'paid') {
    await orderService.creditOrderIfNeeded(transactionId);
  }

  return res.json({ success: true });
}

function normalize(status: string) {
  const value = String(status).toLowerCase();
  if (value === 'payment.completed' || value === 'completed') return 'paid';
  if (value === 'payment.failed') return 'failed';
  if (value === 'payment.expired') return 'expired';
  return value;
}

function mapOrderStatus(status: string): OrderStatus {
  if (status === 'paid') return OrderStatus.PAID;
  if (status === 'failed') return OrderStatus.FAILED;
  if (status === 'expired') return OrderStatus.EXPIRED;
  if (status === 'refunded') return OrderStatus.REFUNDED;
  return OrderStatus.PENDING;
}
