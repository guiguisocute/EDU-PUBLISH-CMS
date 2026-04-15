import { useEffect, useMemo, useState } from 'react';
import { adaptPreviewModel } from '../../lib/content/preview-adapter';
import { buildDownloadFileName, isExternalUrl } from '../../lib/content/workspace-assets';
import type { Article, CmsPreviewModel, ValidationIssue } from '../../types/content';

export interface PreviewPaneProps {
  preview: CmsPreviewModel | null;
  issues: ValidationIssue[];
}

function AttachmentSection({ article }: { article: Article }) {
  if (!article.attachments || article.attachments.length === 0) {
    return null;
  }

  return (
    <section className="preview-pane__attachments">
      <h3>Attachments</h3>
      <ul>
        {article.attachments.map((attachment) => {
          const href = String(attachment.downloadUrl || attachment.url || '');
          const hasLink = Boolean(href && href !== '#');
          const forceDownloadName = href.startsWith('blob:') || href.startsWith('data:')
            ? buildDownloadFileName(attachment.name, href)
            : undefined;

          return (
            <li key={`${href}-${attachment.name}`}>
              {hasLink ? (
                <a
                  href={href}
                  target={isExternalUrl(href) ? '_blank' : undefined}
                  rel={isExternalUrl(href) ? 'noreferrer noopener' : undefined}
                  download={isExternalUrl(href) ? undefined : forceDownloadName}
                >
                  <span>{attachment.name}</span>
                  <span>{attachment.type || 'file'}</span>
                </a>
              ) : (
                <div>
                  <span>{attachment.name}</span>
                  <span>{attachment.type || 'file'}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DetailModal({
  article,
  articles,
  onClose,
  onOpenArticle,
}: {
  article: Article | null;
  articles: Article[];
  onClose: () => void;
  onOpenArticle: (article: Article) => void;
}) {
  useEffect(() => {
    if (!article) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      const currentIndex = articles.findIndex((candidate) => candidate.guid === article.guid);

      if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && currentIndex < articles.length - 1) {
        onOpenArticle(articles[currentIndex + 1]);
      }

      if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && currentIndex > 0) {
        onOpenArticle(articles[currentIndex - 1]);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [article, articles, onClose, onOpenArticle]);

  if (!article) {
    return null;
  }

  const currentIndex = articles.findIndex((candidate) => candidate.guid === article.guid);
  const previousArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;
  const nextArticle = currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;

  return (
    <div
      className="preview-pane__modal-overlay"
      data-preview-overlay
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="preview-pane__modal" role="dialog" aria-modal="true" aria-label={article.title}>
        <header className="preview-pane__modal-header">
          <div>
            <p>{article.feedTitle || 'Preview Feed'}</p>
            <h2>{article.title}</h2>
          </div>
          <button type="button" aria-label="Close detail" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="preview-pane__modal-body">
          {article.description ? <p>{article.description}</p> : null}
          <AttachmentSection article={article} />
          <article dangerouslySetInnerHTML={{ __html: article.content }} />
        </div>

        <footer className="preview-pane__modal-footer">
          <button
            type="button"
            aria-label="Previous notice"
            disabled={!previousArticle}
            onClick={() => previousArticle && onOpenArticle(previousArticle)}
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next notice"
            disabled={!nextArticle}
            onClick={() => nextArticle && onOpenArticle(nextArticle)}
          >
            Next
          </button>
        </footer>
      </section>
    </div>
  );
}

export function PreviewPane({ preview, issues }: PreviewPaneProps) {
  const adaptedPreview = useMemo(() => (preview ? adaptPreviewModel(preview) : null), [preview]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(adaptedPreview?.initialFeedId || null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  useEffect(() => {
    if (!adaptedPreview) {
      setSelectedFeedId(null);
      setActiveArticleId(null);
      return;
    }

    if (!selectedFeedId || !adaptedPreview.feedMap.has(selectedFeedId)) {
      setSelectedFeedId(adaptedPreview.initialFeedId);
    }
  }, [adaptedPreview, selectedFeedId]);

  const selectedFeed = adaptedPreview?.feedMap.get(selectedFeedId || '') || null;
  const activeArticle = selectedFeed?.articles.find((article) => article.guid === activeArticleId) || null;

  if (!preview) {
    return (
      <section className="preview-pane preview-pane--invalid">
        <h2>Preview unavailable</h2>
        <ul>
          {issues.map((issue) => (
            <li key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>
              <strong>{issue.filePath}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="preview-pane" aria-label="Preview pane">
      <header className="preview-pane__header">
        <p className="preview-pane__eyebrow">Reference-style Preview</p>
        <h2>Live Preview</h2>
        <p>List, detail modal, and attachment-first content all run from the shared compiler output.</p>
      </header>

      <div className="preview-pane__layout">
        <aside className="preview-pane__sidebar">
          {adaptedPreview?.groups.map((group) => (
            <section key={group.id} className="preview-pane__group">
              <h3>{group.title}</h3>
              <div className="preview-pane__feed-list">
                {group.feeds.map((feed) => (
                  <button
                    key={feed.id}
                    type="button"
                    className="preview-pane__feed-button"
                    aria-pressed={feed.id === selectedFeedId}
                    onClick={() => {
                      setSelectedFeedId(feed.id);
                      setActiveArticleId(null);
                    }}
                  >
                    {feed.title}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <section className="preview-pane__content">
          {selectedFeed ? (
            <>
              <header className="preview-pane__feed-header">
                <h3>{selectedFeed.title}</h3>
                <p>{selectedFeed.description}</p>
              </header>

              <div className="preview-pane__article-list">
                {selectedFeed.articles.map((article) => (
                  <button
                    key={article.guid}
                    type="button"
                    className="preview-pane__article-button"
                    aria-label={`Open notice: ${article.title}`}
                    onClick={() => setActiveArticleId(article.guid)}
                  >
                    <strong>{article.title}</strong>
                    <span>{article.description}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>No preview feed available.</p>
          )}
        </section>
      </div>

      {issues.length > 0 ? (
        <section className="preview-pane__issues">
          <h3>Compile Issues</h3>
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.filePath}:${issue.fieldPath || issue.message}`}>
                <strong>{issue.fieldPath || issue.filePath}</strong>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DetailModal
        article={activeArticle}
        articles={selectedFeed?.articles || []}
        onClose={() => setActiveArticleId(null)}
        onOpenArticle={(article) => setActiveArticleId(article.guid)}
      />
    </section>
  );
}
