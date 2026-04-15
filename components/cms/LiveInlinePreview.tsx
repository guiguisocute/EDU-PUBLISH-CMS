import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Download,
  Calendar,
  Share2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Article, CmsPreviewModel } from '../../types/content';
import { buildDownloadFileName, isExternalUrl } from '../../lib/content/workspace-assets';
import { LiveCountdownBar } from '../../publish-ui/components/CountdownBar';
import { useNow } from '../../publish-ui/hooks/use-now';
import { formatTimestamp, getTimeWindowState } from '../../publish-ui/lib/time-window';
import { renderSimpleMarkdown } from '../../publish-ui/lib/simple-markdown';

const SANITIZE_URI_OPTIONS = {
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export interface LiveInlinePreviewProps {
  article: Article | null;
  preview: CmsPreviewModel | null;
}

export function LiveInlinePreview({ article, preview }: LiveInlinePreviewProps) {
  const iconForAttachment = (type?: string, name?: string) => {
    const ext = (type || name?.split('.').pop() || 'file').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return FileVideo;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return FileAudio;
    return FileText;
  };

  const descriptionHtml = useMemo(
    () => DOMPurify.sanitize(renderSimpleMarkdown(article?.description || ''), SANITIZE_URI_OPTIONS),
    [article?.description]
  );

  const sanitizedContent = useMemo(
    () => (article?.content ? DOMPurify.sanitize(article.content, SANITIZE_URI_OPTIONS) : ''),
    [article?.content]
  );

  const sourceIcon = useMemo(() => {
    if (!article || !preview) return '/favicon.svg';
    if (article.subscriptionId) {
      const sub = preview.content.subscriptions.find(s => s.id === article.subscriptionId);
      if (sub?.icon) return sub.icon;
    }
    if (article.schoolSlug) {
      const sch = preview.content.schools.find(s => s.slug === article.schoolSlug);
      if (sch?.icon) return sch.icon;
    }
    return preview.siteConfig.favicon || '/favicon.svg';
  }, [article, preview]);
  const [sourceIconBroken, setSourceIconBroken] = React.useState(false);
  const hasTimeWindow = Boolean(article?.startAt || article?.endAt);
  const now = useNow(hasTimeWindow);
  const timing = useMemo(() => getTimeWindowState(article?.startAt, article?.endAt, now), [article?.startAt, article?.endAt, now]);

  React.useEffect(() => {
    setSourceIconBroken(false);
  }, [article?.guid, sourceIcon]);

  const formattedDate = useMemo(() => {
    if (!article?.pubDate) return '';
    try {
      const d = new Date(article.pubDate);
      if (Number.isNaN(d.valueOf())) return article.pubDate;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return article.pubDate;
    }
  }, [article?.pubDate]);

  const sourceChannelText = `[${article?.schoolShortName || '未知学院'}]${article?.source?.channel || article?.feedTitle || '未知来源'}`;
  const sourceSenderText = article?.source?.sender || '网络信息中心';

  if (!article) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-6 text-center bg-slate-50/50 dark:bg-slate-900/50">
        <p className="text-sm">在左侧选择一篇通知即可预览内容在详情页的效果。</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-slate-100/50 dark:bg-slate-900/50 p-4 sm:p-6 lg:p-8 relative md:text-sm text-xs">
      <div className="bg-background rounded-xl border shadow-lg max-w-3xl mx-auto flex flex-col min-h-full overflow-hidden">
        <div className="p-5 sm:p-8 lg:p-10 flex-1 flex flex-col">
          
          {/* Header - Sender Info */}
          <header className="flex items-center gap-3 mb-6 pb-5 border-b">
            <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
              {sourceIcon && !sourceIconBroken ? (
                <img
                  src={sourceIcon}
                  alt="Source Logo"
                  className="w-full h-full object-cover"
                  onError={() => setSourceIconBroken(true)}
                />
              ) : (
                <span className="text-primary font-black text-lg">
                  {sourceSenderText.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-extrabold text-[15px] leading-tight text-foreground">{sourceSenderText}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{sourceChannelText}</p>
            </div>
          </header>

        {/* Tags Row */}
        <div className="flex flex-wrap gap-2 items-center mb-5">
          <LiveCountdownBar startAt={article.startAt} endAt={article.endAt} size="md" />
          {timing.state === 'expired' && (
            <span className="text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-rose-300/80 bg-rose-50 text-rose-700 font-bold dark:border-rose-300/60 dark:bg-rose-500/20 dark:text-rose-100">
              已过期
            </span>
          )}
          {timing.state === 'upcoming' && (
            <span className="text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 md:py-1 rounded border border-primary/30 bg-primary/8 text-primary font-bold dark:border-primary/40 dark:bg-primary/15 dark:text-primary">
              将于 {formatTimestamp(article.startAt)} 开始
            </span>
          )}
          {article.aiCategory && (
            <span className="text-[12px] bg-[#1d4ed8] text-white px-2.5 py-0.5 rounded shadow-sm font-bold tracking-wide leading-relaxed">
              {article.aiCategory}
            </span>
          )}
          {article.pinned && (
            <span className="text-[12px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-800/50 shadow-sm font-semibold tracking-wide leading-relaxed">
              {(() => {
                let shortName = String(article.schoolShortName || article.feedTitle || '').trim();
                if (shortName.startsWith('/') || shortName.includes('.svg') || shortName.startsWith('http')) {
                  shortName = '';
                }
                return `${shortName || '该院'}置顶`;
              })()}
            </span>
          )}
          {article.badge && !article.badge.startsWith('/') && !article.badge.includes('.svg') && !article.badge.startsWith('http') && (
            <span className="text-[12px] bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/50 shadow-sm font-semibold tracking-wide leading-relaxed">
              {article.badge}
            </span>
          )}
          {(article.tags || []).filter((tag) => String(tag).trim() !== '学院通知').map((tag) => (
            <span key={tag} className="text-[12px] bg-muted/20 text-muted-foreground px-2.5 py-0.5 rounded border shadow-sm tracking-wide leading-relaxed font-medium">
              #{tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h2 className="text-[22px] md:text-[28px] lg:text-[34px] font-black leading-tight mb-8 break-words [overflow-wrap:anywhere] text-slate-800 dark:text-slate-100 tracking-tight">
          {article.title}
        </h2>

        {/* Summary Description */}
        {article.description && (
          <div
            className="text-[13px] md:text-[14px] lg:text-[15px] leading-relaxed text-muted-foreground mb-8 break-words [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold bg-muted/20 p-4 rounded-lg border border-muted/50"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {/* Attachments Section */}
        {article.attachments && article.attachments.length > 0 && (
          <section className="mb-6 rounded-lg border bg-muted/10 p-3 lg:p-4 overflow-x-auto">
            <h3 className="mb-2.5 text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground">附件下载</h3>
            <div className="space-y-2">
              {article.attachments.map((attachment) => {
                const Icon = iconForAttachment(attachment.type, attachment.name);
                const href = String(attachment.downloadUrl || attachment.url || '');
                const hasLink = Boolean(href && href !== '#');
                const forceDownloadName = href.startsWith('blob:') || href.startsWith('data:')
                  ? buildDownloadFileName(attachment.name, href)
                  : undefined;

                return (
                  hasLink ? (
                    <a
                      key={`${href}-${attachment.name}`}
                      href={href}
                      target={isExternalUrl(href) ? '_blank' : undefined}
                      rel={isExternalUrl(href) ? 'noreferrer noopener' : undefined}
                      download={isExternalUrl(href) ? undefined : forceDownloadName}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow-sm hover:border-primary/50"
                    >
                      <div className="min-w-0 flex flex-1 items-center gap-3">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium break-all leading-snug">{attachment.name}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">{attachment.type || 'file'}</p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">
                        下载 <Download className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  ) : (
                    <div
                      key={`${href}-${attachment.name}`}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="min-w-0 flex flex-1 items-center gap-3">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium break-all leading-snug">{attachment.name}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground">{attachment.type || 'file'}</p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs font-bold bg-muted px-2 py-1 rounded">
                        已记录 <Download className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )
                );
              })}
            </div>
          </section>
        )}

        {/* Original Content Separator */}
        <p className="mb-4 text-[11px] md:text-xs italic text-muted-foreground/80">以下为通知原文：</p>

        {/* Main Content */}
        <article className="flex-1 prose prose-slate max-w-none text-[13px] md:text-[15px] lg:text-base leading-loose dark:prose-invert overflow-x-hidden prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-code:break-all prose-p:break-words prose-p:[overflow-wrap:anywhere] prose-li:break-words prose-li:[overflow-wrap:anywhere] prose-headings:break-words prose-headings:[overflow-wrap:anywhere] prose-a:break-all prose-img:max-w-full prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
          <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
        </article>

        {/* Attribution at bottom */}
        <div className="mt-20 text-[12px] md:text-[13px] italic text-muted-foreground/70 w-full mb-10 flex justify-end items-center gap-6">
          <span className="text-right w-fit sm:min-w-[200px] opacity-70">
            —— 来源：{sourceChannelText}、 发送者：{sourceSenderText}
          </span>
        </div>
        </div>

        {/* Action Footer (Mock) */}
        <footer className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-t bg-background shrink-0 flex items-center justify-between z-10 w-full sticky bottom-0 text-muted-foreground">
          <div className="flex items-center gap-2 text-[13px] sm:text-[14px]">
            <Calendar className="w-4 h-4 opacity-70" />
            <span className="opacity-80">{formattedDate || '未设定'}</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <button type="button" className="h-9 w-9 rounded-md border hover:bg-muted bg-background flex items-center justify-center transition-colors shadow-sm disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" className="h-9 w-9 rounded-md border hover:bg-muted bg-background flex items-center justify-center transition-colors shadow-sm disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <button type="button" className="flex items-center justify-center gap-1.5 text-[13px] sm:text-[14px] hover:text-foreground font-medium transition-colors">
              <Share2 className="w-4 h-4" />
              分享
            </button>
            <button type="button" className="h-9 min-w-[72px] px-4 rounded-md bg-[#2563eb] text-white text-[13px] sm:text-[14px] font-bold shadow-sm hover:opacity-90 transition-opacity">
              关闭
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
