import type { DraftWorkspaceDiagnostics } from '../../hooks/use-draft-workspace';

export interface DevDiagnosticsProps {
  diagnostics: DraftWorkspaceDiagnostics;
}

export function DevDiagnostics({ diagnostics }: DevDiagnosticsProps) {
  return (
    <aside className="cms-dev-diagnostics" aria-label="Developer diagnostics">
      <h3>Dev Diagnostics</h3>
      <dl>
        <div>
          <dt>Selected Card</dt>
          <dd>{diagnostics.selectedCardId || 'None'}</dd>
        </div>
        <div>
          <dt>Dirty Files</dt>
          <dd>{diagnostics.dirtyCount}</dd>
        </div>
        <div>
          <dt>Base Head SHA</dt>
          <dd>{diagnostics.baseHeadSha || 'Not loaded'}</dd>
        </div>
        <div>
          <dt>Compile Time</dt>
          <dd>{diagnostics.compileDurationMs.toFixed(2)} ms</dd>
        </div>
        <div>
          <dt>Validation Issues</dt>
          <dd>{diagnostics.validationIssueCount}</dd>
        </div>
      </dl>
    </aside>
  );
}
