import { App, Modal } from 'obsidian';
import { logger } from '../utils/Logger';

export class PodcastGenerationModal extends Modal {
  private isLoading = true;
  private successMessage: string | null = null;
  private errorMessage: string | null = null;

  constructor(app: App) {
    super(app);
  }

  /**
   * Set success state
   */
  public setSuccess(message: string, autoCloseMs: number = 2000): void {
    this.isLoading = false;
    this.successMessage = message;
    this.render();

    // Auto-close after specified time
    setTimeout(() => {
      this.close();
    }, autoCloseMs);
  }

  /**
   * Set error state
   */
  public setError(error: string): void {
    this.isLoading = false;
    this.errorMessage = error;
    this.render();
  }

  async onOpen() {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('podcast-generation-modal');

    if (this.isLoading) {
      this.renderLoadingState();
    } else if (this.successMessage) {
      this.renderSuccessState();
    } else if (this.errorMessage) {
      this.renderErrorState();
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderLoadingState(): void {
    const { contentEl } = this;

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'podcast-generation-header' });
    headerContainer.createEl('h2', { text: 'Generating Podcast...' });

    // Loading state
    const loadingContainer = contentEl.createDiv({ cls: 'podcast-generation-loading' });

    const spinner = loadingContainer.createDiv({ cls: 'podcast-loading-spinner' });
    spinner.setText('🎙️');

    const loadingText = loadingContainer.createDiv({ cls: 'podcast-loading-text' });
    loadingText.setText('Submitting podcast generation job...');

    const loadingHint = loadingContainer.createDiv({ cls: 'podcast-loading-hint' });
    loadingHint.setText('This will take a few minutes. You can check back later to see your podcast.');
  }

  private renderSuccessState(): void {
    const { contentEl } = this;

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'podcast-generation-header' });
    headerContainer.createEl('h2', { text: 'Podcast Generation Started!' });

    // Success state
    const successContainer = contentEl.createDiv({ cls: 'podcast-generation-success' });

    const successIcon = successContainer.createDiv({ cls: 'podcast-success-icon' });
    successIcon.setText('✅');

    const successText = successContainer.createDiv({ cls: 'podcast-success-text' });
    successText.setText(this.successMessage || 'Your podcast is being generated.');

    const successHint = successContainer.createDiv({ cls: 'podcast-success-hint' });
    successHint.setText('The podcast will appear in the episodes list once completed.');
  }

  private renderErrorState(): void {
    const { contentEl } = this;

    // Header
    const headerContainer = contentEl.createDiv({ cls: 'podcast-generation-header' });
    headerContainer.createEl('h2', { text: 'Generation Failed' });

    // Error state
    const errorContainer = contentEl.createDiv({ cls: 'podcast-generation-error' });

    const errorIcon = errorContainer.createDiv({ cls: 'podcast-error-icon' });
    errorIcon.setText('❌');

    const errorText = errorContainer.createDiv({ cls: 'podcast-error-text' });
    errorText.setText(this.errorMessage || 'Failed to generate podcast');

    // Close button
    const closeBtn = errorContainer.createEl('button', { text: 'Close', cls: 'mod-cta' });
    closeBtn.addEventListener('click', () => this.close());
  }
}
