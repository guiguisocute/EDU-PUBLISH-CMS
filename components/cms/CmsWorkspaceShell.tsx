import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { SessionResponse } from '../../types/github';
import type { CardDocument } from '../../types/content';
import { CardEditorPanel } from './CardEditorPanel';
import { DevDiagnostics } from './DevDiagnostics';
import { PublishDialog } from './PublishDialog';
import { RepoSelector } from './RepoSelector';
import { useDraftWorkspace } from '../../hooks/use-draft-workspace';
import { LiveInlinePreview } from './LiveInlinePreview';

/*!
 * Helper component for resizer handles (Removed per user request)
 */

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
  
  // Sidebar state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortParam, setSortParam] = useState<'date_desc' | 'date_asc' | 'dirty_first'>('date_desc');
  
  // Collapsible state
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  
  // Mobile sidebar toggle state
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  
  // PC sidebar toggle state
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('cms-dark-mode');
    if (savedMode) {
      setIsDarkMode(savedMode === 'true');
      if (savedMode === 'true') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('cms-dark-mode', String(next));
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const toggleSchool = (school: string) => {
    setExpandedSchools(prev => {
      const next = new Set(prev);
      if (next.has(school)) next.delete(school);
      else next.add(school);
      return next;
    });
  };

  const toggleChannel = (channelPath: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelPath)) next.delete(channelPath);
      else next.add(channelPath);
      return next;
    });
  };

  const groupedCards = useMemo(() => {
    if (!workspace.workspace) return new Map<string, Map<string, CardDocument[]>>();
    
    let filteredCards = workspace.workspace.cards;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filteredCards = filteredCards.filter(card => {
        const title = String(card.data.title || '').toLowerCase();
        const content = String(card.bodyMarkdown || '').toLowerCase();
        const id = String(card.id || '').toLowerCase();
        return title.includes(q) || id.includes(q) || content.includes(q);
      });
    }

    filteredCards = [...filteredCards].sort((a, b) => {
      if (sortParam === 'dirty_first') {
        if (a.dirty && !b.dirty) return -1;
        if (!a.dirty && b.dirty) return 1;
      }
      
      const dateA = new Date(String(a.data.published || '1970-01-01')).getTime();
      const dateB = new Date(String(b.data.published || '1970-01-01')).getTime();
      
      if (sortParam === 'date_asc') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    const schools = new Map<string, Map<string, CardDocument[]>>();
    for (const card of filteredCards) {
      const rawSlug = String(card.data.school_slug || '未分类');
      const schoolName = workspace.compileResult.preview?.schoolNameBySlug?.[rawSlug] || rawSlug;
      
      const channel = String(card.data.source?.channel || '默认源');
      if (!schools.has(schoolName)) {
        schools.set(schoolName, new Map());
      }
      const channels = schools.get(schoolName)!;
      if (!channels.has(channel)) {
        channels.set(channel, []);
      }
      channels.get(channel)!.push(card);
    }
    return schools;
  }, [workspace.workspace?.cards, searchQuery, sortParam, workspace.compileResult.preview?.schoolNameBySlug]);

  const previewBlockMessage = workspace.workspaceLoadProgress?.phase === 'confirm'
    ? '等待后续决定中……'
    : workspace.workspaceLoadProgress?.phase === 'assets'
      ? '正在同步图片与附件资源，完成后会重新渲染即时预览。'
      : '';
  const workspaceBlockMessage = workspace.workspaceLoadProgress?.phase === 'confirm'
    ? '卡片元数据已读取，请先选择是否继续同步图片与附件。'
    : workspace.workspaceLoadProgress?.phase === 'assets'
      ? '正在同步图片与附件资源，完成后再渲染工作区。'
      : '';
  const canRenderInlinePreview = !workspace.workspaceLoadProgress;

  const activePreviewArticle = useMemo(() => {
    if (!canRenderInlinePreview || !workspace.compileResult.preview || !workspace.selectedCardId) return null;
    return workspace.compileResult.preview.content.notices.find(a => a.guid === workspace.selectedCardId) || null;
  }, [canRenderInlinePreview, workspace.compileResult.preview, workspace.selectedCardId]);

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

  // Expand all schools initially if there are data, but only run once
  useEffect(() => {
    if (groupedCards.size > 0 && expandedSchools.size === 0) {
      setExpandedSchools(new Set(groupedCards.keys()));
    }
  }, [groupedCards.size]);

  if (isLoadingSession) {
    return (
      <main className="flex flex-col items-center justify-center h-screen bg-background text-foreground text-center">
        <h1 className="text-3xl font-black mb-2 text-primary">EDU-PUBLISH-CMS</h1>
        <p className="text-muted-foreground animate-pulse">正在检查会话…</p>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex flex-col items-center justify-center h-screen bg-background text-foreground text-center px-4">
        <h1 className="text-3xl font-black mb-4 text-primary">EDU-PUBLISH-CMS</h1>
        <p className="text-destructive mb-6 font-medium bg-destructive/10 p-3 rounded-lg max-w-lg">{sessionError}</p>
        <button className="h-10 px-6 rounded-md bg-primary text-primary-foreground font-bold shadow hover:opacity-90 transition-opacity" type="button" onClick={() => void refreshSession()}>
          重试会话检查
        </button>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main className="flex flex-col items-center justify-center h-screen bg-background text-foreground text-center">
        <header className="mb-8">
          <p className="text-sm font-bold text-primary tracking-widest uppercase mb-1">维护者控制台</p>
          <h1 className="text-4xl font-black mb-2">EDU-PUBLISH-CMS</h1>
          <p className="text-muted-foreground text-lg">使用 GitHub 登录以开始编辑。</p>
        </header>

        <section className="bg-card border shadow-xl rounded-xl p-8 max-w-md w-full flex flex-col items-center gap-6">
          <p className="text-sm text-card-foreground leading-relaxed">
            Worker 会在服务器端妥善保存您的 GitHub 令牌，并仅向浏览器暴露精简的 仓库与工作区数据。
          </p>
          <a className="flex items-center justify-center h-12 w-full rounded-md bg-primary text-primary-foreground font-bold text-base shadow hover:opacity-90 transition-opacity" href="/api/auth/github/start">使用 GitHub 登录</a>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden bg-background text-foreground font-sans relative">
      <header className="flex h-14 md:h-16 shrink-0 items-center justify-between border-b px-3 md:px-6 bg-card text-card-foreground shadow-sm relative z-30">
        <div className="flex items-center min-w-0">
          <button 
            type="button" 
            className="mr-3 p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground flex shrink-0" 
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsLeftOpen(true);
              } else {
                setShowLeftSidebar(prev => !prev);
              }
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="truncate flex items-center gap-2">
            <div>
              <h1 className="text-sm md:text-xl font-black truncate leading-tight tracking-tight">EDU-PUBLISH-CMS</h1>
              <p className="hidden sm:block text-xs text-muted-foreground truncate">
                {session.viewer?.name || session.viewer?.login || '认证维护者'} 正在编辑
              </p>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-1 rounded-full text-foreground hover:bg-muted/80 ml-1 transition-colors flex-shrink-0"
              aria-label="Toggle dark mode"
              title="切换深色模式"
            >
              {isDarkMode ? (
                // Moon icon
                <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                // Sun icon
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.22a1 1 0 011.415 0l.884.884a1 1 0 01-1.414 1.415l-.884-.884a1 1 0 010-1.415zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-3.78 4.22a1 1 0 010 1.415l-.884.884a1 1 0 11-1.414-1.415l.884-.884a1 1 0 011.415 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-2.22a1 1 0 01-1.415 0l-.884-.884a1 1 0 011.414-1.415l.884.884a1 1 0 010 1.415zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm3.78-4.22a1 1 0 010-1.415l.884-.884a1 1 0 011.414 1.415l-.884.884a1 1 0 01-1.415 0zM10 5a5 5 0 100 10 5 5 0 000-10z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            className="h-8 md:h-9 px-3 md:px-4 rounded-md border text-xs md:text-sm font-semibold hover:bg-muted"
            type="button" 
            onClick={() => void handleLogout()}
          >
            退出登录
          </button>
          <button 
            type="button" 
            className="ml-1 p-2 -mr-2 rounded-md hover:bg-muted text-muted-foreground flex shrink-0" 
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsRightOpen(true);
              } else {
                setShowRightSidebar(prev => !prev);
              }
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row shrink-0 items-stretch md:items-center justify-between border-b bg-muted/20 p-2 md:p-3 px-3 md:px-6 shadow-sm gap-2 md:gap-4 relative z-20 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 w-full md:w-[276px] shrink-0 self-start md:self-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar justify-between md:justify-start">
          <div className="flex gap-2">
            <button className="h-8 px-3 rounded text-sm bg-background border shadow-sm disabled:opacity-50 whitespace-nowrap" type="button" disabled={!workspace.canUndo} onClick={workspace.undo}>
              撤销
            </button>
            <button className="h-8 px-3 rounded text-sm bg-background border shadow-sm disabled:opacity-50 whitespace-nowrap" type="button" disabled={!workspace.canRedo} onClick={workspace.redo}>
              重做
            </button>
          </div>
          <button className="h-8 px-3 rounded text-sm bg-background border shadow-sm disabled:opacity-50 text-destructive border-destructive/30 whitespace-nowrap" type="button" disabled={workspace.changedFiles.length === 0} onClick={workspace.discardAllChanges}>
            放弃更改
          </button>
        </div>

        <div className="flex-1 flex justify-center w-full min-w-0">
          <div className="w-full max-w-xl">
            <RepoSelector
              repos={workspace.repos}
              branches={workspace.branches}
              selectedRepoFullName={workspace.selectedRepo?.fullName || ''}
              selectedBranch={workspace.selectedBranch}
              isLoadingRepos={workspace.isLoadingRepos}
              isLoadingBranches={workspace.isLoadingBranches}
              isLoadingWorkspace={workspace.isLoadingWorkspace}
              workspaceLoadProgress={workspace.workspaceLoadProgress}
              onContinueAssetSync={() => void workspace.continueWorkspaceAssetSync()}
              onSkipAssetSync={workspace.skipWorkspaceAssetSync}
              onRepoChange={(value) => void workspace.selectRepo(value)}
              onBranchChange={workspace.selectBranch}
              onLoadWorkspace={() => void workspace.loadWorkspace()}
            />
          </div>
        </div>

        <div className="flex justify-end w-full md:w-[336px] xl:w-[416px] shrink-0 mt-1 md:mt-0">
          <button
            className="h-10 md:h-9 w-full md:w-auto px-4 rounded-md text-sm font-bold bg-primary text-primary-foreground shadow justify-center flex gap-2 items-center disabled:opacity-50 transition-colors"
            type="button"
            disabled={workspace.changedFiles.length === 0}
            onClick={() => setIsPublishDialogOpen(true)}
          >
            检查发布 ({workspace.changedFiles.length})
          </button>
        </div>
      </div>

      {workspace.error ? <p className="px-3 md:px-6 py-2 bg-destructive/10 text-destructive text-sm font-semibold border-b z-20 relative">{workspace.error}</p> : null}

      <section className="flex flex-1 min-h-0 bg-muted/10 relative overflow-hidden">
        {/* Mobile Overlays */}
        {(isLeftOpen || isRightOpen) && (
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
            onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar - Card Navigation */}
        <aside 
          className={`w-4/5 max-w-[320px] md:max-w-none shrink-0 border-r bg-card flex flex-col shadow-2xl md:shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] fixed md:relative inset-y-0 left-0 z-50 md:z-10 transition-all duration-300 overflow-hidden ${
            isLeftOpen ? 'translate-x-0' : '-translate-x-full'
          } ${showLeftSidebar ? 'md:translate-x-0 md:opacity-100 md:w-[320px]' : 'md:-translate-x-full md:opacity-0 md:border-r-0 md:w-0'}`}
        >
          <div className="sticky top-0 bg-card/90 backdrop-blur border-b px-4 py-3 xl:py-4 shrink-0 flex flex-col gap-3 z-10 w-full">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm tracking-wide">内容侧边栏</h2>
              <div className="flex items-center gap-2">
                <span className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-bold shadow-inner">
                  已加载 {workspace.workspace?.cards.length || 0}
                </span>
                <button type="button" className="md:hidden w-6 h-6 flex items-center justify-center bg-muted rounded-full" onClick={() => setIsLeftOpen(false)}>
                  <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {workspace.workspace && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-2.5 top-1.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索..."
                    className="w-full text-xs pl-8 pr-2 py-1.5 bg-background border rounded-md shadow-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>
                <div className="flex bg-muted/50 p-1 rounded-md border shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSortParam('date_desc')}
                    className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors ${sortParam === 'date_desc' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    先看最新
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortParam('date_asc')}
                    className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors ${sortParam === 'date_asc' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    按旧排序
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortParam('dirty_first')}
                    className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors ${sortParam === 'dirty_first' ? 'bg-background shadow-sm text-amber-600 dark:text-amber-500 border border-amber-200/50' : 'text-muted-foreground hover:text-amber-600'}`}
                  >
                    优先已改
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {workspace.workspace ? (
              <div className="flex flex-col gap-3" role="list" aria-label="Workspace cards tree">
                {Array.from(groupedCards.entries()).map(([school, channels]) => {
                  const isSchoolExpanded = expandedSchools.has(school);
                  
                  return (
                    <div key={school} className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSchool(school)}
                        className="flex items-center justify-between w-full font-bold text-xs px-3 py-1.5 bg-muted/50 text-muted-foreground rounded-md shadow-sm border hover:bg-muted transition-colors text-left"
                      >
                        <span className="truncate pr-2">{school}</span>
                        <svg className={`w-3 h-3 shrink-0 transition-transform ${isSchoolExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isSchoolExpanded && (
                        <div className="flex flex-col gap-2 ml-1">
                          {Array.from(channels.entries()).map(([channel, cards]) => {
                            const channelPath = `${school}-${channel}`;
                            const isChannelExpanded = expandedChannels.has(channelPath);
                            
                            return (
                              <div key={channel} className="flex flex-col gap-1 ml-2 border-l-2 border-primary/20 pl-2">
                                <div className="flex items-center justify-between w-full group">
                                  <button
                                    type="button"
                                    onClick={() => toggleChannel(channelPath)}
                                    className="flex items-center justify-between flex-1 text-[11px] font-semibold px-2 py-0.5 text-primary/80 uppercase tracking-wider hover:bg-primary/5 rounded text-left transition-colors mr-1"
                                  >
                                    <span className="truncate pr-2">{channel}</span>
                                    <svg className={`w-3 h-3 shrink-0 transition-transform ${isChannelExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rawSchoolSlug = String(cards[0]?.data.school_slug || '');
                                      workspace.addCard({ 
                                        school_slug: rawSchoolSlug,
                                          source: { channel } 
                                      });
                                      setExpandedSchools(prev => new Set(prev).add(school));
                                      setExpandedChannels(prev => new Set(prev).add(channelPath));
                                    }}
                                    className="w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity outline-none"
                                    title="在此源下新增卡片"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                  </button>
                                </div>
                                
                                {isChannelExpanded && cards.map((card) => {
                                  const changeInfo = workspace.changedFiles.find((c) => c.path === card.path);
                                  const isNew = changeInfo?.type === 'added';
                                  
                                  return (
                                  <button
                                    key={card.path}
                                    type="button"
                                    className={`flex flex-col text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 mt-1 ${
                                      workspace.selectedCardId === card.id 
                                        ? 'bg-primary/10 border-primary/30 border shadow-sm ring-1 ring-primary/20' 
                                        : 'hover:bg-muted border border-transparent hover:shadow-sm'
                                    }`}
                                    aria-pressed={workspace.selectedCardId === card.id}
                                    onClick={() => {
                                      workspace.selectCard(card.id);
                                      if (window.innerWidth < 768) {
                                        setIsLeftOpen(false); // Auto close sidebar on mobile card selection
                                      }
                                    }}
                                  >
                                    <div className="flex justify-between items-center w-full mb-1 gap-2">
                                      <strong className={`truncate text-[13px] font-bold leading-tight ${workspace.selectedCardId === card.id ? 'text-primary' : 'text-foreground'}`}>
                                        {String(card.data.title ?? card.id ?? '无标题')}
                                      </strong>
                                      {card.dirty && (
                                        <span 
                                          className={`h-2 w-2 rounded-full shrink-0 shadow-sm ${isNew ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                          title={isNew ? "新增卡片" : "已修改卡片"}
                                        ></span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground truncate font-mono opacity-80">{card.path.split('/').pop() || card.path}</span>
                                  </button>
                                )})}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground h-full">
                <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm font-medium">{workspaceBlockMessage || '请先加载工作区数据'}</p>
                <p className="text-xs mt-1 opacity-70">{workspaceBlockMessage ? '完成选择后，侧边栏与编辑器才会显示内容。' : '在顶部选择数据源'}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Center Main - Card Editor */}
        <section className="flex-1 flex flex-col bg-background overflow-hidden relative shadow-2xl z-20 min-w-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center w-full">
            <div className="w-full max-w-5xl">
              {workspace.workspace ? (
                <CardEditorPanel
                  card={workspace.selectedCard}
                  issues={workspace.validationIssues}
                  onFieldChange={workspace.updateField}
                  onBodyChange={workspace.updateBody}
                  onUploadAttachmentFiles={workspace.uploadAttachmentFiles}
                  onDeleteCard={workspace.deleteCard}
                  workspaceRepo={workspace.workspace?.repo || null}
                  workspaceBranch={workspace.workspace?.branch || null}
                  workspaceAttachments={workspace.workspace?.attachments || []}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <section className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center bg-muted/5 h-full">
                  <h2 className="text-xl font-bold mb-2">Card Editor</h2>
                  <p className="text-muted-foreground text-sm">{workspaceBlockMessage || 'Select a card to start editing.'}</p>
                </section>
              )}
            </div>
          </div>
        </section>

        {/* Right Sidebar - Live Preview and Modification History */}
        <aside 
          className={`w-4/5 max-w-[360px] md:max-w-none shrink-0 bg-background md:bg-muted/30 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.15)] md:shadow-inner border-l fixed md:relative inset-y-0 right-0 z-50 md:z-10 transition-all duration-300 overflow-hidden ${
            isRightOpen ? 'translate-x-0' : 'translate-x-full'
          } ${showRightSidebar ? 'md:translate-x-0 md:opacity-100 md:w-[440px] xl:w-[500px]' : 'md:translate-x-full md:opacity-0 md:border-l-0 md:w-0'}`}
        >
          {/* Top Half: Inline Preview */}
          <div className={`flex flex-col border-b bg-background overflow-hidden relative transition-all duration-300 ${isPreviewCollapsed ? 'h-[46px] shrink-0' : 'flex-1 min-h-0'}`}>
            <button 
              type="button"
              onClick={() => setIsPreviewCollapsed(p => !p)}
              className="sticky top-0 bg-muted/50 hover:bg-muted/70 backdrop-blur px-3 md:px-4 py-3 xl:py-4 shrink-0 w-full flex items-center justify-between z-10 border-b transition-colors cursor-pointer"
            >
              <h2 className="font-bold text-sm tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                即时预览
              </h2>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 flex items-center justify-center transition-transform ${isPreviewCollapsed ? 'rotate-180' : ''}`} >
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div 
                  className="md:hidden w-6 h-6 flex items-center justify-center bg-muted rounded-full" 
                  onClick={(e) => { e.stopPropagation(); setIsRightOpen(false); }}
                >
                  <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </button>
            <div className={`flex-1 overflow-hidden relative transition-opacity duration-300 ${isPreviewCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              {!isPreviewCollapsed && !canRenderInlinePreview ? (
                <div className="h-full flex items-center justify-center text-muted-foreground p-6 text-center bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-sm">{previewBlockMessage}</p>
                </div>
              ) : !isPreviewCollapsed ? (
                <LiveInlinePreview article={activePreviewArticle} preview={workspace.compileResult.preview} />
              ) : null}
            </div>
          </div>

          {/* Bottom Half: History */}
          <div className={`${isPreviewCollapsed ? 'flex-1' : 'h-[35%] min-h-[250px] shrink-0'} flex flex-col bg-muted/10 transition-all duration-300`}>
            <div className="sticky top-0 bg-muted/50 backdrop-blur border-b px-4 py-2.5 xl:py-3 shrink-0 flex items-center justify-between z-10">
              <h2 className="font-bold text-xs xl:text-sm tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"></path></svg>
                修改历史
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {workspace.changedFiles.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {workspace.changedFiles.map(changeInfo => {
                    const filePath = changeInfo.path;
                    const changeType = changeInfo.type;
                    const card = workspace.workspace?.cards.find(c => c.path === filePath);
                    const isAttachment = !filePath.startsWith('content/card/') && !filePath.endsWith('.md');
                    const isDeleted = changeType === 'deleted';
                    
                    const title = card ? String(card.data.title ?? card.id ?? '无标题') : filePath.split('/').pop() || filePath;
                    
                    return (
                      <button
                        key={filePath}
                        className={`text-left border rounded-lg p-3 shadow-sm transition-colors ${
                          isDeleted ? 'bg-destructive/5 hover:border-destructive/50' : 'bg-background hover:border-primary/50'
                        } ${!card && !isAttachment ? 'cursor-not-allowed opacity-80' : ''}`}
                        onClick={() => card && workspace.selectCard(card.id)}
                        disabled={isDeleted || isAttachment}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <strong className={`text-sm truncate font-medium ${isDeleted ? 'text-destructive line-through' : 'text-foreground'}`}>
                            {title}
                          </strong>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border shrink-0 ${
                            isDeleted 
                              ? 'bg-destructive/10 text-destructive border-destructive/20' 
                              : changeType === 'added'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : isAttachment 
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          }`}>
                            {isDeleted ? '已删除' : changeType === 'added' ? '新增' : isAttachment ? '附件' : '已修改'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate font-mono opacity-70">
                          {filePath.split('/').pop() || filePath}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 px-4 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  <p className="text-sm font-bold">{workspaceBlockMessage || '暂无修改记录'}</p>
                  <p className="text-xs mt-1">{workspaceBlockMessage ? '完成选择后，历史区域才会显示工作区内容。' : '编辑左侧内容后将在此处显示记录。'}</p>
                </div>
              )}
            </div>
          </div>
        </aside>
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
