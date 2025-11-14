import { App, Modal, TFile } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { APITransformation } from '../api/types';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export interface TransformResultOptions {
  transformation: APITransformation;
  originalText: string;
  transformedText: string;
  context: {
    type: 'selection' | 'note' | 'file';
    file?: TFile;
    onAccept?: (text: string) => void;
    onRetry?: () => void;
  };
}

export class TransformResultModal extends Modal {
  private plugin: OpenNotebookPlugin;
  private options: TransformResultOptions | null = null;
  private isLoading = true;

  constructor(app: App, plugin: OpenNotebookPlugin, options?: TransformResultOptions) {
    super(app);
    this.plugin = plugin;
    if (options) {
      this.options = options;
      this.isLoading = false;
    }
  }

  /**
   * Set the transformation result after loading completes
   */
  public setResult(options: TransformResultOptions): void {
    this.options = options;
    this.isLoading = false;
    this.render();
  }

  /**
   * Set error state
   */
  public setError(error: string): void {
    this.isLoading = false;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('transform-result-modal');

    const errorDiv = contentEl.createDiv({ cls: 'transform-result-error' });
    errorDiv.createEl('h3', { text: 'Transformation Failed' });
    errorDiv.createEl('p', { text: error });

    const closeBtn = errorDiv.createEl('button', { text: 'Close' });
    closeBtn.addEventListener('click', () => this.close());
  }

  async onOpen() {
    this.render();
  }

  private render(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('transform-result-modal');

    // Set modal width
    if (modalEl) {
      modalEl.style.width = '90vw';
      modalEl.style.maxWidth = '1400px';
    }

    if (this.isLoading || !this.options) {
      this.renderLoadingState();
      return;
    }

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'transform-result-header' });
    headerContainer.createEl('h2', { text: 'Transformation Complete' });

    const transformInfo = headerContainer.createDiv({ cls: 'transform-result-info' });
    transformInfo.createEl('span', {
      text: `${this.options.transformation.name}`,
      cls: 'transform-result-name'
    });

    // Preview section (side-by-side comparison)
    const previewSection = contentEl.createDiv({ cls: 'transform-result-preview' });

    // Original text column
    const originalColumn = previewSection.createDiv({ cls: 'transform-result-column' });
    originalColumn.createEl('h3', { text: 'Original' });
    const originalContent = originalColumn.createDiv({ cls: 'transform-result-content' });
    const originalPre = originalContent.createEl('pre');
    originalPre.createEl('code', { text: this.options.originalText });

    const originalStats = originalColumn.createDiv({ cls: 'transform-result-stats' });
    originalStats.setText(this.getStats(this.options.originalText));

    // Transformed text column
    const transformedColumn = previewSection.createDiv({ cls: 'transform-result-column' });
    transformedColumn.createEl('h3', { text: 'Transformed' });
    const transformedContent = transformedColumn.createDiv({ cls: 'transform-result-content' });
    const transformedPre = transformedContent.createEl('pre');
    transformedPre.createEl('code', { text: this.options.transformedText });

    const transformedStats = transformedColumn.createDiv({ cls: 'transform-result-stats' });
    transformedStats.setText(this.getStats(this.options.transformedText));

    // Action buttons
    const actionsEl = contentEl.createDiv({ cls: 'transform-result-actions' });

    // Primary actions
    const primaryActions = actionsEl.createDiv({ cls: 'transform-result-primary-actions' });

    const acceptBtn = primaryActions.createEl('button', {
      text: this.options.context.type === 'file' ? 'Replace File' : 'Accept',
      cls: 'mod-cta'
    });
    acceptBtn.addEventListener('click', async () => {
      await this.handleAccept();
    });

    if (this.options.context.type === 'file' && this.options.context.file) {
      const createNewBtn = primaryActions.createEl('button', {
        text: 'Create New Note',
        cls: 'mod-cta'
      });
      createNewBtn.addEventListener('click', async () => {
        await this.handleCreateNewNote();
      });
    }

    const copyBtn = primaryActions.createEl('button', {
      text: 'Copy to Clipboard'
    });
    copyBtn.addEventListener('click', () => {
      this.handleCopyToClipboard();
    });

    // Secondary actions
    const secondaryActions = actionsEl.createDiv({ cls: 'transform-result-secondary-actions' });

    if (this.options.context.onRetry) {
      const retryBtn = secondaryActions.createEl('button', {
        text: 'Retry'
      });
      retryBtn.addEventListener('click', () => {
        this.handleRetry();
      });
    }

    const cancelBtn = secondaryActions.createEl('button', {
      text: 'Cancel'
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private getStats(text: string): string {
    const chars = text.length;
    const words = text.trim().split(/\s+/).length;
    const lines = text.split('\n').length;
    return `${chars.toLocaleString()} characters · ${words.toLocaleString()} words · ${lines.toLocaleString()} lines`;
  }

  private async handleAccept(): Promise<void> {
    if (!this.options) {
      return;
    }

    try {
      if (this.options.context.type === 'file' && this.options.context.file) {
        // Replace file content
        await this.app.vault.modify(this.options.context.file, this.options.transformedText);
        NoticeHelper.success(`File "${this.options.context.file.basename}" updated`);
      } else if (this.options.context.onAccept) {
        // Use callback for selection/note replacements
        this.options.context.onAccept(this.options.transformedText);
        NoticeHelper.success('Transformation applied');
      }

      logger.info('Transformation accepted');
      this.close();
    } catch (error) {
      logger.error('Failed to accept transformation', error);
      NoticeHelper.error(`Failed to apply transformation: ${error.message || 'Unknown error'}`);
    }
  }

  private async handleCreateNewNote(): Promise<void> {
    if (!this.options) {
      return;
    }

    try {
      if (!this.options.context.file) {
        NoticeHelper.warn('No source file available');
        return;
      }

      const originalFile = this.options.context.file;
      const baseName = originalFile.basename;
      const transformName = this.options.transformation.name.replace(/\s+/g, '-').toLowerCase();

      // Create new file name: "Original Name - Transformation Name.md"
      const newFileName = `${baseName} - ${transformName}.md`;
      const newFilePath = originalFile.parent
        ? `${originalFile.parent.path}/${newFileName}`
        : newFileName;

      // Check if file already exists and increment number if needed
      let finalPath = newFilePath;
      let counter = 1;
      while (await this.app.vault.adapter.exists(finalPath)) {
        const basePath = newFilePath.replace('.md', '');
        finalPath = `${basePath} ${counter}.md`;
        counter++;
      }

      // Create the new file
      const newFile = await this.app.vault.create(finalPath, this.options.transformedText);

      NoticeHelper.success(`Created new note: ${newFile.basename}`);
      logger.info('Created new note with transformation:', newFile.path);

      // Optionally open the new file
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(newFile);

      this.close();
    } catch (error) {
      logger.error('Failed to create new note', error);
      NoticeHelper.error(`Failed to create new note: ${error.message || 'Unknown error'}`);
    }
  }

  private handleCopyToClipboard(): void {
    if (!this.options) {
      return;
    }

    navigator.clipboard.writeText(this.options.transformedText)
      .then(() => {
        NoticeHelper.success('Copied to clipboard');
        logger.info('Transformation copied to clipboard');
      })
      .catch((error) => {
        logger.error('Failed to copy to clipboard', error);
        NoticeHelper.error('Failed to copy to clipboard');
      });
  }

  private handleRetry(): void {
    logger.info('Retrying transformation');
    this.close();

    if (this.options && this.options.context.onRetry) {
      this.options.context.onRetry();
    }
  }

  private renderLoadingState(): void {
    const { contentEl } = this;

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'transform-result-header' });
    headerContainer.createEl('h2', { text: 'Transforming...' });

    // Loading state
    const loadingContainer = contentEl.createDiv({ cls: 'transform-result-loading' });

    const spinner = loadingContainer.createDiv({ cls: 'transform-loading-spinner' });
    spinner.setText('⚙️');

    const loadingText = loadingContainer.createDiv({ cls: 'transform-loading-text' });
    loadingText.setText('Processing your transformation...');

    const loadingHint = loadingContainer.createDiv({ cls: 'transform-loading-hint' });
    loadingHint.setText('This may take a few moments depending on the size of your content.');
  }
}
