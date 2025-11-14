// Transformation-related commands
import { App, Editor, MarkdownView } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { TransformModal } from '../modals/TransformModal';
import { TransformResultModal } from '../modals/TransformResultModal';
import { NoticeHelper } from '../utils/NoticeHelper';
import { logger } from '../utils/Logger';

export class TransformCommands {
  private app: App;
  private plugin: OpenNotebookPlugin;

  // Built-in transformation names (these should match the transformations in Open Notebook)
  private readonly BUILTIN_TRANSFORMATIONS = {
    SUMMARIZE: 'Simple Summary',
    DENSE_SUMMARY: 'Dense Summary',
    KEY_INSIGHTS: 'Key Insights',
    ANALYZE_PAPER: 'Analyze Paper',
    REFLECTIONS: 'Reflections',
    TABLE_OF_CONTENTS: 'Table of Contents'
  };

  constructor(app: App, plugin: OpenNotebookPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Register all transformation commands
   */
  public registerCommands(): void {
    // Transform selected text
    this.plugin.addCommand({
      id: 'transform-selection',
      name: 'Transform Selection',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformSelection(editor);
      }
    });

    // Transform entire note
    this.plugin.addCommand({
      id: 'transform-note',
      name: 'Transform Note',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformNote(editor);
      }
    });

    // Built-in transformation shortcuts
    this.plugin.addCommand({
      id: 'transform-summarize',
      name: 'Summarize Selection',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.SUMMARIZE, true);
      }
    });

    this.plugin.addCommand({
      id: 'transform-summarize-note',
      name: 'Summarize Note',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.SUMMARIZE, false);
      }
    });

    this.plugin.addCommand({
      id: 'transform-key-insights',
      name: 'Extract Key Insights (Selection)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.KEY_INSIGHTS, true);
      }
    });

    this.plugin.addCommand({
      id: 'transform-key-insights-note',
      name: 'Extract Key Insights (Note)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.KEY_INSIGHTS, false);
      }
    });

    this.plugin.addCommand({
      id: 'transform-analyze-paper',
      name: 'Analyze Paper',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.ANALYZE_PAPER, false);
      }
    });
  }

  /**
   * Transform selected text using modal
   */
  private async transformSelection(editor: Editor): Promise<void> {
    const selection = editor.getSelection();

    if (!selection || selection.trim().length === 0) {
      NoticeHelper.warn('Please select some text to transform');
      return;
    }

    logger.info(`Transforming selection: ${selection.length} characters`);

    new TransformModal(
      this.app,
      this.plugin,
      selection,
      (result: string) => {
        // Replace the selected text with the transformed result
        editor.replaceSelection(result);
        logger.info('Replaced selection with transformed text');
      }
    ).open();
  }

  /**
   * Transform entire note content using modal
   */
  private async transformNote(editor: Editor): Promise<void> {
    const content = editor.getValue();

    if (!content || content.trim().length === 0) {
      NoticeHelper.warn('Note is empty');
      return;
    }

    logger.info(`Transforming entire note: ${content.length} characters`);

    new TransformModal(
      this.app,
      this.plugin,
      content,
      (result: string) => {
        // Replace entire note content with transformed result
        editor.setValue(result);
        logger.info('Replaced note content with transformed text');
      }
    ).open();
  }

  /**
   * Transform using a built-in transformation (without showing modal)
   */
  private async transformWithBuiltin(
    editor: Editor,
    transformationId: string,
    useSelection: boolean
  ): Promise<void> {
    let text: string;

    if (useSelection) {
      text = editor.getSelection();
      if (!text || text.trim().length === 0) {
        NoticeHelper.warn('Please select some text to transform');
        return;
      }
    } else {
      text = editor.getValue();
      if (!text || text.trim().length === 0) {
        NoticeHelper.warn('Note is empty');
        return;
      }
    }

    // Open modal immediately with loading state
    const resultModal = new TransformResultModal(this.app, this.plugin);
    resultModal.open();

    try {
      const client = this.plugin.getAPIClient();

      // First, get all transformations to find the one we want
      const transformations = await client.getTransformations();
      const transformation = transformations.find(t =>
        t.id === transformationId || t.name.toLowerCase() === transformationId.toLowerCase().replace('_', ' ')
      );

      if (!transformation) {
        resultModal.setError(`Transformation "${transformationId}" not found. Please check your Open Notebook configuration.`);
        logger.warn(`Built-in transformation not found: ${transformationId}`);
        return;
      }

      logger.info(`Executing transformation: ${transformation.name} on ${text.length} characters`);

      // Use model override from settings if configured
      const modelOverride = this.plugin.settings.defaultTransformationModel;

      const response = await client.executeTransformation(
        transformation.id,
        text,
        modelOverride
      );

      logger.info('Transformation complete:', transformation.id);

      // Update modal with results
      resultModal.setResult({
        transformation,
        originalText: text,
        transformedText: response.output,
        context: {
          type: useSelection ? 'selection' : 'note',
          onAccept: (result: string) => {
            if (useSelection) {
              editor.replaceSelection(result);
            } else {
              editor.setValue(result);
            }
          },
          onRetry: () => {
            // Retry the same transformation
            this.transformWithBuiltin(editor, transformationId, useSelection);
          }
        }
      });

    } catch (error) {
      logger.error('Failed to execute transformation', error);
      resultModal.setError(error.message || 'Unknown error occurred during transformation');
    }
  }

  /**
   * Show context menu for selected text
   */
  public setupContextMenu(): void {
    this.plugin.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, view) => {
        const selection = editor.getSelection();

        if (selection && selection.trim().length > 0) {
          menu.addSeparator();

          menu.addItem((item) => {
            item
              .setTitle('Transform Selection')
              .setIcon('wand-glyph')
              .onClick(() => {
                this.transformSelection(editor);
              });
          });

          // Add built-in shortcuts to context menu
          menu.addItem((item) => {
            item
              .setTitle('Summarize')
              .setIcon('list-collapse')
              .onClick(() => {
                this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.SUMMARIZE, true);
              });
          });

          menu.addItem((item) => {
            item
              .setTitle('Key Insights')
              .setIcon('lightbulb')
              .onClick(() => {
                this.transformWithBuiltin(editor, this.BUILTIN_TRANSFORMATIONS.KEY_INSIGHTS, true);
              });
          });
        }
      })
    );

    logger.info('Context menu for transformations registered');
  }
}
