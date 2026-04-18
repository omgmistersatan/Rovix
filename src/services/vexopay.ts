import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const BASE_URL = 'https://www.vexopay.com.br';

type CreatePixInput = {
  amount: number;
  description: string;
  externalId: string;
};

type ProviderResult = {
  transactionId: string;
  status: string;
  qrCode: string;
  copyPaste: string;
  expiresAt?: string;
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ci: env.vexopayClientId,
    cs: env.vexopayClientSecret,
  };
}

function pick(obj: any, keys: string[]): any {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function normalizeCreateResponse(json: any): ProviderResult {
  return {
    transactionId: String(pick(json, ['id', 'transactionId', 'txid'])),
    status: String(pick(json, ['status', 'providerStatus']) ?? 'PENDING'),
    qrCode: String(pick(json, ['qr_code_base64', 'qrCodeBase64', 'qrcode_base64', 'qrCode']) ?? ''),
    copyPaste: String(pick(json, ['pix_code', 'copyPaste', 'qrcode', 'qr_code']) ?? ''),
    expiresAt: pick(json, ['expires_at', 'expiresAt']),
  };
}

function normalizeStatusResponse(json: any) {
  return {
    status: String(pick(json, ['status', 'providerStatus']) ?? 'PENDING'),
    raw: json,
  };
}

export async function createPixCharge(input: CreatePixInput): Promise<ProviderResult> {
  if (!env.vexopayClientId || !env.vexopayClientSecret) {
    throw new HttpError(500, 'Configure VEXOPAY_CLIENT_ID e VEXOPAY_CLIENT_SECRET');
  }

  const response = await fetch(`${BASE_URL}/api/gateway/pix-create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      amount: input.amount,
      description: input.description,
      external_id: input.externalId,
      webhook_url: `${env.appBaseUrl}/api/webhooks/vexopay`,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, `Erro VexoPay: ${JSON.stringify(json)}`);
  return normalizeCreateResponse(json);
}

export async function getPixStatus(transactionId: string) {
  const url = new URL(`${BASE_URL}/api/gateway/pix-status`);
  url.searchParams.set('id', transactionId);

  const response = await fetch(url, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, `Erro VexoPay: ${JSON.stringify(json)}`);
  return normalizeStatusResponse(json);
}
