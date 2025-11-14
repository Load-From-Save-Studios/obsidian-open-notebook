// Search modal for searching Open Notebook sources and notes
import { App, Modal, Setting, MarkdownRenderer } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { SearchResult } from '../types/search';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class SearchModal extends Modal {
  private plugin: OpenNotebookPlugin;
  private searchType: 'text' | 'vector' = 'vector';
  private searchSources: boolean = true;
  private searchNotes: boolean = true;
  private results: SearchResult[] = [];
  private selectedIndex: number = 0;

  // UI elements
  private queryInput: HTMLInputElement;
  private resultsContainer: HTMLElement;
  private previewContainer: HTMLElement;

  constructor(app: App, plugin: OpenNotebookPlugin) {
    super(app);
    this.plugin = plugin;
    this.searchType = plugin.settings.defaultSearchMode;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('open-notebook-search-modal');

    // Set modal width directly
    if (modalEl) {
      modalEl.style.width = '90vw';
      modalEl.style.maxWidth = '1200px';
    }

    // Title
    contentEl.createEl('h2', { text: 'Search Open Notebook' });

    // Search input section
    const inputSection = contentEl.createDiv({ cls: 'search-input-section' });

    // Query input
    const inputContainer = inputSection.createDiv({ cls: 'search-input-container' });
    this.queryInput = inputContainer.createEl('input', {
      type: 'text',
      placeholder: 'Enter search query...',
      cls: 'search-input'
    });

    const searchBtn = inputContainer.createEl('button', {
      text: '🔍',
      cls: 'search-button'
    });

    // Search on Enter key
    this.queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.performSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevious();
      }
    });

    searchBtn.addEventListener('click', () => this.performSearch());

    // Options
    const optionsContainer = inputSection.createDiv({ cls: 'search-options' });

    // Search type radio buttons
    const typeContainer = optionsContainer.createDiv({ cls: 'search-type-container' });

    const textRadio = typeContainer.createEl('label');
    const textInput = textRadio.createEl('input', {
      type: 'radio',
      attr: { name: 'search-type', value: 'text' }
    });
    textInput.checked = this.searchType === 'text';
    textRadio.appendText(' Text');

    const vectorRadio = typeContainer.createEl('label');
    const vectorInput = vectorRadio.createEl('input', {
      type: 'radio',
      attr: { name: 'search-type', value: 'vector' }
    });
    vectorInput.checked = this.searchType === 'vector';
    vectorRadio.appendText(' Vector (Semantic)');

    textInput.addEventListener('change', () => {
      this.searchType = 'text';
    });

    vectorInput.addEventListener('change', () => {
      this.searchType = 'vector';
    });

    // Scope checkboxes
    const scopeContainer = optionsContainer.createDiv({ cls: 'search-scope-container' });

    const sourcesCheck = scopeContainer.createEl('label');
    const sourcesInput = sourcesCheck.createEl('input', {
      type: 'checkbox',
      attr: { name: 'search-sources' }
    });
    sourcesInput.checked = this.searchSources;
    sourcesCheck.appendText(' Sources');

    const notesCheck = scopeContainer.createEl('label');
    const notesInput = notesCheck.createEl('input', {
      type: 'checkbox',
      attr: { name: 'search-notes' }
    });
    notesInput.checked = this.searchNotes;
    notesCheck.appendText(' Notes');

    sourcesInput.addEventListener('change', () => {
      this.searchSources = sourcesInput.checked;
    });

    notesInput.addEventListener('change', () => {
      this.searchNotes = notesInput.checked;
    });

    // Results section
    const resultsSection = contentEl.createDiv({ cls: 'search-results-section' });

    // Results list
    const listContainer = resultsSection.createDiv({ cls: 'search-results-list-container' });
    listContainer.createEl('h3', { text: 'Results' });
    this.resultsContainer = listContainer.createDiv({ cls: 'search-results-list' });
    this.renderEmptyState();

    // Preview pane
    const previewPane = resultsSection.createDiv({ cls: 'search-preview-pane' });
    previewPane.createEl('h3', { text: 'Preview' });
    this.previewContainer = previewPane.createDiv({ cls: 'search-preview-content' });

    // Focus on input
    this.queryInput.focus();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Perform search
   */
  private async performSearch(): Promise<void> {
    const query = this.queryInput.value.trim();

    if (!query) {
      NoticeHelper.warn('Please enter a search query');
      return;
    }

    // Show loading state
    this.resultsContainer.empty();
    const loadingEl = this.resultsContainer.createDiv({ cls: 'search-loading' });
    loadingEl.createEl('div', { cls: 'search-loading-spinner', text: '●●●' });
    loadingEl.createEl('div', { text: 'Searching...' });

    try {
      const client = this.plugin.getAPIClient();

      // Get the current folder's mapped notebook
      let notebookId: string | undefined;
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        const folderPath = activeFile.parent?.path || '';
        notebookId = this.plugin.getFolderMapping(folderPath);
        if (notebookId) {
          logger.info('Searching in notebook:', notebookId, 'for folder:', folderPath);
        }
      }

      // Perform search
      const results = await client.search({
        query,
        type: this.searchType,
        limit: 50,
        searchSources: this.searchSources,
        searchNotes: this.searchNotes,
        notebookId: notebookId
      });

      // Filter results: keep only sources (synced Obsidian notes)
      // Exclude AI-generated insights and summaries
      const filteredResults = results.filter(result => {
        const isNote = result.id.startsWith('note:');
        const isPodcast = result.id.startsWith('podcast:');
        const isSourceInsight = result.id.startsWith('source_insight:');
        const isSource = result.id.startsWith('source:');

        // Exclude AI-generated insights and summaries
        if (isSourceInsight) {
          logger.debug(`Filtering out insight: ${result.id} (${result.title})`);
          return false;
        }

        // Keep sources (synced Obsidian notes), notes, and podcasts
        if (isSource || isNote || isPodcast) {
          logger.debug(`Keeping: ${result.id} (${result.title})`);
          return true;
        }

        // Exclude anything else
        logger.debug(`Filtering out unknown type: ${result.id} (${result.title})`);
        return false;
      });

      logger.info(`Filtered ${results.length} results to ${filteredResults.length} (sources only, no insights)`);

      // Sort results by score (highest first)
      filteredResults.sort((a, b) => b.score - a.score);

      this.results = filteredResults;
      this.selectedIndex = 0;

      logger.info(`Search returned ${filteredResults.length} results`);

      // Render results
      this.renderResults();

      // Show first result preview
      if (filteredResults.length > 0) {
        this.renderPreview(filteredResults[0]);
      }

    } catch (error) {
      logger.error('Search failed', error);
      NoticeHelper.error('Search failed');

      this.resultsContainer.empty();
      this.resultsContainer.createDiv({
        cls: 'search-error',
        text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    this.resultsContainer.empty();
    this.resultsContainer.createDiv({
      cls: 'search-empty-state',
      text: 'Enter a query and press Enter to search'
    });
  }

  /**
   * Render search results
   */
  private renderResults(): void {
    this.resultsContainer.empty();

    if (this.results.length === 0) {
      this.resultsContainer.createDiv({
        cls: 'search-no-results',
        text: 'No results found'
      });
      return;
    }

    this.resultsContainer.createDiv({
      cls: 'search-results-count',
      text: `${this.results.length} result${this.results.length === 1 ? '' : 's'}`
    });

    this.results.forEach((result, index) => {
      const resultEl = this.resultsContainer.createDiv({
        cls: `search-result-item ${index === this.selectedIndex ? 'selected' : ''}`
      });

      // Type icon
      const icon = resultEl.createSpan({ cls: 'search-result-icon' });
      icon.setText(result.type === 'source' ? '📄' : '📝');

      // Content
      const contentEl = resultEl.createDiv({ cls: 'search-result-content' });

      const titleEl = contentEl.createDiv({ cls: 'search-result-title' });
      titleEl.setText(result.title || 'Untitled');

      const excerptEl = contentEl.createDiv({ cls: 'search-result-excerpt' });
      excerptEl.setText(this.truncateExcerpt(result.excerpt));

      // Score (show for both text and vector search)
      if (result.score > 0) {
        const scoreEl = resultEl.createDiv({ cls: 'search-result-score' });
        scoreEl.setText(`${Math.round(result.score * 100)}%`);
      }

      // Click handler
      resultEl.addEventListener('click', () => {
        this.selectedIndex = index;
        this.renderResults();
        this.renderPreview(result);
      });
    });
  }

  /**
   * Render preview for selected result
   */
  private async renderPreview(result: SearchResult): Promise<void> {
    this.previewContainer.empty();

    logger.debug('Rendering preview for result:', result);

    // Title
    this.previewContainer.createEl('h4', { text: result.title || 'Untitled' });

    // Type and ID info
    const infoEl = this.previewContainer.createDiv({ cls: 'search-preview-metadata' });
    infoEl.createDiv({
      text: `Type: ${result.type} | ID: ${result.id}`,
      cls: 'search-result-info'
    });

    // Metadata
    if (result.metadata) {
      const metaEl = this.previewContainer.createDiv({ cls: 'search-preview-metadata' });

      if (result.metadata.topics && result.metadata.topics.length > 0) {
        const topicsEl = metaEl.createDiv({ cls: 'search-preview-topics' });
        topicsEl.createSpan({ text: 'Topics: ' });
        result.metadata.topics.forEach(topic => {
          topicsEl.createSpan({ cls: 'topic-tag', text: topic });
        });
      }

      if (result.metadata.created) {
        metaEl.createDiv({
          text: `Created: ${new Date(result.metadata.created).toLocaleDateString()}`
        });
      }
    }

    // Excerpt/Content - fetch full content if not available
    const contentEl = this.previewContainer.createDiv({ cls: 'search-preview-text' });
    let content = result.content || result.excerpt || '';

    // If no content, fetch the full source/note
    if (!content) {
      contentEl.createDiv({ cls: 'search-loading', text: 'Loading content...' });

      try {
        const client = this.plugin.getAPIClient();

        // Determine if this is a source or note and fetch accordingly
        const isSource = result.id.startsWith('source:') || result.id.startsWith('source_insight:');

        if (isSource) {
          const source = await client.getSource(result.id);
          content = source.full_text || '';
          logger.debug('Fetched source content:', content.length, 'chars');
        } else {
          const note = await client.getNote(result.id);
          content = note.content || '';
          logger.debug('Fetched note content:', content.length, 'chars');
        }

        // Update result with fetched content for future use
        result.content = content;

        // Re-render with content
        contentEl.empty();
      } catch (error) {
        logger.error('Failed to fetch content:', error);
        contentEl.empty();
        contentEl.createDiv({
          text: 'Failed to load content',
          cls: 'search-no-content'
        });
        return;
      }
    }

    if (content) {
      // Render markdown content
      const markdownContainer = contentEl.createDiv({ cls: 'search-preview-markdown' });
      MarkdownRenderer.render(
        this.app,
        content,
        markdownContainer,
        '', // sourcePath
        this.plugin
      );
    } else {
      contentEl.createDiv({
        text: 'No content available for preview',
        cls: 'search-no-content'
      });
      logger.warn('No content available for result:', result);
    }

    // Actions
    const actionsEl = this.previewContainer.createDiv({ cls: 'search-preview-actions' });

    const insertLinkBtn = actionsEl.createEl('button', {
      text: 'Insert Link',
      cls: 'mod-cta'
    });
    insertLinkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logger.info('Insert Link clicked for:', result);
      this.insertAsLink(result);
    });

    const insertEmbedBtn = actionsEl.createEl('button', {
      text: 'Insert Quote'
    });
    insertEmbedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logger.info('Insert Quote clicked for:', result);
      this.insertAsQuote(result);
    });

    const createNoteBtn = actionsEl.createEl('button', {
      text: 'Create Note'
    });
    createNoteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logger.info('Create Note clicked for:', result);
      this.createNote(result);
    });

    // Open source button
    const openBtn = actionsEl.createEl('button', {
      text: 'View in Open Notebook'
    });
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openInOpenNotebook(result);
    });
  }

  /**
   * Select next result
   */
  private selectNext(): void {
    if (this.results.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
    this.renderResults();
    this.renderPreview(this.results[this.selectedIndex]);
  }

  /**
   * Select previous result
   */
  private selectPrevious(): void {
    if (this.results.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
    this.renderResults();
    this.renderPreview(this.results[this.selectedIndex]);
  }

  /**
   * Insert result as link
   */
  private insertAsLink(result: SearchResult): void {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) {
      NoticeHelper.warn('No active editor');
      return;
    }

    const link = `[${result.title}](open-notebook://${result.type}/${result.id})`;
    editor.replaceSelection(link);

    NoticeHelper.success('Link inserted');
    this.close();
  }

  /**
   * Insert result as quote
   */
  private insertAsQuote(result: SearchResult): void {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) {
      NoticeHelper.warn('No active editor');
      return;
    }

    // Check if user has selected text in the preview
    const selection = window.getSelection();
    let content = '';

    if (selection && selection.toString().trim().length > 0) {
      // Use selected text
      content = selection.toString().trim();
      logger.info('Using selected text for quote:', content.length, 'chars');
    } else {
      // Fall back to excerpt or full content
      content = result.excerpt || result.content || '';
      logger.info('Using full excerpt/content for quote');
    }

    if (!content) {
      NoticeHelper.warn('No content to quote');
      return;
    }

    // Create quote with backlink only if it's from a synced Obsidian note
    let sourceAttribution: string;
    if (result.id.startsWith('source:')) {
      // Synced Obsidian note - add backlink
      const link = `[${result.title}](open-notebook://${result.type}/${result.id})`;
      sourceAttribution = `Source: ${link}`;
    } else {
      // Not a synced note - just show title without link
      sourceAttribution = `Source: ${result.title}`;
    }

    const quote = `> ${content.split('\n').join('\n> ')}\n\n${sourceAttribution}`;
    editor.replaceSelection(quote);

    NoticeHelper.success('Quote inserted');
    this.close();
  }

  /**
   * Create note from result
   */
  private async createNote(result: SearchResult): Promise<void> {
    try {
      // Check if user has selected text in the preview
      const selection = window.getSelection();
      let content = '';

      if (selection && selection.toString().trim().length > 0) {
        // Use selected text
        content = selection.toString().trim();
        logger.info('Using selected text for note:', content.length, 'chars');
      } else {
        // Fall back to full content or excerpt
        content = result.content || result.excerpt || '';
        logger.info('Using full content/excerpt for note');
      }

      if (!content) {
        NoticeHelper.warn('No content available to create note');
        return;
      }

      // Sanitize filename
      const sanitizedTitle = (result.title || 'Search Result').replace(/[\\/:*?"<>|]/g, '-');
      const fileName = `${sanitizedTitle}.md`;

      logger.info('Creating note:', fileName);

      const file = await this.app.vault.create(fileName, content);

      NoticeHelper.success(`Note created: ${fileName}`);
      this.close();

      // Open the new file
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);

    } catch (error) {
      logger.error('Failed to create note', error);
      NoticeHelper.error(`Failed to create note: ${error.message}`);
    }
  }

  /**
   * Open result in Open Notebook web UI
   */
  private openInOpenNotebook(result: SearchResult): void {
    const endpoint = this.plugin.settings.apiEndpoint;
    const url = `${endpoint}/${result.type}s/${result.id}`;

    logger.info('Opening in Open Notebook:', url);
    window.open(url, '_blank');
    NoticeHelper.info('Opening in browser...');
  }

  /**
   * Truncate excerpt for list view
   */
  private truncateExcerpt(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Truncate content for preview
   */
  private truncateContent(text: string, maxLines: number = 30): string {
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join('\n') + '\n\n... (truncated)';
  }
}
