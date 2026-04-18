import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:8080',
  vexopayClientId: process.env.VEXOPAY_CLIENT_ID ?? '',
  vexopayClientSecret: process.env.VEXOPAY_CLIENT_SECRET ?? '',
  vexopayWebhookSecret: process.env.VEXOPAY_WEBHOOK_SECRET ?? '',
};
