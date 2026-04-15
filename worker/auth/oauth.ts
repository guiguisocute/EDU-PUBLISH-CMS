import type { GitHubViewer } from '../../types/github';
import type { WorkerEnv } from '../app';

const encoder = new TextEncoder();
const GITHUB_OAUTH_SCOPE = 'read:user repo';

type FetchLike = typeof fetch;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createRandomValue(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function getRequiredEnvValue(env: WorkerEnv, key: keyof WorkerEnv): string {
  const value = String(env[key] ?? '').trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function getOauthBaseUrl(env: WorkerEnv): string {
  return String(env.GITHUB_OAUTH_BASE_URL || 'https://github.com/login/oauth').replace(/\/+$/, '');
}

function getApiBaseUrl(env: WorkerEnv): string {
  return String(env.GITHUB_API_BASE_URL || 'https://api.github.com').replace(/\/+$/, '');
}

export async function createPkceChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

export async function createGitHubAuthorizationRequest(env: WorkerEnv): Promise<{
  state: string;
  codeVerifier: string;
  authorizationUrl: string;
}> {
  const clientId = getRequiredEnvValue(env, 'GITHUB_CLIENT_ID');
  const redirectUri = env.GITHUB_REDIRECT_URI
    ? String(env.GITHUB_REDIRECT_URI).trim()
    : `${String(env.APP_URL || '').replace(/\/+$/, '')}/api/auth/github/callback`;
    
  if (!redirectUri || redirectUri === '/api/auth/github/callback') {
    throw new Error('GITHUB_REDIRECT_URI or APP_URL is required.');
  }

  const state = createRandomValue(24);
  const codeVerifier = createRandomValue(48);
  const codeChallenge = await createPkceChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GITHUB_OAUTH_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    state,
    codeVerifier,
    authorizationUrl: `${getOauthBaseUrl(env)}/authorize?${params.toString()}`,
  };
}

export async function exchangeCodeForAccessToken(
  code: string,
  codeVerifier: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const clientId = getRequiredEnvValue(env, 'GITHUB_CLIENT_ID');
  const clientSecret = getRequiredEnvValue(env, 'GITHUB_CLIENT_SECRET');
  const redirectUri = env.GITHUB_REDIRECT_URI
    ? String(env.GITHUB_REDIRECT_URI).trim()
    : `${String(env.APP_URL || '').replace(/\/+$/, '')}/api/auth/github/callback`;
  const response = await fetchImpl(`${getOauthBaseUrl(env)}/access_token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error('GitHub token exchange failed.');
  }

  const payload = (await response.json()) as {
    access_token?: string;
  };

  if (!payload.access_token) {
    throw new Error('GitHub token exchange returned no access token.');
  }

  return payload.access_token;
}

export async function fetchGitHubViewer(
  accessToken: string,
  env: WorkerEnv,
  fetchImpl: FetchLike = fetch,
): Promise<GitHubViewer> {
  const response = await fetchImpl(`${getApiBaseUrl(env)}/user`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'edu-publish-cms',
    },
  });

  if (!response.ok) {
    throw new Error('GitHub user fetch failed.');
  }

  const payload = (await response.json()) as {
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
  };
  const login = String(payload.login ?? '').trim();

  if (!login) {
    throw new Error('GitHub user response was missing login.');
  }

  return {
    login,
    name: payload.name ?? null,
    avatarUrl: payload.avatar_url ?? null,
  };
}
