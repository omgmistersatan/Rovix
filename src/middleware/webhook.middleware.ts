import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const headerSecret = req.headers['x-webhook-secret'];

  if (env.webhookSharedSecret && headerSecret !== env.webhookSharedSecret) {
    return res.status(401).json({ success: false, error: 'Webhook não autorizado.' });
  }

  return next();
}
