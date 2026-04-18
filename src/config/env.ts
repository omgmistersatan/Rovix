import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/rovix?schema=public'),
  jwtSecret: required('JWT_SECRET', 'troque_esta_chave'),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:8080',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000',
  vexopayBaseUrl: process.env.VEXOPAY_BASE_URL ?? 'https://www.vexopay.com.br',
  vexopayClientId: required('VEXOPAY_CLIENT_ID', 'vxp_ci_SEU_CLIENT_ID'),
  vexopayClientSecret: required('VEXOPAY_CLIENT_SECRET', 'vxp_cs_SEU_CLIENT_SECRET'),
  webhookSharedSecret: process.env.WEBHOOK_SHARED_SECRET ?? 'troque_este_segredo',
};
