import { Plugin, TFile, TFolder, Menu, TAbstractFile, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, OpenNotebookSettings } from './types/settings';
import { OpenNotebookSettingsTab } from './settings/SettingsTab';
import { OpenNotebookClient } from './api/client';
import { NotebookManager } from './services/NotebookManager';
import { NotebookCommands } from './commands/NotebookCommands';
import { TransformCommands } from './commands/TransformCommands';
import { ContentSyncManager } from './managers/ContentSyncManager';
import { SyncIndicatorManager } from './managers/SyncIndicatorManager';
import { OfflineQueue } from './services/OfflineQueue';
import { FeatureDetector } from './services/FeatureDetector';
import { ChatView, VIEW_TYPE_CHAT } from './views/ChatView';
import { SearchModal } from './modals/SearchModal';
import { InsightsModal } from './modals/InsightsModal';
import { logger } from './utils/Logger';
import { NoticeHelper } from './utils/NoticeHelper';
import { SyncOperation } from './types/sync';

export default class OpenNotebookPlugin extends Plugin {
  settings: OpenNotebookSettings;
  private statusBarItem: HTMLElement;
  private apiClient: OpenNotebookClient;
  private notebookManager: NotebookManager;
  private notebookCommands: NotebookCommands;
  private transformCommands: TransformCommands;
  private contentSyncManager: ContentSyncManager;
  private syncIndicatorManager: SyncIndicatorManager;
  private offlineQueue: OfflineQueue;
  private featureDetector: FeatureDetector;

  async onload() {
    logger.info('Loading Open Notebook plugin');

    // Load settings
    await this.loadSettings();

    // Configure logger
    logger.setDebugEnabled(this.settings.enableDebugLogging);

    // Initialize API client
    this.apiClient = new OpenNotebookClient(
      this.settings.apiEndpoint,
      this.settings.apiPassword,
      this.settings.requestTimeout,
      this.settings.retryAttempts
    );

    // Initialize feature detector
    this.featureDetector = new FeatureDetector(this.apiClient);

    // Load cached features if available
    if (this.settings.detectedFeatures) {
      this.featureDetector.loadFeatures(this.settings.detectedFeatures);
    }

    // Initialize services
    this.notebookManager = new NotebookManager(this.apiClient, this.settings);
    this.contentSyncManager = new ContentSyncManager(this);
    this.syncIndicatorManager = new SyncIndicatorManager(this);

    // Initialize offline queue
    this.offlineQueue = new OfflineQueue(
      this.apiClient,
      async (queue: SyncOperation[]) => {
        this.settings.offlineQueue = queue;
        await this.saveSettings();
      }
    );

    // Load persisted queue
    await this.offlineQueue.initialize(this.settings.offlineQueue || []);

    // Start auto-processing
    this.offlineQueue.startAutoProcess();

    // Initialize commands
    this.notebookCommands = new NotebookCommands(this.app, this, this.notebookManager);
    this.notebookCommands.registerCommands();

    this.transformCommands = new TransformCommands(this.app, this);
    this.transformCommands.registerCommands();
    this.transformCommands.setupContextMenu();

    // Register file event handlers for auto-sync
    this.registerFileEventHandlers();

    // Register active file change handler for chat context updates
    this.registerActiveFileChangeHandler();

    // Register Chat View
    this.registerView(
      VIEW_TYPE_CHAT,
      (leaf) => new ChatView(leaf, this)
    );

    // Add ribbon icon for chat
    this.addRibbonIcon('message-circle', 'Toggle Open Notebook Chat', () => {
      this.toggleChatView();
    });

    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();

    // Add settings tab
    this.addSettingTab(new OpenNotebookSettingsTab(this.app, this));

    // Register basic commands
    this.registerCommands();

    // Register context menu immediately
    this.registerContextMenu();

    // Initialize on startup if configured
    if (this.settings.syncOnStartup) {
      // Run verification asynchronously (don't block plugin loading)
      this.verifySyncStateOnStartup();
    } else {
      // If not running verification, mark initialization as complete immediately
      this.contentSyncManager.setInitializationComplete();
    }

    logger.info('Open Notebook plugin loaded');
  }

  /**
   * Verify sync state on startup (async, non-blocking)
   */
  private async verifySyncStateOnStartup(): Promise<void> {
    try {
      logger.info('Running startup sync verification...');
      const results = await this.contentSyncManager.verifySyncState();

      if (results.resynced > 0 || results.removed > 0) {
        NoticeHelper.info(
          `Sync verification: ${results.resynced} resynced, ${results.removed} cleaned up`
        );
      }

      if (results.failed > 0) {
        NoticeHelper.warn(`Sync verification: ${results.failed} files failed`);
      }
    } catch (error) {
      logger.error('Startup sync verification failed', error);
      NoticeHelper.error('Failed to verify sync state on startup');
    } finally {
      // Always mark initialization as complete, even if verification failed
      this.contentSyncManager.setInitializationComplete();
    }
  }

  async onunload() {
    // Clean up offline queue
    if (this.offlineQueue) {
      await this.offlineQueue.cleanup();
    }

    // Clean up chat views
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
    logger.info('Unloading Open Notebook plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    logger.setDebugEnabled(this.settings.enableDebugLogging);
    this.updateStatusBar();

    // Update API client if settings changed
    if (this.apiClient) {
      this.apiClient.setEndpoint(this.settings.apiEndpoint);
      this.apiClient.setPassword(this.settings.apiPassword);
      this.apiClient.setTimeout(this.settings.requestTimeout);
      this.apiClient.setRetryAttempts(this.settings.retryAttempts);
    }
  }

  private registerCommands(): void {
    // Test connection command
    this.addCommand({
      id: 'test-connection',
      name: 'Test API Connection',
      callback: async () => {
        try {
          NoticeHelper.info('Testing connection...');

          const isConnected = await this.apiClient.testConnection();

          if (isConnected) {
            // Get API version
            const version = await this.apiClient.getApiVersion();
            this.settings.apiVersion = version;

            // Detect available features
            NoticeHelper.info('Detecting API features...');
            const features = await this.featureDetector.detectFeatures();
            this.settings.detectedFeatures = features;
            await this.saveSettings();

            const availableCount = this.featureDetector.getAvailableFeaturesList().length;

            this.setConnectionStatus('connected');
            NoticeHelper.success(`Connected to Open Notebook (v${version}) - ${availableCount} features available`);
          } else {
            this.setConnectionStatus('error');
            NoticeHelper.error('Connection test failed');
          }
        } catch (error) {
          logger.error('Connection test failed', error);
          this.setConnectionStatus('error');
          NoticeHelper.error(`Connection failed: ${error.message}`);
        }
      }
    });

    // Open chat command
    this.addCommand({
      id: 'open-chat',
      name: 'Open Chat',
      callback: async () => {
        await this.activateChatView();
      }
    });

    // Sync current file command
    this.addCommand({
      id: 'sync-current-file',
      name: 'Sync Current File to Open Notebook',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md' && file.parent) {
          const notebookId = this.notebookManager.getNotebookForFolder(file.parent.path);
          if (notebookId) {
            if (!checking) {
              this.syncCurrentFile();
            }
            return true;
          }
        }
        return false;
      }
    });

    // Sync folder command
    this.addCommand({
      id: 'sync-folder',
      name: 'Sync Folder to Open Notebook',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.parent) {
          await this.syncFolder(file.parent);
        } else {
          NoticeHelper.warn('Please open a file in a folder to sync that folder');
        }
      }
    });

    // Open settings command
    this.addCommand({
      id: 'open-settings',
      name: 'Open Settings',
      callback: () => {
        // @ts-ignore - app.setting is available but not in types
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById(this.manifest.id);
      }
    });

    // Refresh sync indicators command
    this.addCommand({
      id: 'refresh-sync-indicators',
      name: 'Refresh Sync Indicators',
      callback: () => {
        logger.info('Manually refreshing sync indicators');
        this.syncIndicatorManager?.refreshAll();
        NoticeHelper.info('Sync indicators refreshed');
      }
    });

    // Verify sync state command
    this.addCommand({
      id: 'verify-sync-state',
      name: 'Verify Sync State (Reconcile with Open Notebook)',
      callback: async () => {
        try {
          NoticeHelper.info('Verifying sync state...');
          const results = await this.contentSyncManager.verifySyncState();

          const message = [
            `Verified: ${results.verified}`,
            results.resynced > 0 ? `Resynced: ${results.resynced}` : null,
            results.removed > 0 ? `Cleaned up: ${results.removed}` : null,
            results.failed > 0 ? `Failed: ${results.failed}` : null
          ].filter(Boolean).join(', ');

          NoticeHelper.success(`Sync verification complete. ${message}`);
        } catch (error) {
          logger.error('Sync verification failed', error);
          NoticeHelper.error(`Failed to verify sync state: ${error.message || 'Unknown error'}`);
        }
      }
    });

    // Check for conflicts command
    this.addCommand({
      id: 'check-conflicts',
      name: 'Check for Sync Conflicts',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') {
          return false;
        }

        if (!checking) {
          this.checkFileConflicts(file);
        }
        return true;
      }
    });

    // Browse podcasts command
    this.addCommand({
      id: 'browse-podcasts',
      name: 'Browse Podcasts',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !file.parent) {
          return false;
        }

        const notebookId = this.notebookManager.getNotebookForFolder(file.parent.path);
        if (!notebookId) {
          return false;
        }

        if (!checking) {
          this.openPodcastModal(notebookId, file.parent.name);
        }
        return true;
      }
    });

    // Search command
    this.addCommand({
      id: 'search-open-notebook',
      name: 'Search Open Notebook',
      callback: () => {
        new SearchModal(this.app, this).open();
      }
    });

    // Browse insights command
    this.addCommand({
      id: 'browse-insights',
      name: 'Browse AI Insights',
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
          return false;
        }

        // Check if file is synced
        const syncStatus = this.contentSyncManager.getSyncStatus(activeFile.path);
        if (!syncStatus || !syncStatus.sourceId) {
          return false;
        }

        if (!checking) {
          const sourceId = syncStatus.sourceId;
          const sourceTitle = activeFile.basename;
          new InsightsModal(this.app, this, sourceId, sourceTitle).open();
        }

        return true;
      }
    });

    // Ask question command
    this.addCommand({
      id: 'ask-open-notebook',
      name: 'Ask Open Notebook',
      callback: async () => {
        const query = await this.promptForQuery();
        if (!query) return;

        const loadingNotice = NoticeHelper.loading('Asking Open Notebook...');

        try {
          const answer = await this.apiClient.ask(query);

          NoticeHelper.hideNotice(loadingNotice);

          // Insert answer into current file
          const editor = this.app.workspace.activeEditor?.editor;
          if (editor) {
            editor.replaceSelection(`\n\n**Q:** ${query}\n\n**A:** ${answer}\n\n`);
            NoticeHelper.success('Answer inserted');
          } else {
            // Create new note with answer
            const fileName = `Answer - ${query.substring(0, 50)}.md`;
            const content = `# ${query}\n\n${answer}\n`;
            await this.app.vault.create(fileName, content);
            NoticeHelper.success('Answer saved to new note');
          }
        } catch (error) {
          NoticeHelper.hideNotice(loadingNotice);
          logger.error('Ask failed', error);
          NoticeHelper.error(`Failed to get answer: ${error.message || 'Unknown error'}`);
        }
      }
    });

    // Retry offline queue command
    this.addCommand({
      id: 'retry-offline-queue',
      name: 'Retry Offline Operations',
      callback: async () => {
        const queueSize = this.offlineQueue.getQueueSize();
        if (queueSize === 0) {
          NoticeHelper.info('No operations in queue');
          return;
        }

        NoticeHelper.info(`Retrying ${queueSize} queued operations...`);
        await this.offlineQueue.processQueue();

        const remaining = this.offlineQueue.getQueueSize();
        if (remaining === 0) {
          NoticeHelper.success('All operations completed');
        } else {
          NoticeHelper.warn(`${remaining} operations still in queue`);
        }
      }
    });

    // Clear offline queue command
    this.addCommand({
      id: 'clear-offline-queue',
      name: 'Clear Offline Queue',
      callback: async () => {
        const queueSize = this.offlineQueue.getQueueSize();
        if (queueSize === 0) {
          NoticeHelper.info('Queue is already empty');
          return;
        }

        await this.offlineQueue.clearQueue();
        NoticeHelper.success(`Cleared ${queueSize} operations from queue`);
      }
    });

    // Full sync command
    this.addCommand({
      id: 'full-sync',
      name: 'Full Sync (All Mapped Folders)',
      callback: async () => {
        try {
          NoticeHelper.info('Starting full sync of all mapped folders...');

          const mappings = this.settings.folderToNotebook;
          const folderPaths = Object.keys(mappings);

          if (folderPaths.length === 0) {
            NoticeHelper.warn('No folders are mapped to notebooks');
            return;
          }

          let totalSynced = 0;
          let totalFailed = 0;

          for (const folderPath of folderPaths) {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (folder instanceof TFolder) {
              const results = await this.contentSyncManager.syncFolder(folder, mappings[folderPath]);
              totalSynced += results.synced;
              totalFailed += results.failed;
            }
          }

          // Update last sync timestamp if any files were synced
          if (totalSynced > 0) {
            this.settings.lastSyncTimestamp = Date.now();
            await this.saveSettings();
          }

          if (totalFailed === 0) {
            NoticeHelper.success(`Full sync complete: ${totalSynced} files synced`);
          } else {
            NoticeHelper.warn(`Full sync complete: ${totalSynced} synced, ${totalFailed} failed`);
          }
        } catch (error) {
          logger.error('Full sync failed', error);
          NoticeHelper.error(`Full sync failed: ${error.message || 'Unknown error'}`);
        }
      }
    });

    // New chat session command
    this.addCommand({
      id: 'new-chat-session',
      name: 'New Chat Session',
      callback: async () => {
        await this.activateChatView();

        // Get the chat view and create new session if we have a notebook context
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);
        if (leaves.length > 0) {
          const chatView = leaves[0].view;
          if (chatView instanceof ChatView) {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && activeFile.parent) {
              const notebookId = this.notebookManager.getNotebookForFolder(activeFile.parent.path);
              if (notebookId) {
                // Refresh to create new session
                await chatView.setNotebook(notebookId);
                NoticeHelper.success('New chat session created');
              } else {
                NoticeHelper.warn('No notebook linked to current folder');
              }
            } else {
              NoticeHelper.warn('No active file with notebook context');
            }
          }
        }
      }
    });

    // Transform selection command
    this.addCommand({
      id: 'transform-selection',
      name: 'Transform Selection',
      editorCheckCallback: (checking: boolean, editor, view) => {
        const selection = editor.getSelection();
        if (!selection || selection.trim().length === 0) {
          return false;
        }

        if (!checking) {
          this.transformSelection(editor);
        }
        return true;
      }
    });

    // List notebooks command
    this.addCommand({
      id: 'list-notebooks',
      name: 'List Notebooks',
      callback: async () => {
        try {
          const client = this.getAPIClient();
          const notebooks = await client.getNotebooks(false);

          if (notebooks.length === 0) {
            NoticeHelper.info('No notebooks found');
            return;
          }

          const message = notebooks.map((nb, i) => {
            const folder = this.notebookManager.getFolderForNotebook(nb.id);
            const folderInfo = folder ? ` → ${folder}` : ' (not mapped)';
            return `${i + 1}. ${nb.name}${folderInfo}`;
          }).join('\n');

          // Show in modal
          const modal = new (class extends Plugin {
            onload() {}
          })(this.app, this.manifest);

          const div = document.body.createDiv({ cls: 'modal-container mod-dim' });
          div.addEventListener('click', (e) => {
            if (e.target === div) {
              div.remove();
            }
          });

          const modalDiv = div.createDiv({ cls: 'modal' });
          modalDiv.createEl('h3', { text: 'Open Notebook - Notebooks' });

          const contentDiv = modalDiv.createDiv({ cls: 'on-notebooks-list-content' });
          contentDiv.setText(message);

          const buttonDiv = modalDiv.createDiv({ cls: 'modal-button-container' });
          const closeBtn = buttonDiv.createEl('button', {
            text: 'Close',
            cls: 'mod-cta'
          });
          closeBtn.addEventListener('click', () => div.remove());

          // Add global escape key handler
          const escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              div.remove();
              document.removeEventListener('keydown', escapeHandler);
            }
          };
          document.addEventListener('keydown', escapeHandler);
        } catch (error) {
          logger.error('Failed to list notebooks', error);
          NoticeHelper.error(`Failed to list notebooks: ${error.message || 'Unknown error'}`);
        }
      }
    });

    // Create notebook from folder command
    this.addCommand({
      id: 'create-notebook-from-folder',
      name: 'Create Notebook from Folder',
      callback: async () => {
        // Let user pick a folder
        const folders = this.getAllFolders();

        if (folders.length === 0) {
          NoticeHelper.warn('No folders found in vault');
          return;
        }

        // Show folder selection modal
        const folderPath = await this.promptForFolder(folders);
        if (!folderPath) return;

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder instanceof TFolder) {
          await this.notebookCommands.createNotebookFromFolder(folder);
        }
      }
    });

    // Link folder to notebook command
    this.addCommand({
      id: 'link-folder-to-notebook',
      name: 'Link Folder to Notebook',
      callback: async () => {
        // Let user pick a folder
        const folders = this.getAllFolders();

        if (folders.length === 0) {
          NoticeHelper.warn('No folders found in vault');
          return;
        }

        // Show folder selection modal
        const folderPath = await this.promptForFolder(folders);
        if (!folderPath) return;

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder instanceof TFolder) {
          await this.notebookCommands.linkFolderToNotebook(folder);
        }
      }
    });

    // Unlink folder from notebook command
    this.addCommand({
      id: 'unlink-folder-from-notebook',
      name: 'Unlink Folder from Notebook',
      callback: async () => {
        // Get all mapped folders
        const mappings = this.settings.folderToNotebook;
        const folderPaths = Object.keys(mappings);

        if (folderPaths.length === 0) {
          NoticeHelper.warn('No folders are currently linked to notebooks');
          return;
        }

        // Show folder selection modal
        const folderPath = await this.promptForFolder(folderPaths);
        if (!folderPath) return;

        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder instanceof TFolder) {
          await this.notebookCommands.unlinkFolder(folder);
        }
      }
    });
  }

  /**
   * Prompt user for a query string
   */
  private async promptForQuery(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends Plugin {
        onload() {}
      })(this.app, this.manifest);

      // Create a simple prompt modal
      const div = document.body.createDiv({ cls: 'modal-container mod-dim' });
      div.addEventListener('click', (e) => {
        if (e.target === div) {
          div.remove();
          resolve(null);
        }
      });

      const modalDiv = div.createDiv({ cls: 'modal' });
      modalDiv.createEl('h3', { text: 'Ask Open Notebook' });

      const input = modalDiv.createEl('input', {
        type: 'text',
        placeholder: 'Enter your question...',
        cls: 'on-prompt-input'
      });

      const buttons = modalDiv.createDiv({ cls: 'modal-button-container' });

      const submitBtn = buttons.createEl('button', {
        text: 'Ask',
        cls: 'mod-cta'
      });

      const cancelBtn = buttons.createEl('button', {
        text: 'Cancel'
      });

      submitBtn.addEventListener('click', () => {
        div.remove();
        resolve(input.value.trim() || null);
      });

      cancelBtn.addEventListener('click', () => {
        div.remove();
        resolve(null);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          div.remove();
          resolve(input.value.trim() || null);
        } else if (e.key === 'Escape') {
          div.remove();
          resolve(null);
        }
      });

      // Add global escape key handler
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          div.remove();
          resolve(null);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      input.focus();
    });
  }

  /**
   * Register file event handlers for auto-sync
   */
  private registerFileEventHandlers(): void {
    // File created
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.contentSyncManager.onFileCreated(file);
        }
      })
    );

    // File modified
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.contentSyncManager.onFileModified(file);
        }
      })
    );

    // File deleted
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.contentSyncManager.onFileDeleted(file);
        }
      })
    );

    // File renamed
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.contentSyncManager.onFileRenamed(file, oldPath);
        }
      })
    );

    logger.info('File event handlers registered');
  }

  /**
   * Register active file change handler to update chat context
   */
  private registerActiveFileChangeHandler(): void {
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async (leaf) => {
        // Only update if chat view is open
        const chatLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);
        if (chatLeaves.length === 0) {
          return;
        }

        const chatLeaf = chatLeaves[0];
        const chatView = chatLeaf.view;
        if (!(chatView instanceof ChatView)) {
          return;
        }

        // Get the active file
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || !activeFile.parent) {
          // No file or file has no parent - show not linked
          chatView.showNotLinked();
          return;
        }

        // Get notebook for the file's folder
        const notebookId = this.notebookManager.getNotebookForFolder(activeFile.parent.path);
        if (!notebookId) {
          // File's folder is not linked - show not linked state
          chatView.showNotLinked();
          return;
        }

        // Update chat context with the notebook
        await chatView.setNotebook(notebookId);
      })
    );

    logger.info('Active file change handler registered');
  }

  /**
   * Sync current file to Open Notebook
   */
  private async syncCurrentFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      NoticeHelper.warn('No active file. Open a markdown file to sync.');
      return;
    }

    if (file.extension !== 'md') {
      NoticeHelper.warn('Can only sync markdown files');
      return;
    }

    if (!file.parent) {
      NoticeHelper.warn('File has no parent folder');
      return;
    }

    const notebookId = this.notebookManager.getNotebookForFolder(file.parent.path);
    if (!notebookId) {
      NoticeHelper.warn(`Folder "${file.parent.path}" is not linked to any notebook. Right-click the folder to link it.`);
      return;
    }

    const loadingNotice = NoticeHelper.loading(`Syncing ${file.basename}...`);

    try {
      await this.contentSyncManager.syncFile(file, notebookId);

      // Update last sync timestamp
      this.settings.lastSyncTimestamp = Date.now();
      await this.saveSettings();

      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.success(`Synced: ${file.basename}`);
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      logger.error('Failed to sync file', error);
      NoticeHelper.error(`Failed to sync ${file.basename}: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate insight for a file
   */
  private async generateInsightForFile(file: TFile, sourceId: string): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Generating insight...');

    try {
      const client = this.getAPIClient();

      // Get available transformations
      const transformations = await client.getTransformations();

      if (!transformations || transformations.length === 0) {
        NoticeHelper.hideNotice(loadingNotice);
        NoticeHelper.warn('No transformations available. Please create a transformation first.');
        return;
      }

      // Use the first transformation (could be made configurable in settings)
      const transformationId = transformations[0].id;
      logger.info(`Generating insight with transformation: ${transformationId}`);

      // Generate insight
      const insight = await client.generateInsight(sourceId, transformationId);

      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.success(`Insight generated: ${insight.title || 'Untitled'}`);

      logger.info('Generated insight:', insight.id);
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      logger.error('Failed to generate insight', error);
      NoticeHelper.error(`Failed to generate insight: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Open podcast modal for a notebook
   */
  private openPodcastModal(notebookId: string, notebookName: string): void {
    const { PodcastModal } = require('./modals/PodcastModal');
    new PodcastModal(this.app, this, notebookId, notebookName).open();
  }

  /**
   * Check for conflicts on a file
   */
  private async checkFileConflicts(file: TFile): Promise<void> {
    try {
      // Get sync metadata
      const metadata = await this.contentSyncManager.getSyncMetadata(file);
      const sourceId = metadata.on_source_id;

      if (!sourceId) {
        NoticeHelper.info('File is not synced to Open Notebook');
        return;
      }

      NoticeHelper.info('Checking for conflicts...');

      // Check for conflicts
      const conflict = await this.contentSyncManager.checkForConflict(file, sourceId);

      if (conflict) {
        // Show conflict modal
        const { ConflictModal } = await import('./modals/ConflictModal');
        new ConflictModal(this.app, conflict, async (choice) => {
          if (choice === 'local') {
            await this.contentSyncManager.resolveConflict(conflict, true);
          } else if (choice === 'remote') {
            await this.contentSyncManager.resolveConflict(conflict, false);
          } else {
            NoticeHelper.info('Conflict resolution cancelled');
          }
        }).open();
      } else {
        NoticeHelper.success('No conflicts detected - file is in sync');
      }
    } catch (error) {
      logger.error('Failed to check for conflicts', error);
      NoticeHelper.error(`Failed to check for conflicts: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Sync folder to Open Notebook
   */
  private async syncFolder(folder: TFolder): Promise<void> {
    const notebookId = this.notebookManager.getNotebookForFolder(folder.path);
    if (!notebookId) {
      NoticeHelper.warn('Folder is not linked to any notebook. Right-click the folder to link it.');
      return;
    }

    const loadingNotice = NoticeHelper.loading(`Syncing folder: ${folder.name}...`);

    try {
      const results = await this.contentSyncManager.syncFolder(folder, notebookId);

      // Update last sync timestamp if any files were synced
      if (results.synced > 0) {
        this.settings.lastSyncTimestamp = Date.now();
        await this.saveSettings();
      }

      NoticeHelper.hideNotice(loadingNotice);

      if (results.synced === 0 && results.failed === 0) {
        NoticeHelper.info('All files are already up to date');
      } else if (results.failed === 0) {
        NoticeHelper.success(`Successfully synced ${results.synced} file${results.synced === 1 ? '' : 's'}`);
      } else if (results.synced === 0) {
        NoticeHelper.error(`Failed to sync ${results.failed} file${results.failed === 1 ? '' : 's'}`);
      } else {
        NoticeHelper.warn(`Synced ${results.synced}, failed ${results.failed}`);
      }
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      logger.error('Failed to sync folder', error);
      NoticeHelper.error(`Failed to sync folder: ${error.message || 'Unknown error'}`);
    }
  }

  private updateStatusBar(): void {
    const { connectionStatus, showSyncStatus, lastSyncTimestamp } = this.settings;

    if (!showSyncStatus) {
      this.statusBarItem.setText('');
      return;
    }

    // Create status indicator
    const statusClass = connectionStatus === 'connected' ? 'connected'
                      : connectionStatus === 'error' ? 'error'
                      : 'disconnected';

    this.statusBarItem.empty();
    const container = this.statusBarItem.createDiv({ cls: 'open-notebook-status-bar' });

    const indicator = container.createDiv({
      cls: `status-indicator ${statusClass}`
    });

    const text = container.createSpan({
      text: 'Open Notebook',
      cls: 'status-text'
    });

    // Add queue size if there are pending operations
    const queueSize = this.offlineQueue?.getQueueSize() || 0;
    if (queueSize > 0) {
      const queueIndicator = container.createSpan({
        text: ` (${queueSize})`,
        cls: 'status-queue-count'
      });
      queueIndicator.setAttribute('title', `${queueSize} operation${queueSize === 1 ? '' : 's'} in queue`);
    }

    // Add last sync time if available
    if (lastSyncTimestamp) {
      const now = Date.now();
      const diff = now - lastSyncTimestamp;
      const timeAgo = this.formatTimeAgo(diff);
      const syncTime = container.createSpan({
        text: ` • ${timeAgo}`,
        cls: 'status-sync-time'
      });
      syncTime.setAttribute('title', `Last synced: ${new Date(lastSyncTimestamp).toLocaleString()}`);
    }

    // Click handler to open settings
    this.statusBarItem.onclick = () => {
      // @ts-ignore
      this.app.setting.open();
      // @ts-ignore
      this.app.setting.openTabById(this.manifest.id);
    };

    // Tooltip
    const statusText = connectionStatus === 'connected' ? 'Connected'
                     : connectionStatus === 'error' ? 'Connection Error'
                     : 'Disconnected';
    let tooltip = `Open Notebook: ${statusText}`;
    if (queueSize > 0) {
      tooltip += `\n${queueSize} operation${queueSize === 1 ? '' : 's'} in queue`;
    }
    if (lastSyncTimestamp) {
      tooltip += `\nLast synced: ${new Date(lastSyncTimestamp).toLocaleString()}`;
    }
    this.statusBarItem.setAttribute('aria-label', tooltip);
  }

  /**
   * Format time difference as human-readable string
   */
  private formatTimeAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 10) {
      return `${seconds}s ago`;
    } else {
      return 'just now';
    }
  }

  public setConnectionStatus(status: 'connected' | 'disconnected' | 'error'): void {
    this.settings.connectionStatus = status;
    this.settings.lastConnectionCheck = Date.now();
    this.updateStatusBar();
    this.saveSettings();
  }

  /**
   * Register context menu for folders and files
   */
  private registerContextMenu(): void {
    logger.info('Registering context menu for folders and files');

    // Register for file-menu event (single file/folder right-click)
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile, source: string) => {
        if (file instanceof TFolder) {
          this.addFolderContextMenu(menu, file);
        } else if (file instanceof TFile && file.extension === 'md') {
          this.addFileContextMenu(menu, file);
        }
      })
    );

    // Register for files-menu event (multiple files/folders selected)
    this.registerEvent(
      this.app.workspace.on('files-menu', (menu: Menu, files: TAbstractFile[], source: string) => {
        // Only add menu if all selected items are folders
        if (files.length > 0 && files.every(f => f instanceof TFolder)) {
          if (files[0] instanceof TFolder) {
            this.addFolderContextMenu(menu, files[0]);
          }
        }
      })
    );

    // Register for editor-menu event (text selection right-click)
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: any, view: any) => {
        const selection = editor.getSelection();
        if (selection && selection.trim().length > 0) {
          this.addEditorContextMenu(menu, editor, selection);
        }
      })
    );

    logger.info('Context menu events registered successfully');
  }

  /**
   * Add context menu items for files
   */
  private addFileContextMenu(menu: Menu, file: TFile): void {
    const syncStatus = this.contentSyncManager.getSyncStatus(file.path);

    // Only show menu items if file is synced
    if (syncStatus && syncStatus.sourceId) {
      menu.addSeparator();

      menu.addItem((item) => {
        item
          .setTitle('Generate AI Insight')
          .setIcon('sparkles')
          .onClick(async () => {
            await this.generateInsightForFile(file, syncStatus.sourceId);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('Browse Insights')
          .setIcon('list')
          .onClick(() => {
            new InsightsModal(this.app, this, syncStatus.sourceId, file.basename).open();
          });
      });
    }

    // Add transformation options (available for all markdown files)
    menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle('Transform Note')
        .setIcon('wand-glyph')
        .onClick(async () => {
          await this.transformFile(file);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('Quick Summary')
        .setIcon('list-collapse')
        .onClick(async () => {
          await this.transformFile(file, 'Simple Summary');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('Quick Insights')
        .setIcon('lightbulb')
        .onClick(async () => {
          await this.transformFile(file, 'Key Insights');
        });
    });
  }

  /**
   * Transform a file's content
   */
  private async transformFile(file: TFile, transformationType?: string): Promise<void> {
    try {
      const content = await this.app.vault.read(file);

      if (!content || content.trim().length === 0) {
        NoticeHelper.warn('File is empty');
        return;
      }

      if (transformationType) {
        // Execute specific transformation directly
        // Import modal first
        const { TransformResultModal } = await import('./modals/TransformResultModal');

        // Open modal immediately with loading state
        const resultModal = new TransformResultModal(this.app, this);
        resultModal.open();

        try {
          const client = this.getAPIClient();
          const transformations = await client.getTransformations();
          const transformation = transformations.find(t =>
            t.id === transformationType || t.name.toLowerCase() === transformationType.toLowerCase().replace('_', ' ')
          );

          if (!transformation) {
            resultModal.setError(`Transformation "${transformationType}" not found`);
            return;
          }

          const response = await client.executeTransformation(
            transformation.id,
            content
          );

          // Update modal with results
          resultModal.setResult({
            transformation,
            originalText: content,
            transformedText: response.output,
            context: {
              type: 'file',
              file: file,
              onRetry: () => {
                // Retry the same transformation
                this.transformFile(file, transformationType);
              }
            }
          });

        } catch (error) {
          logger.error('Failed to execute transformation', error);
          resultModal.setError(error.message || 'Unknown error occurred during transformation');
        }
      } else {
        // Show modal to select transformation
        const { TransformModalWithResult } = await import('./modals/TransformModalWithResult');
        new TransformModalWithResult(this.app, this, file).open();
      }
    } catch (error) {
      logger.error('Failed to transform file', error);
      NoticeHelper.error(`Failed to transform file: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Add context menu items for folders
   */
  private addFolderContextMenu(menu: Menu, folder: TFolder): void {
    logger.debug(`Adding context menu for folder: ${folder.path}`);
    const notebookId = this.notebookManager.getNotebookForFolder(folder.path);

    // Add separator to group our items
    menu.addSeparator();

    if (notebookId) {
      // Folder is mapped - show sync and unlink options
      menu.addItem((item) => {
        item
          .setTitle('Sync Folder to Open Notebook')
          .setIcon('refresh-cw')
          .onClick(async () => {
            await this.syncFolder(folder);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('Browse Podcasts')
          .setIcon('mic')
          .onClick(() => {
            this.openPodcastModal(notebookId, folder.name);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('Unlink from Open Notebook')
          .setIcon('unlink')
          .onClick(async () => {
            await this.notebookCommands.unlinkFolder(folder);
          });
      });
    } else {
      // Folder is not mapped - show create and link options
      menu.addItem((item) => {
        item
          .setTitle('Create Open Notebook')
          .setIcon('plus-circle')
          .onClick(async () => {
            await this.notebookCommands.createNotebookFromFolder(folder);
          });
      });

      menu.addItem((item) => {
        item
          .setTitle('Link to Open Notebook')
          .setIcon('link')
          .onClick(async () => {
            await this.notebookCommands.linkFolderToNotebook(folder);
          });
      });
    }
  }

  /**
   * Add context menu items for editor (text selection)
   */
  private addEditorContextMenu(menu: Menu, editor: any, selection: string): void {
    logger.debug('Adding context menu for text selection');

    // Add separator to group our items
    menu.addSeparator();

    // Transform Selection
    menu.addItem((item) => {
      item
        .setTitle('Transform Selection')
        .setIcon('wand-glyph')
        .onClick(async () => {
          await this.transformSelection(editor);
        });
    });

    // Quick Summary
    menu.addItem((item) => {
      item
        .setTitle('Quick Summary')
        .setIcon('list-collapse')
        .onClick(async () => {
          await this.transformSelectionWith(editor, selection, 'Simple Summary');
        });
    });

    // Quick Insights
    menu.addItem((item) => {
      item
        .setTitle('Quick Insights')
        .setIcon('lightbulb')
        .onClick(async () => {
          await this.transformSelectionWith(editor, selection, 'Key Insights');
        });
    });
  }

  /**
   * Transform selection with a specific transformation type
   */
  private async transformSelectionWith(editor: any, selection: string, transformationType: string): Promise<void> {
    try {
      const client = this.getAPIClient();
      const transformations = await client.getTransformations();

      const transformation = transformations.find(t =>
        t.id === transformationType || t.name.toLowerCase() === transformationType.toLowerCase().replace('_', ' ')
      );

      if (!transformation) {
        NoticeHelper.warn(`Transformation "${transformationType}" not found`);
        return;
      }

      // Import and open result modal
      const { TransformResultModal } = await import('./modals/TransformResultModal');
      const resultModal = new TransformResultModal(this.app, this);
      resultModal.open();

      try {
        // Execute transformation
        const response = await client.executeTransformation(transformation.id, selection);

        // Update modal with results
        resultModal.setResult({
          transformation,
          originalText: selection,
          transformedText: response.output,
          context: {
            type: 'selection',
            onAccept: (text: string) => {
              editor.replaceSelection(text);
            },
            onRetry: () => {
              this.transformSelectionWith(editor, selection, transformationType);
            }
          }
        });
      } catch (error) {
        logger.error('Failed to execute transformation', error);
        resultModal.setError(error.message || 'Unknown error occurred during transformation');
      }
    } catch (error) {
      logger.error('Failed to transform selection', error);
      NoticeHelper.error(`Failed to transform selection: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get API client instance
   */
  public getAPIClient(): OpenNotebookClient {
    return this.apiClient;
  }

  /**
   * Get notebook manager instance
   */
  public getNotebookManager(): NotebookManager {
    return this.notebookManager;
  }

  /**
   * Get content sync manager instance
   */
  public getContentSyncManager(): ContentSyncManager {
    return this.contentSyncManager;
  }

  /**
   * Get sync indicator manager instance
   */
  public getSyncIndicatorManager(): SyncIndicatorManager {
    return this.syncIndicatorManager;
  }

  /**
   * Get notebook ID for a folder path
   */
  public getFolderMapping(folderPath: string): string | undefined {
    return this.notebookManager.getNotebookForFolder(folderPath);
  }

  /**
   * Get feature detector instance
   */
  public getFeatureDetector(): FeatureDetector {
    return this.featureDetector;
  }

  /**
   * Toggle chat view visibility
   */
  public async toggleChatView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    // @ts-ignore - rightSplit exists but isn't in types
    const rightSplit = workspace.rightSplit;

    if (leaves.length > 0) {
      // Chat view exists - toggle the sidebar
      if (rightSplit) {
        // @ts-ignore
        if (rightSplit.collapsed) {
          // @ts-ignore
          rightSplit.expand();

          // Update context based on current file when expanding
          const leaf = leaves[0];
          const view = leaf.view;
          if (view instanceof ChatView) {
            const activeFile = workspace.getActiveFile();
            if (!activeFile || !activeFile.parent) {
              view.showNotLinked();
            } else {
              const notebookId = this.notebookManager.getNotebookForFolder(activeFile.parent.path);
              if (notebookId) {
                await view.setNotebook(notebookId);
              } else {
                view.showNotLinked();
              }
            }
          }
        } else {
          // @ts-ignore
          rightSplit.collapse();
        }
      }
    } else {
      // Chat view doesn't exist - create and open it
      await this.activateChatView();
    }
  }

  /**
   * Activate chat view in the right sidebar
   */
  public async activateChatView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Our view doesn't exist, create a new leaf in the right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      }
    }

    // Reveal the leaf in case it's in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf);

      // Get the chat view and set context if we have an active file
      const view = leaf.view;
      if (view instanceof ChatView) {
        const activeFile = workspace.getActiveFile();
        if (activeFile && activeFile.parent) {
          const notebookId = this.notebookManager.getNotebookForFolder(activeFile.parent.path);
          if (notebookId) {
            await view.setNotebook(notebookId);
          }
        }
      }
    }
  }

  /**
   * Transform a text selection
   */
  private async transformSelection(editor: any): Promise<void> {
    const selection = editor.getSelection();
    if (!selection || selection.trim().length === 0) {
      NoticeHelper.warn('No text selected');
      return;
    }

    try {
      // Get available transformations
      const client = this.getAPIClient();
      const transformations = await client.getTransformations();

      if (!transformations || transformations.length === 0) {
        NoticeHelper.warn('No transformations available');
        return;
      }

      // Show transformation selection modal
      const transformationId = await this.promptForTransformation(transformations);
      if (!transformationId) return;

      const transformation = transformations.find(t => t.id === transformationId);
      if (!transformation) return;

      // Import and open result modal
      const { TransformResultModal } = await import('./modals/TransformResultModal');
      const resultModal = new TransformResultModal(this.app, this);
      resultModal.open();

      try {
        // Execute transformation
        const response = await client.executeTransformation(transformationId, selection);

        // Update modal with results
        resultModal.setResult({
          transformation,
          originalText: selection,
          transformedText: response.output,
          context: {
            type: 'selection',
            onAccept: (text: string) => {
              editor.replaceSelection(text);
            },
            onRetry: () => {
              this.transformSelection(editor);
            }
          }
        });
      } catch (error) {
        logger.error('Failed to execute transformation', error);
        resultModal.setError(error.message || 'Unknown error occurred during transformation');
      }
    } catch (error) {
      logger.error('Failed to transform selection', error);
      NoticeHelper.error(`Failed to transform selection: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Prompt user to select a transformation
   */
  private async promptForTransformation(transformations: any[]): Promise<string | null> {
    return new Promise((resolve) => {
      const div = document.body.createDiv({ cls: 'modal-container mod-dim' });
      div.addEventListener('click', (e) => {
        if (e.target === div) {
          div.remove();
          resolve(null);
        }
      });

      const modalDiv = div.createDiv({ cls: 'modal' });
      modalDiv.createEl('h3', { text: 'Select Transformation' });

      const listContainer = modalDiv.createDiv({
        cls: 'on-modal-list-container'
      });

      transformations.forEach((transformation) => {
        const item = listContainer.createDiv({
          cls: 'on-modal-list-item'
        });

        const title = item.createDiv({ cls: 'on-modal-list-item-title' });
        title.setText(transformation.name);

        if (transformation.description) {
          const desc = item.createDiv({ cls: 'on-modal-list-item-description' });
          desc.setText(transformation.description);
        }

        item.addEventListener('click', () => {
          div.remove();
          resolve(transformation.id);
        });
      });

      const buttonDiv = modalDiv.createDiv({ cls: 'modal-button-container' });
      const cancelBtn = buttonDiv.createEl('button', {
        text: 'Cancel'
      });
      cancelBtn.addEventListener('click', () => {
        div.remove();
        resolve(null);
      });

      // Add global escape key handler
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          div.remove();
          resolve(null);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }

  /**
   * Get all folders in the vault
   */
  private getAllFolders(): string[] {
    const folders: string[] = [];

    const collectFolders = (folder: TFolder) => {
      folders.push(folder.path);
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          collectFolders(child);
        }
      }
    };

    collectFolders(this.app.vault.getRoot());
    return folders.sort();
  }

  /**
   * Prompt user to select a folder
   */
  private async promptForFolder(folders: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const div = document.body.createDiv({ cls: 'modal-container mod-dim' });
      div.addEventListener('click', (e) => {
        if (e.target === div) {
          div.remove();
          resolve(null);
        }
      });

      const modalDiv = div.createDiv({ cls: 'modal' });
      modalDiv.createEl('h3', { text: 'Select Folder' });

      const listContainer = modalDiv.createDiv({
        cls: 'on-modal-list-container'
      });

      folders.forEach((folderPath) => {
        const item = listContainer.createDiv({
          cls: 'on-folder-list-item'
        });
        item.setText(folderPath || '(root)');

        item.addEventListener('click', () => {
          div.remove();
          resolve(folderPath);
        });
      });

      const buttonDiv = modalDiv.createDiv({ cls: 'modal-button-container' });
      const cancelBtn = buttonDiv.createEl('button', {
        text: 'Cancel'
      });
      cancelBtn.addEventListener('click', () => {
        div.remove();
        resolve(null);
      });

      // Add global escape key handler
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          div.remove();
          resolve(null);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }
}
