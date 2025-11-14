// Notebook-related commands
import { App, TFolder, TAbstractFile, Notice } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { NotebookManager } from '../services/NotebookManager';
import { NotebookModal } from '../modals/NotebookModal';
import { LinkNotebookModal } from '../modals/LinkNotebookModal';
import { NoticeHelper } from '../utils/NoticeHelper';
import { logger } from '../utils/Logger';

export class NotebookCommands {
  private app: App;
  private plugin: OpenNotebookPlugin;
  private notebookManager: NotebookManager;

  constructor(app: App, plugin: OpenNotebookPlugin, notebookManager: NotebookManager) {
    this.app = app;
    this.plugin = plugin;
    this.notebookManager = notebookManager;
  }

  /**
   * Register all notebook commands
   */
  public registerCommands(): void {
    // List all notebooks
    this.plugin.addCommand({
      id: 'list-notebooks',
      name: 'List All Notebooks',
      callback: async () => {
        await this.listNotebooks();
      }
    });

    // Create notebook from current folder
    this.plugin.addCommand({
      id: 'create-notebook-from-folder',
      name: 'Create Notebook from Folder',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.parent) {
          await this.createNotebookFromFolder(file.parent);
        } else {
          NoticeHelper.warn('No active file. Open a file in the folder you want to link.');
        }
      }
    });

    // Link folder to existing notebook
    this.plugin.addCommand({
      id: 'link-folder-to-notebook',
      name: 'Link Folder to Notebook',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.parent) {
          await this.linkFolderToNotebook(file.parent);
        } else {
          NoticeHelper.warn('No active file. Open a file in the folder you want to link.');
        }
      }
    });

    // Unlink folder from notebook
    this.plugin.addCommand({
      id: 'unlink-folder',
      name: 'Unlink Folder from Notebook',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.parent) {
          const notebookId = this.notebookManager.getNotebookForFolder(file.parent.path);
          if (notebookId) {
            await this.unlinkFolder(file.parent);
          } else {
            NoticeHelper.warn('Current folder is not linked to any notebook.');
          }
        } else {
          NoticeHelper.warn('No active file. Open a file in the folder you want to unlink.');
        }
      }
    });

    // Refresh notebook cache
    this.plugin.addCommand({
      id: 'refresh-notebooks',
      name: 'Refresh Notebook List',
      callback: async () => {
        await this.refreshNotebooks();
      }
    });

    // Show folder mappings
    this.plugin.addCommand({
      id: 'show-mappings',
      name: 'Show Folder Mappings',
      callback: () => {
        this.showMappings();
      }
    });
  }

  /**
   * List all notebooks
   */
  public async listNotebooks(): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Loading notebooks...');

    try {
      const notebooks = await this.notebookManager.getNotebooks(true);

      NoticeHelper.hideNotice(loadingNotice);

      if (notebooks.length === 0) {
        NoticeHelper.info('No notebooks found');
        return;
      }

      // Create a modal or notice with the list
      const mapped = notebooks.filter(nb => nb.localPath);
      const unmapped = notebooks.filter(nb => !nb.localPath);

      let message = `📚 Total Notebooks: ${notebooks.length}\n\n`;

      if (mapped.length > 0) {
        message += `✓ Mapped (${mapped.length}):\n`;
        mapped.forEach(nb => {
          message += `  • ${nb.name} → ${nb.localPath}\n`;
        });
        message += '\n';
      }

      if (unmapped.length > 0) {
        message += `○ Unmapped (${unmapped.length}):\n`;
        unmapped.forEach(nb => {
          message += `  • ${nb.name} (${nb.sourceCount} sources, ${nb.noteCount} notes)\n`;
        });
      }

      // Show in console and notice
      console.log(message);
      NoticeHelper.info(`Found ${notebooks.length} notebook(s). Check console for details.`);

    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.error(`Failed to load notebooks: ${error.message}`);
      logger.error('Failed to list notebooks', error);
    }
  }

  /**
   * Create a new notebook from a folder
   */
  public async createNotebookFromFolder(folder: TFolder): Promise<void> {
    const folderName = folder.name || folder.path.split('/').pop() || 'Unnamed';

    new NotebookModal(
      this.app,
      async (data) => {
        const loadingNotice = NoticeHelper.loading('Creating notebook...');

        try {
          const notebook = await this.notebookManager.createNotebookFromFolder(folder);

          NoticeHelper.hideNotice(loadingNotice);
          NoticeHelper.success(`Created notebook "${notebook.name}" linked to ${folder.path}`);

          // Save settings
          await this.plugin.saveSettings();

        } catch (error) {
          NoticeHelper.hideNotice(loadingNotice);
          NoticeHelper.error(`Failed to create notebook: ${error.message}`);
          logger.error('Failed to create notebook from folder', error);
        }
      },
      folderName
    ).open();
  }

  /**
   * Link a folder to an existing notebook
   */
  public async linkFolderToNotebook(folder: TFolder): Promise<void> {
    // Check if folder is already mapped
    const existingId = this.notebookManager.getNotebookForFolder(folder.path);
    if (existingId) {
      NoticeHelper.warn(`Folder is already linked to a notebook. Unlink first if you want to change.`);
      return;
    }

    const loadingNotice = NoticeHelper.loading('Loading notebooks...');

    try {
      const notebooks = await this.notebookManager.getNotebooks();

      NoticeHelper.hideNotice(loadingNotice);

      if (notebooks.length === 0) {
        NoticeHelper.info('No notebooks found. Create one first.');
        return;
      }

      new LinkNotebookModal(
        this.app,
        folder.path,
        notebooks,
        async (notebookId) => {
          const linkingNotice = NoticeHelper.loading('Linking folder...');

          try {
            await this.notebookManager.mapFolderToNotebook(folder.path, notebookId);
            await this.plugin.saveSettings();

            NoticeHelper.hideNotice(linkingNotice);

            const notebook = await this.notebookManager.getNotebook(notebookId);
            NoticeHelper.success(`Linked ${folder.path} to "${notebook?.name || notebookId}"`);

          } catch (error) {
            NoticeHelper.hideNotice(linkingNotice);
            NoticeHelper.error(`Failed to link folder: ${error.message}`);
            logger.error('Failed to link folder', error);
          }
        }
      ).open();

    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.error(`Failed to load notebooks: ${error.message}`);
      logger.error('Failed to load notebooks', error);
    }
  }

  /**
   * Unlink a folder from its notebook
   */
  public async unlinkFolder(folder: TFolder): Promise<void> {
    const notebookId = this.notebookManager.getNotebookForFolder(folder.path);
    if (!notebookId) {
      NoticeHelper.warn('Folder is not linked to any notebook');
      return;
    }

    try {
      const notebook = await this.notebookManager.getNotebook(notebookId);
      const notebookName = notebook?.name || notebookId;

      await this.notebookManager.unmapFolder(folder.path);
      await this.plugin.saveSettings();

      NoticeHelper.success(`Unlinked ${folder.path} from "${notebookName}"`);

    } catch (error) {
      NoticeHelper.error(`Failed to unlink folder: ${error.message}`);
      logger.error('Failed to unlink folder', error);
    }
  }

  /**
   * Refresh notebook cache
   */
  public async refreshNotebooks(): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Refreshing notebooks...');

    try {
      this.notebookManager.clearCache();
      const notebooks = await this.notebookManager.getNotebooks(true);

      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.success(`Refreshed ${notebooks.length} notebook(s)`);

    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.error(`Failed to refresh notebooks: ${error.message}`);
      logger.error('Failed to refresh notebooks', error);
    }
  }

  /**
   * Show all folder mappings
   */
  public showMappings(): void {
    const mappings = this.notebookManager.getAllMappings();
    const count = Object.keys(mappings).length;

    if (count === 0) {
      NoticeHelper.info('No folder mappings configured');
      return;
    }

    let message = `📁 Folder Mappings (${count}):\n\n`;
    for (const [folder, notebookId] of Object.entries(mappings)) {
      message += `  ${folder} → ${notebookId}\n`;
    }

    console.log(message);
    NoticeHelper.info(`${count} folder mapping(s). Check console for details.`);
  }
}
