import cors from 'cors';
import express from 'express';
import { router } from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(router);
app.use(errorMiddleware);
