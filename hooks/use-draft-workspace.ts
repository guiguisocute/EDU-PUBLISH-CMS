import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { extractCardSections, parseCardDocument } from '../lib/content/card-document';
import { serializeCardDocument } from '../lib/content/card-serializer';
import { compileWorkspace } from '../lib/content/preview-compiler';
import type {
  CardDocument,
  CardFrontmatter,
  NoticeAttachmentInput,
  PreviewCompileResult,
  ValidationIssue,
} from '../types/content';
import type {
  DraftWorkspace,
  GitHubBranchSummary,
  PublishChange,
  PublishRequest,
  PublishResult,
  GitHubRepositorySummary,
  WorkspaceLoadRequest,
  WorkspaceAttachmentFile,
} from '../types/github';

interface ReposResponse {
  repos: GitHubRepositorySummary[];
}

interface BranchesResponse {
  branches: GitHubBranchSummary[];
}

interface DraftHistoryState {
  past: DraftWorkspace[];
  future: DraftWorkspace[];
}

const MAX_HISTORY_ENTRIES = 50;

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };

      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep the fallback status message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);

  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextValue = current[segment];

    if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

function buildUpdatedCard(
  card: CardDocument,
  nextData: CardFrontmatter,
  nextBodyMarkdown: string,
): CardDocument {
  const raw = serializeCardDocument({
    data: nextData,
    bodyMarkdown: nextBodyMarkdown,
    keyOrder: card.keyOrder,
  });
  const reparsed = parseCardDocument(raw, {
    path: card.path,
    sha: card.sha,
    dirty: true,
  });
  const { frontmatterText } = extractCardSections(raw);

  return {
    ...reparsed,
    raw,
    frontmatterText,
    dirty: true,
  };
}

function replaceCard(
  workspace: DraftWorkspace,
  targetCardId: string,
  updater: (card: CardDocument) => CardDocument,
): DraftWorkspace {
  const cards = workspace.cards.map((card) => {
    if (card.id !== targetCardId) {
      return card;
    }

    return updater(card);
  });

  return {
    ...workspace,
    cards,
  };
}

export interface DraftWorkspaceController {
  repos: GitHubRepositorySummary[];
  branches: GitHubBranchSummary[];
  selectedRepo: GitHubRepositorySummary | null;
  selectedBranch: string;
  workspace: DraftWorkspace | null;
  selectedCardId: string | null;
  selectedCard: CardDocument | null;
  dirtyCount: number;
  compileResult: PreviewCompileResult;
  validationIssues: ValidationIssue[];
  diagnostics: DraftWorkspaceDiagnostics;
  isLoadingRepos: boolean;
  isLoadingBranches: boolean;
  isLoadingWorkspace: boolean;
  error: string | null;
  changedFiles: string[];
  targetBranch: string;
  commitMessage: string;
  isPublishing: boolean;
  publishError: string | null;
  publishResult: PublishResult | null;
  canUndo: boolean;
  canRedo: boolean;
  loadRepos: () => Promise<void>;
  selectRepo: (fullName: string) => Promise<void>;
  selectBranch: (branchName: string) => void;
  loadWorkspace: () => Promise<void>;
  selectCard: (cardId: string) => void;
  updateField: (fieldPath: string, value: unknown) => void;
  updateBody: (markdown: string) => void;
  uploadAttachmentFiles: (files: FileList | File[]) => Promise<void>;
  discardDraft: (cardId?: string) => void;
  discardAllChanges: () => void;
  undo: () => void;
  redo: () => void;
  setTargetBranch: (branch: string) => void;
  setCommitMessage: (message: string) => void;
  publishChanges: () => Promise<void>;
}

function defaultCommitMessage(changedCount: number): string {
  if (changedCount <= 1) {
    return 'Publish updated notice';
  }

  return `Publish ${changedCount} updated notices`;
}

function inferAttachmentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (!extension) {
    return 'file';
  }

  if (['doc', 'docx'].includes(extension)) {
    return 'docx';
  }

  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return 'xlsx';
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }

  return extension;
}

function sanitizeAttachmentFileName(fileName: string): string {
  return fileName
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'attachment-file';
}

function toArray<T>(value: FileList | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.from(value as ArrayLike<T>);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const separatorIndex = result.indexOf(',');

      if (separatorIndex === -1) {
        reject(new Error(`Failed to encode attachment file: ${file.name}`));
        return;
      }

      resolve(result.slice(separatorIndex + 1));
    };
    reader.onerror = () => reject(new Error(`Failed to read attachment file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function pushHistoryEntry(history: DraftHistoryState, workspace: DraftWorkspace): DraftHistoryState {
  return {
    past: [...history.past, cloneValue(workspace)].slice(-MAX_HISTORY_ENTRIES),
    future: [],
  };
}

function isValidDate(value: string): boolean {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function validateAttachments(
  attachments: NoticeAttachmentInput[] | undefined,
  card: CardDocument,
): ValidationIssue[] {
  if (!attachments) {
    return [];
  }

  return attachments.flatMap((attachment, index) => {
    if (typeof attachment === 'string') {
      return attachment.trim()
        ? []
        : [{
          severity: 'error',
          filePath: card.path,
          fieldPath: `attachments.${index}`,
          message: `Attachment ${index + 1} must include both a name and a URL.`,
        } satisfies ValidationIssue];
    }

    return !String(attachment.name ?? '').trim() || !String(attachment.url ?? '').trim()
      ? [{
        severity: 'error',
        filePath: card.path,
        fieldPath: `attachments.${index}`,
        message: `Attachment ${index + 1} must include both a name and a URL.`,
      } satisfies ValidationIssue]
      : [];
  });
}

function validateDraftCards(cards: CardDocument[]): ValidationIssue[] {
  return cards.flatMap((card) => {
    const issues: ValidationIssue[] = [];

    if (!String(card.data.id ?? '').trim()) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'id', message: 'ID is required.' });
    }

    if (!String(card.data.school_slug ?? '').trim()) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'school_slug', message: 'School slug is required.' });
    }

    if (!String(card.data.title ?? '').trim()) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'title', message: 'Title is required.' });
    }

    const published = String(card.data.published ?? '').trim();

    if (!isValidDate(published)) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'published', message: 'Published must be a valid date.' });
    }

    const startAt = String(card.data.start_at ?? '').trim();
    const endAt = String(card.data.end_at ?? '').trim();

    if (startAt && !isValidDate(startAt)) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'start_at', message: 'Start time must be a valid date.' });
    }

    if (endAt && !isValidDate(endAt)) {
      issues.push({ severity: 'error', filePath: card.path, fieldPath: 'end_at', message: 'End time must be a valid date.' });
    }

    issues.push(...validateAttachments(card.data.attachments, card));

    return issues;
  });
}

export interface DraftWorkspaceDiagnostics {
  selectedCardId: string | null;
  dirtyCount: number;
  baseHeadSha: string | null;
  compileDurationMs: number;
  validationIssueCount: number;
}

export function useDraftWorkspace(): DraftWorkspaceController {
  const [repos, setRepos] = useState<GitHubRepositorySummary[]>([]);
  const [branches, setBranches] = useState<GitHubBranchSummary[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [workspace, setWorkspace] = useState<DraftWorkspace | null>(null);
  const [originalWorkspace, setOriginalWorkspace] = useState<DraftWorkspace | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetBranch, setTargetBranch] = useState('');
  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage(0));
  const [hasCustomCommitMessage, setHasCustomCommitMessage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [history, setHistory] = useState<DraftHistoryState>({ past: [], future: [] });
  const reposRef = useRef(repos);
  const selectedRepoFullNameRef = useRef(selectedRepoFullName);
  const selectedBranchRef = useRef(selectedBranch);
  const historyRef = useRef(history);

  reposRef.current = repos;
  selectedRepoFullNameRef.current = selectedRepoFullName;
  selectedBranchRef.current = selectedBranch;
  historyRef.current = history;

  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.fullName === selectedRepoFullName) || null,
    [repos, selectedRepoFullName],
  );
  const deferredWorkspace = useDeferredValue(workspace);
  const compileSnapshot = useMemo(() => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (!deferredWorkspace) {
      return {
        result: {
          preview: null,
          issues: [],
        } satisfies PreviewCompileResult,
        durationMs: 0,
      };
    }

    const result = compileWorkspace(deferredWorkspace, {
      generatedAt: deferredWorkspace.baseHeadSha || new Date().toISOString(),
    });
    const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      result,
      durationMs: Math.round((endedAt - startedAt) * 100) / 100,
    };
  }, [deferredWorkspace]);
  const compileResult = compileSnapshot.result;
  const validationIssues = useMemo(
    () => [
      ...validateDraftCards(workspace?.cards || []),
      ...compileResult.issues,
    ],
    [compileResult.issues, workspace?.cards],
  );
  const selectedCard = useMemo(
    () => workspace?.cards.find((card) => card.id === selectedCardId) || null,
    [workspace, selectedCardId],
  );
  const dirtyCount = useMemo(
    () => workspace?.cards.filter((card) => card.dirty).length || 0,
    [workspace],
  );
  const changedFiles = useMemo(() => {
    if (!workspace || !originalWorkspace) {
      return [];
    }

    const originalByPath = new Map(originalWorkspace.cards.map((card) => [card.path, card.raw]));
    const cardFiles = workspace.cards
      .filter((card) => originalByPath.get(card.path) !== card.raw)
      .map((card) => card.path)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    const originalAttachments = new Map(
      originalWorkspace.attachments.map((attachment) => [
        attachment.path,
        `${attachment.sha}:${attachment.size}:${attachment.deleted ? 'deleted' : 'present'}`,
      ]),
    );
    const attachmentFiles = workspace.attachments
      .filter((attachment) => {
        const currentKey = `${attachment.sha}:${attachment.size}:${attachment.deleted ? 'deleted' : 'present'}:${attachment.content || ''}`;
        const originalKey = originalAttachments.get(attachment.path);

        return attachment.dirty || originalKey !== `${attachment.sha}:${attachment.size}:${attachment.deleted ? 'deleted' : 'present'}` || Boolean(attachment.content && !originalKey) || currentKey !== `${attachment.sha}:${attachment.size}:${attachment.deleted ? 'deleted' : 'present'}`;
      })
      .map((attachment) => attachment.path)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    return Array.from(new Set([...cardFiles, ...attachmentFiles]));
  }, [originalWorkspace, workspace]);
  const diagnostics = useMemo<DraftWorkspaceDiagnostics>(() => ({
    selectedCardId,
    dirtyCount,
    baseHeadSha: workspace?.baseHeadSha || null,
    compileDurationMs: compileSnapshot.durationMs,
    validationIssueCount: validationIssues.length,
  }), [compileSnapshot.durationMs, dirtyCount, selectedCardId, validationIssues.length, workspace?.baseHeadSha]);

  useEffect(() => {
    if (!hasCustomCommitMessage) {
      setCommitMessage(defaultCommitMessage(changedFiles.length));
    }
  }, [changedFiles.length, hasCustomCommitMessage]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (!selectedCardId || !workspace.cards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(workspace.cards[0]?.id || null);
    }
  }, [selectedCardId, workspace]);

  function resetHistory(): void {
    const nextHistory = { past: [], future: [] };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }

  function commitWorkspaceUpdate(
    updater: (currentWorkspace: DraftWorkspace) => DraftWorkspace,
  ): void {
    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) {
        return currentWorkspace;
      }

      const nextWorkspace = updater(currentWorkspace);

      if (nextWorkspace === currentWorkspace) {
        return currentWorkspace;
      }

      setHistory((currentHistory) => {
        const nextHistory = pushHistoryEntry(currentHistory, currentWorkspace);

        historyRef.current = nextHistory;
        return nextHistory;
      });
      return nextWorkspace;
    });
  }

  async function loadRepos(): Promise<void> {
    setIsLoadingRepos(true);
    setError(null);

    try {
      const response = await requestJson<ReposResponse>('/api/repos');
      reposRef.current = response.repos;
      setRepos(response.repos);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load repositories.');
    } finally {
      setIsLoadingRepos(false);
    }
  }

  async function selectRepo(fullName: string): Promise<void> {
    selectedRepoFullNameRef.current = fullName;
    setSelectedRepoFullName(fullName);
    setWorkspace(null);
    setOriginalWorkspace(null);
    setSelectedCardId(null);
    setBranches([]);
    setSelectedBranch('');
    setError(null);
    resetHistory();

    const repo = reposRef.current.find((item) => item.fullName === fullName);

    if (!repo) {
      return;
    }

    setIsLoadingBranches(true);

    try {
      const response = await requestJson<BranchesResponse>(
        `/api/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/branches`,
      );
      const nextSelectedBranch = response.branches.find(
        (branch) => branch.name === repo.defaultBranch,
      )?.name || response.branches[0]?.name || '';

      setBranches(response.branches);
      selectedBranchRef.current = nextSelectedBranch;
      setSelectedBranch(nextSelectedBranch);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load branches.');
    } finally {
      setIsLoadingBranches(false);
    }
  }

  function selectBranch(branchName: string): void {
    selectedBranchRef.current = branchName;
    setSelectedBranch(branchName);
    setWorkspace(null);
    setOriginalWorkspace(null);
    setSelectedCardId(null);
    setError(null);
    resetHistory();
  }

  async function loadWorkspace(): Promise<void> {
    const currentSelectedRepo = reposRef.current.find(
      (repo) => repo.fullName === selectedRepoFullNameRef.current,
    ) || null;
    const currentSelectedBranch = selectedBranchRef.current;

    if (!currentSelectedRepo || !currentSelectedBranch) {
      return;
    }

    setIsLoadingWorkspace(true);
    setError(null);

    try {
      const requestBody: WorkspaceLoadRequest = {
        repo: {
          owner: currentSelectedRepo.owner,
          name: currentSelectedRepo.name,
        },
        branch: currentSelectedBranch,
      };
      const response = await requestJson<DraftWorkspace>('/api/workspace/load', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const original = cloneValue(response);
      const draft = cloneValue(response);

      setOriginalWorkspace(original);
      setWorkspace(draft);
      resetHistory();
      setSelectedCardId(draft.cards[0]?.id || null);
      setTargetBranch(draft.branch);
      setCommitMessage(defaultCommitMessage(0));
      setHasCustomCommitMessage(false);
      setPublishError(null);
      setPublishResult(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to load workspace.');
    } finally {
      setIsLoadingWorkspace(false);
    }
  }

  function selectCard(cardId: string): void {
    setSelectedCardId(cardId);
  }

  function updateField(fieldPath: string, value: unknown): void {
    if (!workspace || !selectedCardId) {
      return;
    }

    commitWorkspaceUpdate((currentWorkspace) => {
      let nextCardId = selectedCardId;
      const nextWorkspace = replaceCard(currentWorkspace, selectedCardId, (card) => {
        const nextData = cloneValue(card.data);

        setNestedValue(nextData as Record<string, unknown>, fieldPath, value);

        const updatedCard = buildUpdatedCard(card, nextData, card.bodyMarkdown);
        nextCardId = updatedCard.id;
        return updatedCard;
      });

      if (nextCardId !== selectedCardId) {
        setSelectedCardId(nextCardId);
      }

      return nextWorkspace;
    });
  }

  function updateBody(markdown: string): void {
    if (!workspace || !selectedCardId) {
      return;
    }

    commitWorkspaceUpdate((currentWorkspace) => {
      return replaceCard(currentWorkspace, selectedCardId, (card) =>
        buildUpdatedCard(card, cloneValue(card.data), markdown),
      );
    });
  }

  async function uploadAttachmentFiles(files: FileList | File[]): Promise<void> {
    const nextFiles = toArray<File>(files).filter((file) => file instanceof File);

    if (!workspace || !selectedCardId || nextFiles.length === 0) {
      return;
    }

    const encodedFiles = await Promise.all(
      nextFiles.map(async (file) => {
        const fileName = sanitizeAttachmentFileName(file.name);

        return {
          fileName,
          content: await fileToBase64(file),
          size: file.size,
          type: inferAttachmentType(fileName),
        };
      }),
    );

    commitWorkspaceUpdate((currentWorkspace) => {
      const nextAttachmentsByPath = new Map<string, WorkspaceAttachmentFile>(
        currentWorkspace.attachments.map((attachment) => [attachment.path, attachment]),
      );
      const targetCard = currentWorkspace.cards.find((card) => card.id === selectedCardId);

      if (!targetCard) {
        return currentWorkspace;
      }

      const existingAttachments = Array.isArray(targetCard.data.attachments)
        ? cloneValue(targetCard.data.attachments)
        : [];

      for (const file of encodedFiles) {
        const relativeUrl = `./attachments/${file.fileName}`;
        const filePath = `content/attachments/${file.fileName}`;

        nextAttachmentsByPath.set(filePath, {
          path: filePath,
          sha: '',
          size: file.size,
          encoding: 'base64',
          content: file.content,
          dirty: true,
          deleted: false,
        });

        existingAttachments.push({
          name: file.fileName,
          url: relativeUrl,
          type: file.type,
        });
      }

      const nextWorkspace = replaceCard(currentWorkspace, selectedCardId, (card) => {
        const nextData = cloneValue(card.data);
        nextData.attachments = existingAttachments;

        return buildUpdatedCard(card, nextData, card.bodyMarkdown);
      });

      return {
        ...nextWorkspace,
        attachments: Array.from(nextAttachmentsByPath.values()).sort((left, right) =>
          left.path.localeCompare(right.path, 'zh-CN'),
        ),
      };
    });
  }

  function discardDraft(cardId?: string): void {
    if (!workspace || !originalWorkspace) {
      return;
    }

    const targetCardId = cardId || selectedCardId;

    if (!targetCardId) {
      const nextWorkspace = cloneValue(originalWorkspace);
      setWorkspace(nextWorkspace);
      resetHistory();
      setSelectedCardId(nextWorkspace.cards[0]?.id || null);
      return;
    }

    const originalCard = originalWorkspace.cards.find((card) => card.id === targetCardId);

    if (!originalCard) {
      return;
    }

    commitWorkspaceUpdate((currentWorkspace) => {
      return {
        ...currentWorkspace,
        cards: currentWorkspace.cards.map((card) =>
          card.id === targetCardId ? cloneValue(originalCard) : card,
        ),
      };
    });
  }

  function discardAllChanges(): void {
    if (!originalWorkspace) {
      return;
    }

    const nextWorkspace = cloneValue(originalWorkspace);
    setWorkspace(nextWorkspace);
    resetHistory();
    setSelectedCardId((currentSelectedCardId) =>
      nextWorkspace.cards.some((card) => card.id === currentSelectedCardId)
        ? currentSelectedCardId
        : nextWorkspace.cards[0]?.id || null,
    );
  }

  function undo(): void {
    const previousWorkspace = historyRef.current.past.at(-1);

    if (!previousWorkspace) {
      return;
    }

    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) {
        return currentWorkspace;
      }

      const nextHistory: DraftHistoryState = {
        past: historyRef.current.past.slice(0, -1),
        future: [cloneValue(currentWorkspace), ...historyRef.current.future].slice(0, MAX_HISTORY_ENTRIES),
      };

      historyRef.current = nextHistory;
      setHistory(nextHistory);

      return cloneValue(previousWorkspace);
    });
  }

  function redo(): void {
    const futureWorkspace = historyRef.current.future[0];

    if (!futureWorkspace) {
      return;
    }

    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) {
        return currentWorkspace;
      }

      const nextHistory: DraftHistoryState = {
        past: [...historyRef.current.past, cloneValue(currentWorkspace)].slice(-MAX_HISTORY_ENTRIES),
        future: historyRef.current.future.slice(1),
      };

      historyRef.current = nextHistory;
      setHistory(nextHistory);

      return cloneValue(futureWorkspace);
    });
  }

  async function publishChanges(): Promise<void> {
    if (!workspace || !originalWorkspace || !selectedRepo || changedFiles.length === 0) {
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const originalByPath = new Map(originalWorkspace.cards.map((card) => [card.path, card.raw]));
      const changes: PublishChange[] = workspace.cards.flatMap((card) => {
        if (originalByPath.get(card.path) === card.raw) {
          return [];
        }

        return [{
          path: card.path,
          operation: 'upsert',
          encoding: 'utf-8',
          content: card.raw,
        } satisfies PublishChange];
      });
      const attachmentChanges: PublishChange[] = workspace.attachments.flatMap<PublishChange>((attachment) => {
        if (attachment.deleted) {
          return [{
            path: attachment.path,
            operation: 'delete',
            encoding: 'base64',
          } satisfies PublishChange];
        }

        if (!attachment.dirty || !attachment.content) {
          return [];
        }

        return [{
          path: attachment.path,
          operation: 'upsert',
          encoding: 'base64',
          content: attachment.content,
        } satisfies PublishChange];
      });
      const requestBody: PublishRequest = {
        repo: {
          owner: selectedRepo.owner,
          name: selectedRepo.name,
        },
        baseBranch: workspace.branch,
        targetBranch,
        baseHeadSha: workspace.baseHeadSha,
        commitMessage: commitMessage.trim() || defaultCommitMessage(changes.length + attachmentChanges.length),
        changes: [...changes, ...attachmentChanges],
      };
      const result = await requestJson<PublishResult>('/api/publish', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const nextWorkspace = cloneValue(workspace);

      nextWorkspace.branch = result.targetBranch;
      nextWorkspace.baseHeadSha = result.commitSha;
      nextWorkspace.cards = nextWorkspace.cards.map((card) => ({
        ...card,
        dirty: false,
      }));
      nextWorkspace.attachments = nextWorkspace.attachments.map((attachment) => ({
        ...attachment,
        dirty: false,
        deleted: false,
        content: undefined,
        encoding: undefined,
      }));

      setWorkspace(nextWorkspace);
      setOriginalWorkspace(cloneValue(nextWorkspace));
      resetHistory();
      setSelectedBranch(result.targetBranch);
      selectedBranchRef.current = result.targetBranch;
      setTargetBranch(result.targetBranch);
      setCommitMessage(defaultCommitMessage(0));
      setHasCustomCommitMessage(false);
      setPublishResult(result);
    } catch (requestError) {
      setPublishError(requestError instanceof Error ? requestError.message : 'Publish failed.');
    } finally {
      setIsPublishing(false);
    }
  }

  return {
    repos,
    branches,
    selectedRepo,
    selectedBranch,
    workspace,
    selectedCardId,
    selectedCard,
    dirtyCount,
    compileResult,
    validationIssues,
    diagnostics,
    isLoadingRepos,
    isLoadingBranches,
    isLoadingWorkspace,
    error,
    changedFiles,
    targetBranch,
    commitMessage,
    isPublishing,
    publishError,
    publishResult,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    loadRepos,
    selectRepo,
    selectBranch,
    loadWorkspace,
    selectCard,
    updateField,
    updateBody,
    uploadAttachmentFiles,
    discardDraft,
    discardAllChanges,
    undo,
    redo,
    setTargetBranch,
    setCommitMessage: (message: string) => {
      setHasCustomCommitMessage(true);
      setCommitMessage(message);
    },
    publishChanges,
  };
}
