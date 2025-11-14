// Modal for resolving sync conflicts between local and remote versions
import { App, Modal, Setting } from 'obsidian';
import { ConflictInfo } from '../types/sync';
import { logger } from '../utils/Logger';

export type ConflictResolutionChoice = 'local' | 'remote' | 'cancel';

export class ConflictModal extends Modal {
  private conflict: ConflictInfo;
  private onResolve: (choice: ConflictResolutionChoice) => void;

  constructor(
    app: App,
    conflict: ConflictInfo,
    onResolve: (choice: ConflictResolutionChoice) => void
  ) {
    super(app);
    this.conflict = conflict;
    this.onResolve = onResolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('open-notebook-conflict-modal');

    // Title
    contentEl.createEl('h2', { text: 'Sync Conflict Detected' });

    // Description
    const descEl = contentEl.createDiv({ cls: 'conflict-description' });
    descEl.createEl('p', {
      text: `Both the local and remote versions of "${this.getFileName()}" have been modified.`
    });
    descEl.createEl('p', {
      text: 'Please choose which version to keep:'
    });

    // Conflict details
    const detailsEl = contentEl.createDiv({ cls: 'conflict-details' });

    // Local version
    const localSection = detailsEl.createDiv({ cls: 'conflict-version' });
    localSection.createEl('h3', { text: '📝 Local Version (Obsidian)' });

    const localMeta = localSection.createDiv({ cls: 'conflict-metadata' });
    localMeta.createEl('div', {
      text: `Modified: ${this.formatDate(this.conflict.localVersion.modifiedAt)}`
    });

    const localPreview = localSection.createDiv({ cls: 'conflict-preview' });
    const localContent = localPreview.createEl('pre');
    localContent.setText(this.truncateContent(this.conflict.localVersion.content));

    // Remote version
    const remoteSection = detailsEl.createDiv({ cls: 'conflict-version' });
    remoteSection.createEl('h3', { text: '☁️ Remote Version (Open Notebook)' });

    const remoteMeta = remoteSection.createDiv({ cls: 'conflict-metadata' });
    remoteMeta.createEl('div', {
      text: `Modified: ${this.formatDate(this.conflict.remoteVersion.modifiedAt)}`
    });

    const remotePreview = remoteSection.createDiv({ cls: 'conflict-preview' });
    const remoteContent = remotePreview.createEl('pre');
    remoteContent.setText(this.truncateContent(this.conflict.remoteVersion.content));

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: 'conflict-buttons' });

    // Keep local button
    const localBtn = buttonsEl.createEl('button', {
      cls: 'mod-cta',
      text: 'Keep Local Version'
    });
    localBtn.addEventListener('click', () => {
      logger.info('User chose to keep local version');
      this.onResolve('local');
      this.close();
    });

    // Keep remote button
    const remoteBtn = buttonsEl.createEl('button', {
      cls: 'mod-warning',
      text: 'Keep Remote Version'
    });
    remoteBtn.addEventListener('click', () => {
      logger.info('User chose to keep remote version');
      this.onResolve('remote');
      this.close();
    });

    // Cancel button
    const cancelBtn = buttonsEl.createEl('button', {
      text: 'Cancel'
    });
    cancelBtn.addEventListener('click', () => {
      logger.info('User cancelled conflict resolution');
      this.onResolve('cancel');
      this.close();
    });

    // Warning message
    const warningEl = contentEl.createDiv({ cls: 'conflict-warning' });
    warningEl.createEl('p', {
      text: '⚠️ The version you don\'t choose will be lost. Consider backing up important changes before proceeding.'
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Get file name from path
   */
  private getFileName(): string {
    const parts = this.conflict.filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  /**
   * Truncate content for preview
   */
  private truncateContent(content: string, maxLines: number = 20): string {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }
    return lines.slice(0, maxLines).join('\n') + '\n\n... (truncated)';
  }
}
