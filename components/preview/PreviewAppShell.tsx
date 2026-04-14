import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { CmsPreviewModel, ValidationIssue } from '../../types/content';
import { __setSiteConfig } from '../../publish-ui/lib/site-config';
import { __setWidgetsConfig } from '../../publish-ui/lib/widgets-config';
import { AppShell } from '../../publish-ui/App';

export interface PreviewAppShellProps {
  preview: CmsPreviewModel | null;
  issues: ValidationIssue[];
}

export function PreviewAppShell({ preview, issues }: PreviewAppShellProps) {
  if (!preview) {
    return (
      <section className="preview-app-shell items-center justify-center flex h-full border rounded-lg bg-muted/20">
        <div className="text-center p-8">
          <h2 className="text-lg font-semibold">暂无预览可用</h2>
          {issues.length > 0 && (
            <ul className="text-left mt-4 text-sm text-destructive list-disc pl-4">
              {issues.map((issue) => (
                <li key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>
                  <strong>{issue.filePath}</strong>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  // Use the compiled content correctly
  const contentData = preview.content as any;
  const searchData = preview.searchIndex as any;

  __setSiteConfig(preview.siteConfig as any);
  __setWidgetsConfig(preview.widgetsConfig as any);

  return (
    <section className="preview-app-shell h-full relative border rounded-lg overflow-hidden shadow-sm" aria-label="Preview app shell">
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AppShell mode="list" contentData={contentData} searchData={searchData} />} />
          <Route path="/school/:slug" element={<AppShell mode="list" contentData={contentData} searchData={searchData} />} />
          <Route path="/dashboard" element={<AppShell mode="dashboard" contentData={contentData} searchData={searchData} />} />
        </Routes>
      </MemoryRouter>
      
      {issues.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-md shadow-lg max-w-sm max-h-64 overflow-auto z-50">
          <h3 className="font-bold mb-2">编译问题 ({issues.length})</h3>
          <ul className="text-xs space-y-1 list-disc pl-4">
            {issues.map(issue => (
              <li key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>
                <strong>{issue.fieldPath || issue.filePath}</strong>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
