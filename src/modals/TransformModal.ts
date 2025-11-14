import { App, Modal, MarkdownRenderer } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { APITransformation } from '../api/types';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class TransformModal extends Modal {
  private plugin: OpenNotebookPlugin;
  private transformations: APITransformation[] = [];
  private selectedTransformation: APITransformation | null = null;
  private text: string;
  private onSelect: (result: string, transformation?: APITransformation) => void;
  private onTransformStart?: () => any;
  private isLoading = false;
  private listEl: HTMLElement;
  private previewEl: HTMLElement;
  private searchInputEl: HTMLInputElement;

  constructor(
    app: App,
    plugin: OpenNotebookPlugin,
    text: string,
    onSelect: (result: string, transformation?: APITransformation) => void,
    onTransformStart?: () => any
  ) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.onSelect = onSelect;
    this.onTransformStart = onTransformStart;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('open-notebook-transform-modal');

    // Set modal width
    if (modalEl) {
      modalEl.style.width = '90vw';
      modalEl.style.maxWidth = '1200px';
    }

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'transform-header-container' });
    headerContainer.createEl('h2', { text: 'Transform Text' });

    // Search box
    const searchContainer = contentEl.createDiv({ cls: 'transform-search-container' });
    this.searchInputEl = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search transformations...',
      cls: 'transform-search-input'
    });
    this.searchInputEl.addEventListener('input', () => {
      this.filterTransformations();
    });

    // Results section (2-column layout)
    const resultsSection = contentEl.createDiv({ cls: 'transform-results-section' });

    // Left column: Transformations list
    const listContainer = resultsSection.createDiv({ cls: 'transform-list-container' });
    listContainer.createEl('h3', { text: 'Available Transformations' });
    this.listEl = listContainer.createDiv({ cls: 'transform-list' });

    // Right column: Preview pane
    const previewContainer = resultsSection.createDiv({ cls: 'transform-preview-pane' });
    previewContainer.createEl('h3', { text: 'Details' });
    this.previewEl = previewContainer.createDiv({ cls: 'transform-preview-content' });

    // Load transformations
    await this.loadTransformations();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private async loadTransformations(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.listEl.empty();
    this.previewEl.empty();

    // Show loading state
    this.listEl.createDiv({ cls: 'transform-loading', text: 'Loading transformations...' });

    try {
      const client = this.plugin.getAPIClient();
      this.transformations = await client.getTransformations();

      logger.info(`Loaded ${this.transformations.length} transformations`);

      // Render transformations list
      this.renderTransformationsList();

      // If we have transformations, select the first one by default
      if (this.transformations.length > 0) {
        this.selectTransformation(this.transformations[0]);
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      logger.error('Failed to load transformations', error);
      this.listEl.empty();
      this.listEl.createDiv({
        cls: 'transform-error',
        text: `Failed to load transformations: ${error.message || 'Unknown error'}`
      });
    } finally {
      this.isLoading = false;
    }
  }

  private showEmptyState(): void {
    this.listEl.empty();
    this.previewEl.empty();

    this.listEl.createDiv({
      cls: 'transform-empty-state',
      text: 'No transformations available. Please create transformations in Open Notebook first.'
    });

    this.previewEl.createDiv({
      cls: 'transform-empty-state',
      text: 'Select a transformation to see details'
    });
  }

  private filterTransformations(): void {
    const searchTerm = this.searchInputEl.value.toLowerCase();
    this.renderTransformationsList(searchTerm);
  }

  private renderTransformationsList(searchTerm: string = ''): void {
    this.listEl.empty();

    // Filter transformations
    const filtered = this.transformations.filter(t => {
      if (!searchTerm) return true;
      return (
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm)
      );
    });

    if (filtered.length === 0) {
      this.listEl.createDiv({
        cls: 'transform-no-results',
        text: searchTerm ? 'No matching transformations found' : 'No transformations available'
      });
      return;
    }

    // Show count
    const countEl = this.listEl.createDiv({ cls: 'transform-count' });
    countEl.setText(`${filtered.length} transformation${filtered.length === 1 ? '' : 's'} available`);

    // Render each transformation
    for (const transformation of filtered) {
      const itemEl = this.listEl.createDiv({ cls: 'transform-item' });

      // Icon based on system vs custom
      const iconEl = itemEl.createDiv({ cls: 'transform-icon' });
      iconEl.setText(transformation.is_system ? '⚙️' : '🔧');

      // Content
      const contentEl = itemEl.createDiv({ cls: 'transform-content' });

      const titleEl = contentEl.createDiv({ cls: 'transform-title' });
      titleEl.setText(transformation.name);

      const descEl = contentEl.createDiv({ cls: 'transform-description' });
      descEl.setText(transformation.description || 'No description');

      // Click handler
      itemEl.addEventListener('click', () => {
        this.selectTransformation(transformation);
      });
    }
  }

  private selectTransformation(transformation: APITransformation): void {
    this.selectedTransformation = transformation;

    // Update selection UI
    const items = this.listEl.querySelectorAll('.transform-item');
    const searchTerm = this.searchInputEl.value.toLowerCase();
    const filtered = this.transformations.filter(t => {
      if (!searchTerm) return true;
      return (
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm)
      );
    });

    items.forEach((item, index) => {
      if (filtered[index] === transformation) {
        item.addClass('selected');
      } else {
        item.removeClass('selected');
      }
    });

    // Render preview
    this.renderPreview(transformation);
  }

  private async renderPreview(transformation: APITransformation): Promise<void> {
    this.previewEl.empty();

    // Title
    this.previewEl.createEl('h4', { text: transformation.name });

    // Metadata
    const metadataEl = this.previewEl.createDiv({ cls: 'transform-preview-metadata' });

    const typeEl = metadataEl.createDiv();
    typeEl.createEl('strong', { text: 'Type: ' });
    typeEl.createSpan({ text: transformation.is_system ? 'System' : 'Custom' });

    if (transformation.model) {
      const modelEl = metadataEl.createDiv();
      modelEl.createEl('strong', { text: 'Model: ' });
      modelEl.createSpan({ text: transformation.model });
    }

    if (transformation.temperature !== undefined) {
      const tempEl = metadataEl.createDiv();
      tempEl.createEl('strong', { text: 'Temperature: ' });
      tempEl.createSpan({ text: transformation.temperature.toString() });
    }

    if (transformation.max_tokens) {
      const tokensEl = metadataEl.createDiv();
      tokensEl.createEl('strong', { text: 'Max Tokens: ' });
      tokensEl.createSpan({ text: transformation.max_tokens.toString() });
    }

    // Description
    if (transformation.description) {
      this.previewEl.createEl('h5', { text: 'Description' });
      const descContainer = this.previewEl.createDiv({ cls: 'transform-preview-description' });
      descContainer.setText(transformation.description);
    }

    // Prompt template (collapsible)
    if (transformation.prompt_template) {
      this.previewEl.createEl('h5', { text: 'Prompt Template' });
      const promptContainer = this.previewEl.createDiv({ cls: 'transform-preview-prompt' });
      const promptEl = promptContainer.createEl('pre');
      promptEl.createEl('code', { text: transformation.prompt_template });
    }

    // Text preview (show first few lines of input text)
    this.previewEl.createEl('h5', { text: 'Input Text Preview' });
    const textPreview = this.previewEl.createDiv({ cls: 'transform-text-preview' });
    const previewText = this.text.length > 500
      ? this.text.substring(0, 500) + '...'
      : this.text;
    textPreview.setText(previewText);

    const charCount = this.previewEl.createDiv({ cls: 'transform-char-count' });
    charCount.setText(`${this.text.length} characters`);

    // Actions
    const actionsEl = this.previewEl.createDiv({ cls: 'transform-preview-actions' });

    const applyBtn = actionsEl.createEl('button', {
      text: 'Apply Transformation',
      cls: 'mod-cta'
    });
    applyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.executeTransformation(transformation);
    });

    const cancelBtn = actionsEl.createEl('button', {
      text: 'Cancel'
    });
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
  }

  private async executeTransformation(transformation: APITransformation): Promise<void> {
    // If there's a callback for transformation start, call it
    // This allows the caller to show a loading modal
    const loadingModal = this.onTransformStart ? this.onTransformStart() : null;

    // Close this modal before starting transformation
    this.close();

    try {
      const client = this.plugin.getAPIClient();

      // Use model override from settings if configured
      const modelOverride = this.plugin.settings.defaultTransformationModel;

      const response = await client.executeTransformation(
        transformation.id,
        this.text,
        modelOverride
      );

      logger.info('Transformation complete:', transformation.id);

      // Call the callback with the result and transformation
      this.onSelect(response.output, transformation);

    } catch (error) {
      logger.error('Failed to execute transformation', error);

      // If there's a loading modal with setError method, use it
      if (loadingModal && typeof loadingModal.setError === 'function') {
        loadingModal.setError(error.message || 'Unknown error occurred during transformation');
      } else {
        NoticeHelper.error(`Failed to transform text: ${error.message || 'Unknown error'}`);
      }
    }
  }
}
