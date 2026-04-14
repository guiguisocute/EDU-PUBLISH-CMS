export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  repo?: string;
  branch?: string;
  targetBranch?: string;
  baseHeadSha?: string;
  changedPathCount?: number;
}

function createRequestId(): string {
  return crypto.randomUUID();
}

function sanitizeRepo(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const owner = String((value as Record<string, unknown>).owner ?? '').trim();
  const name = String((value as Record<string, unknown>).name ?? '').trim();

  if (!owner || !name) {
    return undefined;
  }

  return `${owner}/${name}`;
}

export async function buildRequestLogContext(request: Request): Promise<RequestLogContext> {
  const url = new URL(request.url);
  const context: RequestLogContext = {
    requestId: createRequestId(),
    method: request.method.toUpperCase(),
    path: url.pathname,
  };

  if (!['POST', 'PUT', 'PATCH'].includes(context.method)) {
    return context;
  }

  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return context;
  }

  try {
    const payload = (await request.clone().json()) as Record<string, unknown>;

    context.repo = sanitizeRepo(payload.repo);
    context.branch = String(payload.branch ?? payload.baseBranch ?? '').trim() || undefined;
    context.targetBranch = String(payload.targetBranch ?? '').trim() || undefined;
    context.baseHeadSha = String(payload.baseHeadSha ?? '').trim() || undefined;
    context.changedPathCount = Array.isArray(payload.changes) ? payload.changes.length : undefined;
  } catch {
    // Ignore body parse errors and keep the minimal request metadata.
  }

  return context;
}

export function logRequestStart(context: RequestLogContext): void {
  console.info(JSON.stringify({
    event: 'worker.request.start',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    repo: context.repo ?? null,
    branch: context.branch ?? null,
    targetBranch: context.targetBranch ?? null,
    baseHeadSha: context.baseHeadSha ?? null,
    changedPathCount: context.changedPathCount ?? null,
  }));
}

export function logRequestEnd(
  context: RequestLogContext,
  response: Response,
  durationMs: number,
  errorMessage?: string,
): void {
  console.info(JSON.stringify({
    event: 'worker.request.end',
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status: response.status,
    latencyMs: Math.round(durationMs * 100) / 100,
    repo: context.repo ?? null,
    branch: context.branch ?? null,
    targetBranch: context.targetBranch ?? null,
    baseHeadSha: context.baseHeadSha ?? null,
    changedPathCount: context.changedPathCount ?? null,
    githubStatusCode: response.headers.get('x-github-status') ?? null,
    error: errorMessage ?? null,
  }));
}
