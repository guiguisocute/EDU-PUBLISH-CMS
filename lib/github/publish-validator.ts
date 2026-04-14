import type { PublishChange, PublishRequest } from '../../types/github';

export interface ValidatedPublishChange extends PublishChange {
  path: string;
}

export interface ValidatedPublishRequest extends Omit<PublishRequest, 'changes' | 'commitMessage' | 'baseBranch' | 'targetBranch' | 'baseHeadSha'> {
  baseBranch: string;
  targetBranch: string;
  baseHeadSha: string;
  commitMessage: string;
  changes: ValidatedPublishChange[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '');
}

export function isAllowedPublishPath(path: string): boolean {
  return path.startsWith('content/card/') || path.startsWith('content/attachments/');
}

export function validateBranchName(branch: string): void {
  if (!branch) {
    throw new Error('Branch name is required.');
  }

  if (
    branch.startsWith('/')
    || branch.endsWith('/')
    || branch.includes('..')
    || /[\s~^:?*\[\\]/.test(branch)
    || branch.endsWith('.lock')
  ) {
    throw new Error(`Invalid branch name: ${branch}`);
  }
}

export function validatePublishRequest(input: PublishRequest): ValidatedPublishRequest {
  const baseBranch = String(input.baseBranch ?? '').trim();
  const targetBranch = String(input.targetBranch ?? '').trim();
  const baseHeadSha = String(input.baseHeadSha ?? '').trim();
  const commitMessage = String(input.commitMessage ?? '').trim();

  validateBranchName(baseBranch);
  validateBranchName(targetBranch);

  if (!baseHeadSha) {
    throw new Error('baseHeadSha is required.');
  }

  if (!commitMessage) {
    throw new Error('commitMessage is required.');
  }

  if (!Array.isArray(input.changes) || input.changes.length === 0) {
    throw new Error('At least one publish change is required.');
  }

  const changes = input.changes.map((change) => {
    const path = normalizePath(String(change.path ?? '').trim());

    if (!path) {
      throw new Error('Each publish change must include a path.');
    }

    if (!isAllowedPublishPath(path)) {
      throw new Error(`Unsupported publish path: ${path}`);
    }

    if (path.includes('..')) {
      throw new Error(`Invalid publish path: ${path}`);
    }

    if (change.operation !== 'upsert' && change.operation !== 'delete') {
      throw new Error(`Unsupported publish operation: ${String(change.operation)}`);
    }

    if (change.encoding !== 'utf-8' && change.encoding !== 'base64') {
      throw new Error(`Unsupported publish encoding for ${path}: ${String(change.encoding)}`);
    }

    if (path.startsWith('content/card/') && change.encoding !== 'utf-8') {
      throw new Error(`Card files must use utf-8 encoding: ${path}`);
    }

    if (change.operation === 'upsert' && typeof change.content !== 'string') {
      throw new Error(`Upsert changes must include content: ${path}`);
    }

    if (change.operation === 'delete' && change.content !== undefined) {
      throw new Error(`Delete changes must not include content: ${path}`);
    }

    return {
      ...change,
      path,
    } satisfies ValidatedPublishChange;
  });

  return {
    repo: input.repo,
    baseBranch,
    targetBranch,
    baseHeadSha,
    commitMessage,
    changes,
  };
}
