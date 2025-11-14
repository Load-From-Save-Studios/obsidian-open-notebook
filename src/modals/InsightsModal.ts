import { App, Modal, MarkdownRenderer, Menu } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { APIInsight } from '../api/types';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class InsightsModal extends Modal {
  private plugin: OpenNotebookPlugin;
  private insights: APIInsight[] = [];
  private selectedInsight: APIInsight | null = null;
  private sourceId: string;
  private sourceTitle: string;
  private isLoading = false;
  private listEl: HTMLElement;
  private previewEl: HTMLElement;

  constructor(app: App, plugin: OpenNotebookPlugin, sourceId: string, sourceTitle: string) {
    super(app);
    this.plugin = plugin;
    this.sourceId = sourceId;
    this.sourceTitle = sourceTitle;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('open-notebook-insights-modal');

    // Set modal width directly (same as SearchModal)
    if (modalEl) {
      modalEl.style.width = '90vw';
      modalEl.style.maxWidth = '1200px';
    }

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'insights-header-container' });
    headerContainer.createEl('h2', { text: `Insights: ${this.sourceTitle}` });

    // Results section (2-column layout)
    const resultsSection = contentEl.createDiv({ cls: 'insights-results-section' });

    // Left column: Insights list
    const listContainer = resultsSection.createDiv({ cls: 'insights-list-container' });

    // Header with generate button
    const listHeader = listContainer.createDiv({ cls: 'insights-list-header' });
    listHeader.createEl('h3', { text: 'Insights' });

    const generateBtn = listHeader.createEl('button', {
      text: '✨ Generate Insight',
      cls: 'mod-cta insights-generate-button'
    });
    generateBtn.addEventListener('click', async () => {
      await this.generateInsightFromCurrentNote();
    });

    this.listEl = listContainer.createDiv({ cls: 'insights-list' });

    // Right column: Preview pane
    const previewContainer = resultsSection.createDiv({ cls: 'insights-preview-pane' });
    previewContainer.createEl('h3', { text: 'Preview' });

    this.previewEl = previewContainer.createDiv({ cls: 'insights-preview-content' });

    // Load insights
    await this.loadInsights();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async loadInsights(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.listEl.empty();
    this.previewEl.empty();

    // Show loading state
    this.listEl.createDiv({ cls: 'insights-loading', text: 'Loading insights...' });

    try {
      const client = this.plugin.getAPIClient();

      // Fetch insights for this source
      this.insights = await client.getInsights(this.sourceId);

      logger.info(`Loaded ${this.insights.length} insights for source ${this.sourceId}`);

      // Render insights list
      this.renderInsightsList();

      // If we have insights, select the first one by default
      if (this.insights.length > 0) {
        this.selectInsight(this.insights[0]);
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      logger.error('Failed to load insights', error);

      // Handle 404 specifically (endpoint not available or no insights)
      if (error.statusCode === 404) {
        this.showEmptyState(true);
      } else {
        this.listEl.empty();
        this.listEl.createDiv({
          cls: 'insights-error',
          text: `Failed to load insights: ${error.message || 'Unknown error'}`
        });
      }
    } finally {
      this.isLoading = false;
    }
  }

  private showEmptyState(is404 = false): void {
    this.listEl.empty();
    this.previewEl.empty();

    // Simple empty state like search modal
    this.listEl.createDiv({
      cls: 'insights-empty-state',
      text: 'No insights available. Click "Generate Insight" to create insights from your notes.'
    });

    // Preview pane empty state
    this.previewEl.createDiv({
      cls: 'insights-empty-state',
      text: 'Select an insight to preview'
    });
  }

  private renderInsightsList(): void {
    this.listEl.empty();

    if (this.insights.length === 0) {
      this.listEl.createDiv({
        cls: 'insights-no-results',
        text: 'No insights available'
      });
      return;
    }

    // Show count
    const countEl = this.listEl.createDiv({ cls: 'insights-count' });
    countEl.setText(`${this.insights.length} insight${this.insights.length === 1 ? '' : 's'} found`);

    // Render each insight
    for (const insight of this.insights) {
      const itemEl = this.listEl.createDiv({ cls: 'insight-item' });

      // Icon
      const iconEl = itemEl.createDiv({ cls: 'insight-icon' });
      iconEl.setText('✨');

      // Content
      const contentEl = itemEl.createDiv({ cls: 'insight-content' });

      // Generate smart title for list display
      let displayTitle = insight.title;
      if (!displayTitle || displayTitle === 'Untitled Insight' || displayTitle.trim() === '') {
        const insightType = insight.insight_type || 'Insight';
        const firstLine = insight.content?.split('\n')[0]?.trim().substring(0, 50) || '';
        if (firstLine) {
          displayTitle = `${insightType}: ${firstLine}`;
        } else {
          displayTitle = `${insightType}`;
        }
      }

      const titleEl = contentEl.createDiv({ cls: 'insight-title' });
      titleEl.setText(displayTitle);

      // Fix date handling
      let createdDate: Date;
      if (insight.created) {
        createdDate = new Date(insight.created);
        if (isNaN(createdDate.getTime())) {
          createdDate = new Date();
        }
      } else {
        createdDate = new Date();
      }

      const metaEl = contentEl.createDiv({ cls: 'insight-metadata' });
      const typeText = insight.insight_type || 'insight';
      const dateText = createdDate.toLocaleDateString();
      metaEl.setText(`${typeText} • ${dateText}`);

      // Click handler
      itemEl.addEventListener('click', () => {
        this.selectInsight(insight);
      });

      // Right-click context menu
      itemEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menu = new Menu();

        menu.addItem((item) => {
          item
            .setTitle('Delete Insight')
            .setIcon('trash')
            .onClick(async () => {
              await this.deleteInsight(insight);
            });
        });

        menu.showAtMouseEvent(e);
      });
    }
  }

  private selectInsight(insight: APIInsight): void {
    this.selectedInsight = insight;

    // Update selection UI
    const items = this.listEl.querySelectorAll('.insight-item');
    items.forEach((item, index) => {
      if (this.insights[index] === insight) {
        item.addClass('selected');
      } else {
        item.removeClass('selected');
      }
    });

    // Render preview
    this.renderPreview(insight);
  }

  private async renderPreview(insight: APIInsight): Promise<void> {
    this.previewEl.empty();

    // Generate smart title
    let displayTitle = insight.title;
    if (!displayTitle || displayTitle === 'Untitled Insight' || displayTitle.trim() === '') {
      const insightType = insight.insight_type || 'Insight';
      const firstLine = insight.content?.split('\n')[0]?.trim().substring(0, 50) || '';
      if (firstLine) {
        displayTitle = `${insightType}: ${firstLine}`;
      } else {
        displayTitle = `${insightType} - ${new Date().toLocaleDateString()}`;
      }
    }

    // Title
    this.previewEl.createEl('h4', { text: displayTitle });

    // Metadata
    const metadataEl = this.previewEl.createDiv({ cls: 'insights-preview-metadata' });

    const typeEl = metadataEl.createDiv();
    typeEl.createEl('strong', { text: 'Type: ' });
    typeEl.createSpan({ text: insight.insight_type || 'insight' });

    // Fix date handling
    let createdDate: Date;
    if (insight.created) {
      createdDate = new Date(insight.created);
      if (isNaN(createdDate.getTime())) {
        createdDate = new Date();
      }
    } else {
      createdDate = new Date();
    }

    const dateEl = metadataEl.createDiv();
    dateEl.createEl('strong', { text: 'Created: ' });
    dateEl.createSpan({ text: `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}` });

    if (insight.metadata?.topics && insight.metadata.topics.length > 0) {
      const topicsEl = metadataEl.createDiv({ cls: 'insights-preview-topics' });
      topicsEl.createEl('strong', { text: 'Topics: ' });
      const tagsContainer = topicsEl.createSpan();
      for (const topic of insight.metadata.topics) {
        tagsContainer.createSpan({ cls: 'topic-tag', text: topic });
      }
    }

    if (insight.metadata?.confidence !== undefined) {
      const confEl = metadataEl.createDiv();
      confEl.createEl('strong', { text: 'Confidence: ' });
      confEl.createSpan({ text: `${Math.round(insight.metadata.confidence * 100)}%` });
    }

    // Content
    const contentContainer = this.previewEl.createDiv({ cls: 'insights-preview-text' });

    if (insight.content) {
      const markdownContainer = contentContainer.createDiv({ cls: 'insights-preview-markdown' });
      await MarkdownRenderer.render(
        this.app,
        insight.content,
        markdownContainer,
        '',
        this.plugin
      );
    } else {
      contentContainer.createDiv({
        cls: 'insights-no-content',
        text: 'No content available for this insight'
      });
    }

    // Actions
    const actionsEl = this.previewEl.createDiv({ cls: 'insights-preview-actions' });

    const saveBtn = actionsEl.createEl('button', {
      text: 'Save as Note',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.saveInsightAsNote(insight);
    });

    const quoteBtn = actionsEl.createEl('button', {
      text: 'Insert Quote'
    });
    quoteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.insertAsQuote(insight);
    });

    const copyBtn = actionsEl.createEl('button', {
      text: 'Copy to Clipboard'
    });
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.copyInsightToClipboard(insight);
    });

    const deleteBtn = actionsEl.createEl('button', {
      text: 'Delete',
      cls: 'mod-warning'
    });
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.deleteInsight(insight);
    });
  }

  private async saveInsightAsNote(insight: APIInsight): Promise<void> {
    try {
      // Generate a meaningful title for the filename
      let title = insight.title;
      if (!title || title === 'Untitled Insight' || title.trim() === '') {
        // Generate title from type and first line of content
        const insightType = insight.insight_type || 'Insight';
        const firstLine = insight.content?.split('\n')[0]?.trim().substring(0, 50) || '';
        if (firstLine) {
          title = `${insightType}: ${firstLine}`;
        } else {
          title = `${insightType} - ${new Date().toLocaleDateString()}`;
        }
      }

      // Sanitize filename
      const sanitizedTitle = title
        .replace(/[\\/:*?"<>|]/g, '-')
        .substring(0, 100);

      const fileName = `${sanitizedTitle}.md`;

      // Get the active file's folder (if any)
      const activeFile = this.app.workspace.getActiveFile();
      const folder = activeFile?.parent || this.app.vault.getRoot();

      // Create note content
      const content = this.formatInsightAsNote(insight);

      // Check if file exists
      const existingFile = this.app.vault.getAbstractFileByPath(
        folder.path === '/' ? fileName : `${folder.path}/${fileName}`
      );

      if (existingFile) {
        NoticeHelper.warn('A file with this name already exists');
        return;
      }

      // Create the file
      const file = await this.app.vault.create(
        folder.path === '/' ? fileName : `${folder.path}/${fileName}`,
        content
      );

      NoticeHelper.success(`Saved insight as: ${fileName}`);

      // Open the new note
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);

      // Close the modal
      this.close();
    } catch (error) {
      logger.error('Failed to save insight as note', error);
      NoticeHelper.error(`Failed to save insight: ${error.message || 'Unknown error'}`);
    }
  }

  private formatInsightAsNote(insight: APIInsight): string {
    // Generate a meaningful title
    let title = insight.title;
    if (!title || title === 'Untitled Insight' || title.trim() === '') {
      // Generate title from type and first line of content
      const insightType = insight.insight_type || 'Insight';
      const firstLine = insight.content?.split('\n')[0]?.trim().substring(0, 50) || '';
      if (firstLine) {
        title = `${insightType}: ${firstLine}`;
      } else {
        title = `${insightType} - ${new Date().toLocaleDateString()}`;
      }
    }

    let content = `# ${title}\n\n`;

    // Add metadata
    content += `> **Type:** ${insight.insight_type || 'insight'}  \n`;

    // Fix date handling - use today's date if invalid
    let createdDate: Date;
    if (insight.created) {
      createdDate = new Date(insight.created);
      // Check if date is invalid
      if (isNaN(createdDate.getTime())) {
        createdDate = new Date();
      }
    } else {
      createdDate = new Date();
    }
    content += `> **Created:** ${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}  \n`;

    if (insight.metadata?.topics && insight.metadata.topics.length > 0) {
      content += `> **Topics:** ${insight.metadata.topics.join(', ')}  \n`;
    }

    if (insight.metadata?.confidence !== undefined) {
      content += `> **Confidence:** ${Math.round(insight.metadata.confidence * 100)}%  \n`;
    }

    content += `> **Source:** \`${insight.source_id}\`  \n`;
    content += `\n`;

    // Add content
    if (insight.content) {
      content += `${insight.content}\n`;
    }

    // Add backlink
    content += `\n---\n\n`;
    content += `*AI-generated insight from Open Notebook*\n`;

    return content;
  }

  private copyInsightToClipboard(insight: APIInsight): void {
    const content = this.formatInsightAsNote(insight);

    navigator.clipboard.writeText(content).then(() => {
      NoticeHelper.success('Copied insight to clipboard');
    }).catch(error => {
      logger.error('Failed to copy to clipboard', error);
      NoticeHelper.error('Failed to copy to clipboard');
    });
  }

  private insertAsQuote(insight: APIInsight): void {
    try {
      // Get the active editor
      const editor = this.app.workspace.activeEditor?.editor;
      if (!editor) {
        NoticeHelper.warn('No active editor to insert quote');
        return;
      }

      // Check if user has selected text in the preview
      const selection = window.getSelection();
      let content = '';

      if (selection && selection.toString().trim().length > 0) {
        content = selection.toString().trim();
        logger.info('Using selected text for quote:', content.length, 'chars');
      } else {
        content = insight.content || '';
        logger.info('Using full insight content for quote');
      }

      if (!content) {
        NoticeHelper.warn('No content to quote');
        return;
      }

      // Format as blockquote
      const quotedContent = content.split('\n').map(line => `> ${line}`).join('\n');

      // Create attribution
      const attribution = `*AI Insight: ${insight.title || 'Untitled'}* (${insight.insight_type || 'insight'})`;

      // Combine quote and attribution
      const quote = `${quotedContent}\n\n${attribution}`;

      // Insert into editor
      editor.replaceSelection(quote);

      NoticeHelper.success('Quote inserted');
      logger.info('Inserted quote from insight:', insight.id);

      // Close the modal after inserting
      this.close();
    } catch (error) {
      logger.error('Failed to insert quote', error);
      NoticeHelper.error('Failed to insert quote');
    }
  }

  private async generateInsightFromCurrentNote(): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Generating insight...');

    try {
      const client = this.plugin.getAPIClient();

      // Get available transformations
      const transformations = await client.getTransformations();

      if (!transformations || transformations.length === 0) {
        NoticeHelper.hideNotice(loadingNotice);
        NoticeHelper.warn('No transformations available. Please create a transformation first.');
        return;
      }

      // Use the first transformation (could be made configurable in settings)
      const transformationId = transformations[0].id;
      logger.info(`Using transformation: ${transformationId}`);

      // Generate insight using the source ID from modal
      const insight = await client.generateInsight(this.sourceId, transformationId);

      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.success('Insight generated successfully!');

      logger.info('Generated insight:', insight.id);

      // Reload insights list
      await this.loadInsights();
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      logger.error('Failed to generate insight', error);
      NoticeHelper.error(`Failed to generate insight: ${error.message || 'Unknown error'}`);
    }
  }

  private async deleteInsight(insight: APIInsight): Promise<void> {
    try {
      // Get display title for confirmation message
      let displayTitle = insight.title;
      if (!displayTitle || displayTitle === 'Untitled Insight' || displayTitle.trim() === '') {
        const insightType = insight.insight_type || 'Insight';
        const firstLine = insight.content?.split('\n')[0]?.trim().substring(0, 50) || '';
        if (firstLine) {
          displayTitle = `${insightType}: ${firstLine}`;
        } else {
          displayTitle = `${insightType}`;
        }
      }

      // Confirm deletion
      const confirmed = confirm(`Are you sure you want to delete this insight?\n\n"${displayTitle}"`);
      if (!confirmed) {
        return;
      }

      const loadingNotice = NoticeHelper.loading('Deleting insight...');

      try {
        const client = this.plugin.getAPIClient();
        await client.deleteInsight(insight.id);

        NoticeHelper.hideNotice(loadingNotice);
        NoticeHelper.success('Insight deleted');

        logger.info('Deleted insight:', insight.id);

        // Reload insights list
        await this.loadInsights();
      } catch (error) {
        NoticeHelper.hideNotice(loadingNotice);
        logger.error('Failed to delete insight', error);
        NoticeHelper.error(`Failed to delete insight: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('Error in deleteInsight', error);
      NoticeHelper.error('Failed to delete insight');
    }
  }
}
