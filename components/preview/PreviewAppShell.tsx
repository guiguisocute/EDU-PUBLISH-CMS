import type { CmsPreviewModel, ValidationIssue } from '../../types/content';
import { PreviewPane } from './PreviewPane';

export interface PreviewAppShellProps {
  preview: CmsPreviewModel | null;
  issues: ValidationIssue[];
}

export function PreviewAppShell({ preview, issues }: PreviewAppShellProps) {
  return (
    <section className="preview-app-shell" aria-label="Preview app shell">
      <PreviewPane preview={preview} issues={issues} />
    </section>
  );
}
