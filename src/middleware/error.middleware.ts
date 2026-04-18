import { NextFunction, Request, Response } from 'express';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  return res.status(500).json({
    success: false,
    error: err instanceof Error ? err.message : 'Erro inesperado.',
  });
}
