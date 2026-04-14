import { useEffect, useState } from 'react';
import type { SessionResponse } from '../../types/github';
import { CardEditorPanel } from './CardEditorPanel';
import { DevDiagnostics } from './DevDiagnostics';
import { PublishDialog } from './PublishDialog';
import { RepoSelector } from './RepoSelector';
import { useDraftWorkspace } from '../../hooks/use-draft-workspace';
import { PreviewAppShell } from '../preview/PreviewAppShell';

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
      // Ignore non-JSON error responses.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function CmsWorkspaceShell() {
  const workspace = useDraftWorkspace();
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  async function refreshSession(): Promise<void> {
    setIsLoadingSession(true);
    setSessionError(null);

    try {
      const nextSession = await requestJson<SessionResponse>('/api/session');
      setSession(nextSession);
    } catch (requestError) {
      setSessionError(requestError instanceof Error ? requestError.message : 'Failed to load session.');
    } finally {
      setIsLoadingSession(false);
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setSession({ authenticated: false, viewer: null });
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    if (!session?.authenticated || workspace.repos.length > 0 || workspace.isLoadingRepos) {
      return;
    }

    void workspace.loadRepos();
  }, [session?.authenticated, workspace]);

  if (isLoadingSession) {
    return (
      <main className="cms-shell">
        <h1>EDU-PUBLISH-CMS</h1>
        <p>Checking session…</p>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="cms-shell">
        <h1>EDU-PUBLISH-CMS</h1>
        <p>{sessionError}</p>
        <button type="button" onClick={() => void refreshSession()}>
          Retry Session Check
        </button>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main className="cms-shell cms-shell--auth">
        <header className="cms-shell__header">
          <p className="cms-shell__eyebrow">Maintainer Console</p>
          <h1>EDU-PUBLISH-CMS</h1>
          <p>Sign in with GitHub to start editing.</p>
        </header>

        <section className="cms-shell__auth-card">
          <p>
            The Worker keeps your GitHub token server-side and only exposes reduced repo and workspace
            data to the browser.
          </p>
          <a href="/api/auth/github/start">Sign in with GitHub</a>
        </section>
      </main>
    );
  }

  return (
    <main className="cms-shell cms-shell--workspace">
      <header className="cms-shell__header">
        <div>
          <p className="cms-shell__eyebrow">Maintainer Console</p>
          <h1>EDU-PUBLISH-CMS</h1>
          <p>
            {session.viewer?.name || session.viewer?.login || 'Authenticated maintainer'} is editing
            through the Worker-managed GitHub session.
          </p>
        </div>

        <button type="button" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </header>

      <div className="cms-shell__toolbar">
        <button type="button" disabled={!workspace.canUndo} onClick={workspace.undo}>
          Undo
        </button>
        <button type="button" disabled={!workspace.canRedo} onClick={workspace.redo}>
          Redo
        </button>
        <button type="button" disabled={workspace.changedFiles.length === 0} onClick={workspace.discardAllChanges}>
          Discard All Changes
        </button>
        <button
          type="button"
          disabled={workspace.changedFiles.length === 0}
          onClick={() => setIsPublishDialogOpen(true)}
        >
          Review Publish
        </button>
      </div>

      <RepoSelector
        repos={workspace.repos}
        branches={workspace.branches}
        selectedRepoFullName={workspace.selectedRepo?.fullName || ''}
        selectedBranch={workspace.selectedBranch}
        isLoadingRepos={workspace.isLoadingRepos}
        isLoadingBranches={workspace.isLoadingBranches}
        isLoadingWorkspace={workspace.isLoadingWorkspace}
        onRepoChange={(value) => void workspace.selectRepo(value)}
        onBranchChange={workspace.selectBranch}
        onLoadWorkspace={() => void workspace.loadWorkspace()}
      />

      {workspace.error ? <p className="cms-shell__error">{workspace.error}</p> : null}

      <section className="cms-shell__workspace-grid">
        <aside className="cms-shell__sidebar">
          <div className="cms-shell__sidebar-header">
            <h2>Cards</h2>
            <p>{workspace.workspace?.cards.length || 0} loaded</p>
          </div>

          {workspace.workspace ? (
            <div className="cms-shell__card-list" role="list" aria-label="Workspace cards">
              {workspace.workspace.cards.map((card) => (
                <button
                  key={card.path}
                  type="button"
                  className="cms-shell__card-item"
                  aria-pressed={workspace.selectedCardId === card.id}
                  onClick={() => workspace.selectCard(card.id)}
                >
                  <strong>{String(card.data.title ?? card.id ?? 'Untitled')}</strong>
                  <span>{card.path}</span>
                  <span>{card.dirty ? 'Dirty' : 'Clean'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="cms-shell__empty-copy">Load a workspace to see editable cards.</p>
          )}
        </aside>

        <section className="cms-shell__editor-column">
          <CardEditorPanel
            card={workspace.selectedCard}
            issues={workspace.validationIssues}
            onFieldChange={workspace.updateField}
            onBodyChange={workspace.updateBody}
            onUploadAttachmentFiles={workspace.uploadAttachmentFiles}
          />

          <PreviewAppShell
            preview={workspace.compileResult.preview}
            issues={workspace.validationIssues}
          />
        </section>
      </section>

      {import.meta.env.DEV ? <DevDiagnostics diagnostics={workspace.diagnostics} /> : null}

      <PublishDialog
        isOpen={isPublishDialogOpen}
        changedFiles={workspace.changedFiles}
        baseBranch={workspace.workspace?.branch || workspace.selectedBranch || ''}
        targetBranch={workspace.targetBranch}
        baseHeadSha={workspace.workspace?.baseHeadSha || ''}
        commitMessage={workspace.commitMessage}
        issues={workspace.validationIssues}
        isPublishing={workspace.isPublishing}
        publishResult={workspace.publishResult}
        publishError={workspace.publishError}
        onTargetBranchChange={workspace.setTargetBranch}
        onCommitMessageChange={workspace.setCommitMessage}
        onPublish={() => void workspace.publishChanges()}
        onClose={() => setIsPublishDialogOpen(false)}
      />
    </main>
  );
}
