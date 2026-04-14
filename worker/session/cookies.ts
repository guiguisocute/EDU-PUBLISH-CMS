import type { GitHubViewer } from '../../types/github';
import type { WorkerEnv } from '../app';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE_NAME = 'edu_publish_session';
export const OAUTH_COOKIE_NAME = 'edu_publish_oauth';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_MAX_AGE_SECONDS = 60 * 10;

export interface SessionCookiePayload {
  accessToken: string;
  viewer: GitHubViewer;
  expiresAt: number;
}

export interface OAuthCookiePayload {
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

interface CookieOptions {
  maxAge: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function createIv(): Uint8Array {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));

  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function getSessionSecret(env: WorkerEnv): string {
  const secret = String(env.SESSION_SECRET ?? '').trim();

  if (!secret) {
    throw new Error('SESSION_SECRET is required.');
  }

  return secret;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
  ].join('; ');
}

function parseCookieHeader(value: string | null): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    value
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separatorIndex = item.indexOf('=');
        return separatorIndex === -1
          ? [item, '']
          : [item.slice(0, separatorIndex), item.slice(separatorIndex + 1)];
      }),
  );
}

async function encryptPayload(payload: unknown, secret: string): Promise<string> {
  const iv = createIv();
  const key = await deriveKey(secret);
  const cipherBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(payload)),
    ),
  );

  return `${toBase64Url(iv)}.${toBase64Url(cipherBytes)}`;
}

async function decryptPayload<T>(value: string, secret: string): Promise<T | null> {
  const [ivPart, cipherPart] = value.split('.');

  if (!ivPart || !cipherPart) {
    return null;
  }

  try {
    const key = await deriveKey(secret);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(cipherPart),
    );

    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch {
    return null;
  }
}

async function createEncryptedCookie(
  name: string,
  payload: unknown,
  env: WorkerEnv,
  maxAge: number,
): Promise<string> {
  const secret = getSessionSecret(env);
  const encryptedValue = await encryptPayload(payload, secret);
  return serializeCookie(name, encryptedValue, { maxAge });
}

async function readEncryptedCookie<T>(
  request: Request,
  env: WorkerEnv,
  name: string,
): Promise<T | null> {
  const secret = String(env.SESSION_SECRET ?? '').trim();

  if (!secret) {
    return null;
  }

  const cookieValue = parseCookieHeader(request.headers.get('cookie'))[name];

  if (!cookieValue) {
    return null;
  }

  return decryptPayload<T>(cookieValue, secret);
}

export async function createSessionCookie(
  payload: Omit<SessionCookiePayload, 'expiresAt'>,
  env: WorkerEnv,
): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  return createEncryptedCookie(
    SESSION_COOKIE_NAME,
    {
      ...payload,
      expiresAt,
    } satisfies SessionCookiePayload,
    env,
    SESSION_MAX_AGE_SECONDS,
  );
}

export async function readSessionCookie(
  request: Request,
  env: WorkerEnv,
): Promise<SessionCookiePayload | null> {
  const payload = await readEncryptedCookie<SessionCookiePayload>(
    request,
    env,
    SESSION_COOKIE_NAME,
  );

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE_NAME, '', { maxAge: 0 });
}

export async function createOAuthCookie(
  payload: Omit<OAuthCookiePayload, 'expiresAt'>,
  env: WorkerEnv,
): Promise<string> {
  const expiresAt = Date.now() + OAUTH_MAX_AGE_SECONDS * 1000;

  return createEncryptedCookie(
    OAUTH_COOKIE_NAME,
    {
      ...payload,
      expiresAt,
    } satisfies OAuthCookiePayload,
    env,
    OAUTH_MAX_AGE_SECONDS,
  );
}

export async function readOAuthCookie(
  request: Request,
  env: WorkerEnv,
): Promise<OAuthCookiePayload | null> {
  const payload = await readEncryptedCookie<OAuthCookiePayload>(
    request,
    env,
    OAUTH_COOKIE_NAME,
  );

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function clearOAuthCookie(): string {
  return serializeCookie(OAUTH_COOKIE_NAME, '', { maxAge: 0 });
}
