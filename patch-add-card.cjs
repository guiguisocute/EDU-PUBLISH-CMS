const fs = require('fs');
const content = fs.readFileSync('hooks/use-draft-workspace.ts', 'utf-8');

const newFunctions = `
  function addCard(cardData?: Partial<CardFrontmatter>): void {
    if (!workspace) return;
    const newId = \`new-card-\${Date.now()}\`;
    const data: CardFrontmatter = {
      id: newId,
      school_slug: 'all',
      title: '新建卡片',
      published: 'false',
      created_at: new Date().toISOString(),
      ...cardData,
    };
    
    // Convert to CardDocument
    const newCard: CardDocument = {
      id: newId,
      path: \`content/cards/\${newId}.md\`,
      sha: '',
      raw: '---\n---\n',
      frontmatterText: '---\n---\n',
      bodyMarkdown: '',
      keyOrder: ['id', 'school_slug', 'title', 'published', 'created_at'],
      data,
      dirty: true,
    };
    
    commitWorkspaceUpdate((currentWorkspace) => {
      return {
        ...currentWorkspace,
        cards: [newCard, ...currentWorkspace.cards]
      };
    });
    setSelectedCardId(newId);
  }

  function deleteCard(cardId: string): void {
    if (!workspace) return;
    commitWorkspaceUpdate((currentWorkspace) => {
      return {
        ...currentWorkspace,
        cards: currentWorkspace.cards.filter((card) => card.id !== cardId)
      };
    });
    if (selectedCardId === cardId) {
      const remaining = workspace.cards.filter((card) => card.id !== cardId);
      setSelectedCardId(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  function discardAllChanges(): void {`;

const patched = content.replace('  function discardAllChanges(): void {', newFunctions);
fs.writeFileSync('hooks/use-draft-workspace.ts', patched);

// Also export them at the return
const finalPatched = fs.readFileSync('hooks/use-draft-workspace.ts', 'utf-8')
  .replace('    discardDraft,\n    discardAllChanges,', '    discardDraft,\n    addCard,\n    deleteCard,\n    discardAllChanges,');
fs.writeFileSync('hooks/use-draft-workspace.ts', finalPatched);
