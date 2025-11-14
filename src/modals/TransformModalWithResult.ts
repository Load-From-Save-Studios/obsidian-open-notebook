import { App, Modal, TFile } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { TransformModal } from './TransformModal';
import { TransformResultModal } from './TransformResultModal';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

/**
 * Modal that shows transformation selection, then shows result modal
 * Used for file transformations
 */
export class TransformModalWithResult {
  private app: App;
  private plugin: OpenNotebookPlugin;
  private file: TFile;

  constructor(app: App, plugin: OpenNotebookPlugin, file: TFile) {
    this.app = app;
    this.plugin = plugin;
    this.file = file;
  }

  async open(): Promise<void> {
    // Read file content
    const content = await this.app.vault.read(this.file);

    // Store result modal reference
    let resultModal: TransformResultModal | null = null;

    // Show transformation selection modal
    new TransformModal(
      this.app,
      this.plugin,
      content,
      async (transformedText: string, transformation?) => {
        if (!transformation || !resultModal) {
          NoticeHelper.warn('No transformation information available');
          return;
        }

        // Update result modal with transformation results
        resultModal.setResult({
          transformation,
          originalText: content,
          transformedText,
          context: {
            type: 'file',
            file: this.file,
            onRetry: () => {
              // Re-open the whole flow
              this.open();
            }
          }
        });
      },
      // onTransformStart callback - create and show loading modal
      () => {
        resultModal = new TransformResultModal(this.app, this.plugin);
        resultModal.open();
        return resultModal;
      }
    ).open();
  }
}
