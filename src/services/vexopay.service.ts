import axios from 'axios';
import { env } from '../config/env.js';

const client = axios.create({
  baseURL: env.vexopayBaseUrl,
  timeout: 15000,
  headers: {
    ci: env.vexopayClientId,
    cs: env.vexopayClientSecret,
    'Content-Type': 'application/json',
  },
});

type CreatePixInput = {
  amount: number;
  externalId: string;
  payerName: string;
  description: string;
};

export async function createPixCharge(input: CreatePixInput) {
  const payload = {
    amount: input.amount,
    external_id: input.externalId,
    description: input.description,
    payerName: input.payerName,
    postbackUrl: `${env.appBaseUrl}/api/webhooks/vexopay`,
  };

  const response = await client.post('/api/gateway/pix-create', payload);
  return normalizeCreatePixResponse(response.data);
}

export async function getPixStatus(transactionId: string) {
  const response = await client.get('/api/gateway/pix-status', {
    params: { transactionId },
  });
  return normalizeStatusResponse(response.data);
}

function normalizeCreatePixResponse(data: any) {
  return {
    transactionId: data.transactionId ?? data.id ?? data.data?.transactionId,
    status: normalizeStatus(data.status ?? data.data?.status ?? 'pending'),
    copyPaste: data.qrcode ?? data.pixCode ?? data.copyPaste ?? data.data?.qrcode ?? '',
    qrCodeBase64: data.qrcode_base64 ?? data.qrCodeBase64 ?? data.data?.qrcode_base64 ?? '',
    expiresAt: data.expires_at ?? data.expiresAt ?? data.data?.expires_at ?? null,
    raw: data,
  };
}

function normalizeStatusResponse(data: any) {
  return {
    transactionId: data.transactionId ?? data.id ?? data.data?.transactionId,
    status: normalizeStatus(data.status ?? data.data?.status ?? 'pending'),
    raw: data,
  };
}

function normalizeStatus(status: string) {
  const value = String(status).toLowerCase();
  if (['paid', 'completed', 'approved'].includes(value)) return 'paid';
  if (['expired'].includes(value)) return 'expired';
  if (['failed', 'canceled', 'cancelled'].includes(value)) return 'failed';
  if (['refunded'].includes(value)) return 'refunded';
  return 'pending';
}
