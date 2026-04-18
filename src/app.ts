import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import creatorRoutes from './routes/creator.js';
import homeRoutes from './routes/home.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import { HttpError } from './utils/httpError.js';

export const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if ((error as any)?.issues) {
    return res.status(400).json({ error: 'Dados inválidos', details: (error as any).issues });
  }
  return res.status(500).json({ error: 'Erro interno do servidor' });
});
