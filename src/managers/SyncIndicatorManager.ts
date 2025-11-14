// Visual indicators for synced files
import { TFile, WorkspaceLeaf } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { logger } from '../utils/Logger';

export class SyncIndicatorManager {
  private plugin: OpenNotebookPlugin;
  private statusBarItem: HTMLElement | null = null;

  constructor(plugin: OpenNotebookPlugin) {
    this.plugin = plugin;
    this.initialize();
  }

  /**
   * Initialize indicator system
   */
  private initialize(): void {
    // Add status bar item for editor
    this.statusBarItem = this.plugin.addStatusBarItem();
    this.statusBarItem.addClass('open-notebook-sync-status');

    // Listen for active file changes to update status bar
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        this.updateEditorStatus();
      })
    );

    // Listen for file changes to update status bar
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-open', () => {
        this.updateEditorStatus();
      })
    );

    // Listen for layout changes (file explorer rendering)
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('layout-change', () => {
        this.updateFileExplorer();
      })
    );

    // Initial update with longer delay for file explorer
    this.updateEditorStatus();
    setTimeout(() => {
      this.updateFileExplorer();
    }, 2000);

    logger.info('Sync indicator manager initialized');
  }

  /**
   * Update editor status bar
   */
  public async updateEditorStatus(): Promise<void> {
    if (!this.statusBarItem) return;

    const activeFile = this.plugin.app.workspace.getActiveFile();

    // Clear status bar if no file or not a markdown file
    if (!activeFile || activeFile.extension !== 'md') {
      this.statusBarItem.empty();
      return;
    }

    // Check if file has a parent folder
    const folder = activeFile.parent;
    if (!folder) {
      this.statusBarItem.empty();
      return;
    }

    // Check if folder is linked to a notebook
    const notebookId = this.plugin.getNotebookManager().getNotebookForFolder(folder.path);
    if (!notebookId) {
      // Folder not linked - don't show anything
      this.statusBarItem.empty();
      return;
    }

    // Folder is linked - check sync status from frontmatter and legacy mapping
    const metadata = await this.plugin.getContentSyncManager().getSyncMetadata(activeFile);
    const syncStatus = this.plugin.getContentSyncManager().getSyncStatus(activeFile.path);
    const isSynced = !!(metadata.on_source_id || syncStatus);

    this.statusBarItem.empty();

    if (isSynced) {
      // File is synced
      const container = this.statusBarItem.createSpan({ cls: 'on-sync-status-synced' });

      const icon = container.createSpan({ cls: 'on-sync-icon' });
      icon.innerHTML = '✓';

      const text = container.createSpan({ cls: 'on-sync-text' });
      text.setText('Synced');

      // Add tooltip with sync details
      let tooltip = 'Synced to Open Notebook';
      if (metadata.on_synced_at) {
        const lastSynced = new Date(metadata.on_synced_at);
        const timeAgo = this.getTimeAgo(lastSynced);
        tooltip = `Synced to Open Notebook ${timeAgo}`;
      } else if (syncStatus) {
        const lastSynced = new Date(syncStatus.lastSynced);
        const timeAgo = this.getTimeAgo(lastSynced);
        tooltip = `Synced to Open Notebook ${timeAgo}`;
      }
      this.statusBarItem.setAttribute('aria-label', tooltip);
    } else {
      // Folder is linked but file not synced
      const container = this.statusBarItem.createSpan({ cls: 'on-sync-status-unsynced' });

      const icon = container.createSpan({ cls: 'on-sync-icon' });
      icon.innerHTML = '○';

      const text = container.createSpan({ cls: 'on-sync-text' });
      text.setText('Not synced');

      this.statusBarItem.setAttribute('aria-label', 'Not synced to Open Notebook');
    }
  }

  /**
   * Update file explorer indicators
   */
  public updateFileExplorer(): void {
    // Delay to ensure DOM is ready
    setTimeout(() => {
      this.addFileExplorerIndicators();
    }, 500);
  }

  /**
   * Add indicators to file explorer items
   */
  private async addFileExplorerIndicators(): Promise<void> {
    // Try multiple selectors for file items
    let fileItems = document.querySelectorAll('.tree-item-self[data-path]');

    if (fileItems.length === 0) {
      // Try alternative selectors
      fileItems = document.querySelectorAll('[data-path].tree-item-self');
      console.log(`[Sync Indicators] Trying alternative selector 1: found ${fileItems.length}`);
    }

    if (fileItems.length === 0) {
      fileItems = document.querySelectorAll('.nav-file[data-path]');
      console.log(`[Sync Indicators] Trying alternative selector 2: found ${fileItems.length}`);
    }

    if (fileItems.length === 0) {
      fileItems = document.querySelectorAll('.tree-item[data-path]');
      console.log(`[Sync Indicators] Trying alternative selector 3: found ${fileItems.length}`);
    }

    console.log(`[Sync Indicators] Final count: ${fileItems.length} file items in explorer`);

    // Debug: Show what selectors exist in the DOM
    const allTreeItems = document.querySelectorAll('.tree-item');
    const allTreeItemSelf = document.querySelectorAll('.tree-item-self');
    console.log(`[Sync Indicators] DOM Debug - .tree-item: ${allTreeItems.length}, .tree-item-self: ${allTreeItemSelf.length}`);

    logger.debug(`Found ${fileItems.length} file items in explorer`);

    // Get all synced files for debugging
    const syncedFiles = this.plugin.getContentSyncManager().getAllSyncedFiles();
    console.log(`[Sync Indicators] Synced files:`, syncedFiles.map(f => f.filePath));

    // Process each file item
    for (const item of Array.from(fileItems)) {
      const fileItem = item as HTMLElement;
      const filePath = fileItem.getAttribute('data-path');

      if (!filePath || !filePath.endsWith('.md')) continue;

      // Get the title element
      const titleEl = fileItem.querySelector('.tree-item-inner');
      if (!titleEl) {
        console.log(`[Sync Indicators] No title element found for ${filePath}`);
        logger.debug(`No title element found for ${filePath}`);
        continue;
      }

      // Remove existing indicator
      const existingIndicator = fileItem.querySelector('.on-sync-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }

      // Get file from vault to check frontmatter
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) continue;

      // Check if file is synced (from frontmatter or legacy mapping)
      const metadata = await this.plugin.getContentSyncManager().getSyncMetadata(file);
      const syncStatus = this.plugin.getContentSyncManager().getSyncStatus(filePath);
      const isSynced = !!(metadata.on_source_id || syncStatus);

      if (isSynced) {
        console.log(`[Sync Indicators] Adding indicator for synced file: ${filePath}`);
        logger.debug(`Adding indicator for synced file: ${filePath}`);

        // Add synced indicator BEFORE the filename text
        const indicator = document.createElement('span');
        indicator.addClass('on-sync-indicator');
        indicator.addClass('on-synced');
        indicator.innerHTML = '✓ ';
        indicator.setAttribute('aria-label', 'Synced to Open Notebook');
        indicator.style.cssText = 'color: #22c55e; margin-right: 4px; font-size: 1em; font-weight: bold; display: inline-block;';

        // Insert at the beginning of the title element
        titleEl.insertBefore(indicator, titleEl.firstChild);

        console.log(`[Sync Indicators] Indicator added to:`, titleEl);
        console.log(`[Sync Indicators] Indicator element:`, indicator);
        console.log(`[Sync Indicators] Parent element classes:`, fileItem.className);
      }
    }
  }

  /**
   * Refresh all indicators
   */
  public refreshAll(): void {
    this.updateEditorStatus();
    this.updateFileExplorer();
  }

  /**
   * Get human-readable time ago string
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    if (this.statusBarItem) {
      this.statusBarItem.remove();
    }
  }
}
