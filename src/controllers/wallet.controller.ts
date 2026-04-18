import { Request, Response } from 'express';
import { getWallet } from '../services/wallet.service.js';

export async function myWallet(req: Request, res: Response) {
  try {
    const wallet = await getWallet(req.auth!.userId);
    return res.json({ success: true, data: wallet });
  } catch (error) {
    return res.status(404).json({ success: false, error: error instanceof Error ? error.message : 'Carteira não encontrada.' });
  }
}
