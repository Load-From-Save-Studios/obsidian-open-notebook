// Content synchronization manager for syncing Obsidian notes to Open Notebook
import { TFile, TFolder, Notice } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { OpenNotebookClient } from '../api/client';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';
import { MetadataManager } from '../services/MetadataManager';
import { ConflictModal } from '../modals/ConflictModal';
import { ConflictInfo } from '../types/sync';

interface SyncMapping {
  filePath: string;
  sourceId: string;
  lastSynced: number;
  hash: string;
}

export class ContentSyncManager {
  private plugin: OpenNotebookPlugin;
  private client: OpenNotebookClient;
  private syncMappings: Map<string, SyncMapping>;
  private metadataManager: MetadataManager;
  private isInitializing: boolean = true;

  constructor(plugin: OpenNotebookPlugin) {
    this.plugin = plugin;
    this.client = plugin.getAPIClient();
    this.syncMappings = new Map();
    this.metadataManager = new MetadataManager(plugin.app);

    // Load sync mappings from plugin settings
    this.loadMappings();
  }

  /**
   * Load sync mappings from settings
   */
  private loadMappings(): void {
    const mappings = this.plugin.settings.sourceMappings || {};
    Object.entries(mappings).forEach(([path, mapping]) => {
      this.syncMappings.set(path, mapping as SyncMapping);
    });
  }

  /**
   * Save sync mappings to settings
   */
  private async saveMappings(): Promise<void> {
    const mappings: Record<string, SyncMapping> = {};
    this.syncMappings.forEach((mapping, path) => {
      mappings[path] = mapping;
    });

    this.plugin.settings.sourceMappings = mappings;
    await this.plugin.saveSettings();
  }

  /**
   * Sync a single file to Open Notebook
   */
  public async syncFile(file: TFile, notebookId: string): Promise<string | null> {
    try {
      logger.info(`Syncing file: ${file.path} to notebook: ${notebookId}`);

      // Read file content and metadata
      const content = await this.plugin.app.vault.read(file);
      const bodyContent = await this.metadataManager.getBodyContent(file);

      // Skip empty files - Open Notebook API requires content
      if (!bodyContent || bodyContent.trim().length === 0) {
        logger.debug(`File ${file.path} is empty, skipping sync`);
        return null;
      }

      // Get current checksum and metadata
      const currentChecksum = await this.metadataManager.computeChecksum(file);
      const metadata = await this.metadataManager.getMetadata(file);

      // Check if file is already synced (from frontmatter or legacy mapping)
      const existing = this.syncMappings.get(file.path);
      const sourceId = metadata.on_source_id || existing?.sourceId;

      if (sourceId) {
        // Check if sync is disabled in frontmatter
        if (metadata.on_sync_enabled === false) {
          logger.debug(`Sync disabled for ${file.path}, skipping`);
          return sourceId;
        }

        // Check if content has changed
        const storedChecksum = metadata.on_checksum || existing?.hash;
        if (storedChecksum === currentChecksum) {
          logger.debug(`File ${file.path} hasn't changed, skipping sync`);
          return sourceId;
        }

        // Content has changed - Open Notebook API doesn't support content updates
        // We need to delete and recreate the source
        logger.info(`Content changed for ${file.path}, recreating source (API limitation)`);

        // Delete old source - must succeed before creating new one
        try {
          await this.client.deleteSource(sourceId);
          logger.info(`Deleted old source ${sourceId}`);
        } catch (error) {
          // If delete fails, check if the source even exists
          logger.error(`Failed to delete old source ${sourceId}`, error);

          // Try to verify if it actually exists
          try {
            await this.client.getSource(sourceId);
            // Source still exists but couldn't delete - this is a real error
            logger.error(`Source ${sourceId} exists but couldn't be deleted - aborting to avoid duplicates`);
            throw new Error(`Cannot delete existing source ${sourceId}`);
          } catch (getError) {
            // Source doesn't exist (404) - it's already gone, safe to continue
            logger.info(`Old source ${sourceId} doesn't exist, safe to create new one`);
          }
        }

        // Create new source with updated content
        const source = await this.client.createSource({
          type: 'text',
          title: file.basename,
          content: bodyContent,
          notebooks: [notebookId],
          embed: true  // Trigger embedding for search
        });

        // Update frontmatter metadata
        await this.metadataManager.updateMetadata(file, {
          on_notebook_id: notebookId,
          on_source_id: source.id,
          on_synced_at: new Date().toISOString(),
          on_modified_at: new Date(file.stat.mtime).toISOString(),
          on_checksum: currentChecksum,
          on_sync_enabled: true
        });

        // Update legacy mapping (for backwards compatibility)
        if (existing) {
          existing.sourceId = source.id;
          existing.lastSynced = Date.now();
          existing.hash = currentChecksum;
        } else {
          this.syncMappings.set(file.path, {
            filePath: file.path,
            sourceId: source.id,
            lastSynced: Date.now(),
            hash: currentChecksum
          });
        }
        await this.saveMappings();

        // Refresh indicators
        this.plugin.getSyncIndicatorManager()?.refreshAll();

        logger.info(`Recreated source ${source.id} for file ${file.path}`);
        return source.id;
      } else {
        // Create new source
        logger.info(`Creating new source for file ${file.path}`);
        const source = await this.client.createSource({
          type: 'text',
          title: file.basename,
          content: bodyContent,
          notebooks: [notebookId],
          embed: true  // Trigger embedding for search
        });

        // Write frontmatter metadata
        await this.metadataManager.updateMetadata(file, {
          on_notebook_id: notebookId,
          on_source_id: source.id,
          on_synced_at: new Date().toISOString(),
          on_modified_at: new Date(file.stat.mtime).toISOString(),
          on_checksum: currentChecksum,
          on_sync_enabled: true
        });

        // Save legacy mapping (for backwards compatibility)
        this.syncMappings.set(file.path, {
          filePath: file.path,
          sourceId: source.id,
          lastSynced: Date.now(),
          hash: currentChecksum
        });
        await this.saveMappings();

        // Refresh indicators
        this.plugin.getSyncIndicatorManager()?.refreshAll();

        logger.info(`Created source ${source.id} for file ${file.path}`);
        return source.id;
      }
    } catch (error) {
      logger.error(`Failed to sync file ${file.path}`, error);
      throw error;
    }
  }

  /**
   * Sync all files in a folder to a notebook
   */
  public async syncFolder(folder: TFolder, notebookId: string): Promise<{
    synced: number;
    failed: number;
    skipped: number;
  }> {
    logger.info(`Syncing folder: ${folder.path} to notebook: ${notebookId}`);

    const results = {
      synced: 0,
      failed: 0,
      skipped: 0
    };

    // Get all markdown files in the folder (recursively)
    const files = this.getMarkdownFilesInFolder(folder);

    logger.info(`Found ${files.length} markdown files to sync`);

    for (const file of files) {
      try {
        await this.syncFile(file, notebookId);
        results.synced++;
      } catch (error) {
        logger.error(`Failed to sync file ${file.path}`, error);
        results.failed++;
      }
    }

    logger.info(`Folder sync complete: ${results.synced} synced, ${results.failed} failed, ${results.skipped} skipped`);
    return results;
  }

  /**
   * Check if a file is in an excluded folder
   */
  private isFileInExcludedFolder(file: TFile): boolean {
    const excludedFolders = this.plugin.settings.excludedFolders || [];
    const filePath = file.path;

    return excludedFolders.some(excluded => {
      // Check if file path starts with excluded folder path
      return filePath === excluded ||
             filePath.startsWith(excluded + '/');
    });
  }

  /**
   * Get all markdown files in a folder recursively
   */
  private getMarkdownFilesInFolder(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    const excludedFolders = this.plugin.settings.excludedFolders || [];

    const processFolder = (f: TFolder) => {
      // Check if this folder should be excluded
      const folderName = f.name;
      const folderPath = f.path;

      // Check both folder name and full path against excluded folders
      const isExcluded = excludedFolders.some(excluded => {
        return folderPath === excluded ||
               folderPath.startsWith(excluded + '/') ||
               folderName === excluded;
      });

      if (isExcluded) {
        logger.debug(`Skipping excluded folder: ${folderPath}`);
        return;
      }

      for (const child of f.children) {
        if (child instanceof TFile && child.extension === 'md') {
          files.push(child);
        } else if (child instanceof TFolder) {
          processFolder(child);
        }
      }
    };

    processFolder(folder);
    return files;
  }

  /**
   * Handle file creation
   */
  public async onFileCreated(file: TFile): Promise<void> {
    // Don't auto-sync during initialization - let verifySyncState handle it
    if (this.isInitializing) {
      logger.debug(`Skipping auto-sync for ${file.path} during initialization`);
      return;
    }

    // Skip files in excluded folders
    if (this.isFileInExcludedFolder(file)) {
      logger.debug(`Skipping file in excluded folder: ${file.path}`);
      return;
    }

    // Only auto-sync if file is in a linked folder
    const folder = file.parent;
    if (!folder) {
      return;
    }

    const notebookId = this.plugin.getNotebookManager().getNotebookForFolder(folder.path);
    if (!notebookId) {
      logger.debug(`No notebook mapped for folder ${folder.path}, skipping auto-sync`);
      return;
    }

    // Check if auto-sync is enabled
    if (!this.plugin.settings.autoSyncOnSave) {
      return;
    }

    try {
      // Small delay to ensure file is fully created
      await this.sleep(500);
      await this.syncFile(file, notebookId);
      logger.info(`Auto-synced new file ${file.path}`);
      NoticeHelper.success(`Synced new file: ${file.basename}`);
    } catch (error) {
      logger.error(`Failed to auto-sync new file ${file.path}`, error);
    }
  }

  /**
   * Handle file modification
   */
  public async onFileModified(file: TFile): Promise<void> {
    // Skip files in excluded folders
    if (this.isFileInExcludedFolder(file)) {
      logger.debug(`Skipping file in excluded folder: ${file.path}`);
      return;
    }

    // Get the notebook ID from the file's folder
    const folder = file.parent;
    if (!folder) {
      logger.debug(`File ${file.path} has no parent folder`);
      return;
    }

    const notebookId = this.plugin.getNotebookManager().getNotebookForFolder(folder.path);
    if (!notebookId) {
      logger.debug(`No notebook mapped for folder ${folder.path}`);
      return;
    }

    // Check if auto-sync is enabled
    if (!this.plugin.settings.autoSyncOnSave) {
      return;
    }

    // Check if file has sync metadata
    const metadata = await this.metadataManager.getMetadata(file);
    const hasSyncMetadata = !!(metadata.on_source_id);

    // Check if content has actually changed (excluding frontmatter)
    const hasChanged = await this.metadataManager.hasContentChanged(file);
    if (!hasChanged && hasSyncMetadata) {
      logger.debug(`Content hasn't changed for ${file.path}, skipping auto-sync`);
      return;
    }

    try {
      await this.syncFile(file, notebookId);

      if (hasSyncMetadata) {
        logger.info(`Auto-synced modified file ${file.path}`);
        NoticeHelper.success(`Updated: ${file.basename}`);
      } else {
        // File was created but not synced initially (was empty)
        logger.info(`Auto-synced new file ${file.path} (first edit)`);
        NoticeHelper.success(`Synced: ${file.basename}`);
      }
    } catch (error) {
      logger.error(`Failed to auto-sync file ${file.path}`, error);
      NoticeHelper.error(`Failed to sync: ${file.basename}`);
    }
  }

  /**
   * Handle file deletion
   */
  public async onFileDeleted(file: TFile): Promise<void> {
    // Check both frontmatter and legacy mapping
    const metadata = await this.metadataManager.getMetadata(file);
    const mapping = this.syncMappings.get(file.path);
    const sourceId = metadata.on_source_id || mapping?.sourceId;

    if (!sourceId) {
      // File not synced
      return;
    }

    try {
      // Delete the source from Open Notebook
      await this.client.deleteSource(sourceId);

      // Clear frontmatter metadata (if file still exists)
      try {
        await this.metadataManager.clearMetadata(file);
      } catch (error) {
        // File might already be gone, that's okay
        logger.debug(`Could not clear metadata for ${file.path} (file may be deleted)`);
      }

      // Remove legacy mapping
      this.syncMappings.delete(file.path);
      await this.saveMappings();

      // Refresh indicators
      this.plugin.getSyncIndicatorManager()?.refreshAll();

      logger.info(`Deleted source ${sourceId} for file ${file.path}`);
    } catch (error) {
      logger.error(`Failed to delete source for file ${file.path}`, error);
    }
  }

  /**
   * Handle file rename
   */
  public async onFileRenamed(file: TFile, oldPath: string): Promise<void> {
    // Get metadata and mapping
    const metadata = await this.metadataManager.getMetadata(file);
    const mapping = this.syncMappings.get(oldPath);
    const sourceId = metadata.on_source_id || mapping?.sourceId;

    if (!sourceId) {
      // File not synced
      return;
    }

    // Update legacy mapping with new path
    if (mapping) {
      this.syncMappings.delete(oldPath);
      mapping.filePath = file.path;
      this.syncMappings.set(file.path, mapping);
      await this.saveMappings();
    }

    // Update source title in Open Notebook
    try {
      await this.client.updateSource(sourceId, {
        title: file.basename
      });

      // Update frontmatter with new modification time
      await this.metadataManager.updateMetadata(file, {
        on_modified_at: new Date(file.stat.mtime).toISOString()
      });

      // Refresh indicators
      this.plugin.getSyncIndicatorManager()?.refreshAll();

      logger.info(`Updated source ${sourceId} title after rename`);
    } catch (error) {
      logger.error(`Failed to update source after rename`, error);
    }
  }

  /**
   * Get sync status for a file
   */
  public getSyncStatus(filePath: string): SyncMapping | null {
    return this.syncMappings.get(filePath) || null;
  }

  /**
   * Get sync metadata from frontmatter
   */
  public async getSyncMetadata(file: TFile) {
    return await this.metadataManager.getMetadata(file);
  }

  /**
   * Check for sync conflicts
   * Returns ConflictInfo if a conflict is detected, null otherwise
   */
  public async checkForConflict(file: TFile, sourceId: string): Promise<ConflictInfo | null> {
    try {
      // Get local content and metadata
      const localContent = await this.metadataManager.getBodyContent(file);
      const localChecksum = await this.metadataManager.computeChecksum(file);
      const metadata = await this.metadataManager.getMetadata(file);

      // Get remote source
      const remoteSource = await this.client.getSource(sourceId);
      if (!remoteSource) {
        logger.warn(`Remote source ${sourceId} not found`);
        return null;
      }

      // Compute remote checksum
      const remoteContent = remoteSource.full_text || '';
      const remoteChecksum = this.metadataManager.computeChecksumFromContent(remoteContent);

      // Check if checksums differ
      const storedChecksum = metadata.on_checksum;

      // Conflict exists if:
      // 1. Local content differs from stored checksum (local changes)
      // 2. Remote content differs from stored checksum (remote changes)
      // 3. Local and remote differ from each other
      const localChanged = storedChecksum && localChecksum !== storedChecksum;
      const remoteChanged = storedChecksum && remoteChecksum !== storedChecksum;
      const contentsDiffer = localChecksum !== remoteChecksum;

      if (localChanged && remoteChanged && contentsDiffer) {
        // True conflict: both local and remote have changed
        logger.warn(`Conflict detected for ${file.path}: both local and remote have changes`);

        return {
          resourceType: 'source',
          resourceId: sourceId,
          filePath: file.path,
          localVersion: {
            content: localContent,
            modifiedAt: new Date(file.stat.mtime),
            checksum: localChecksum
          },
          remoteVersion: {
            content: remoteContent,
            modifiedAt: remoteSource.updated ? new Date(remoteSource.updated) : new Date(),
            checksum: remoteChecksum
          }
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to check for conflict on ${file.path}`, error);
      return null;
    }
  }

  /**
   * Resolve a conflict by keeping local or remote version
   */
  public async resolveConflict(conflict: ConflictInfo, keepLocal: boolean): Promise<void> {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(conflict.filePath);
      if (!file || !(file instanceof TFile)) {
        throw new Error(`File not found: ${conflict.filePath}`);
      }

      const folder = file.parent;
      if (!folder) {
        throw new Error(`File has no parent folder: ${conflict.filePath}`);
      }

      const notebookId = this.plugin.getNotebookManager().getNotebookForFolder(folder.path);
      if (!notebookId) {
        throw new Error(`No notebook mapped for folder: ${folder.path}`);
      }

      if (keepLocal) {
        // Keep local version - sync to remote
        logger.info(`Resolving conflict for ${conflict.filePath}: keeping local version`);
        await this.syncFile(file, notebookId);
        NoticeHelper.success(`Kept local version: ${file.basename}`);
      } else {
        // Keep remote version - overwrite local
        logger.info(`Resolving conflict for ${conflict.filePath}: keeping remote version`);

        // Update local file with remote content
        await this.plugin.app.vault.modify(file, conflict.remoteVersion.content);

        // Update metadata
        await this.metadataManager.updateMetadata(file, {
          on_checksum: conflict.remoteVersion.checksum,
          on_synced_at: new Date().toISOString(),
          on_modified_at: conflict.remoteVersion.modifiedAt.toISOString()
        });

        NoticeHelper.success(`Kept remote version: ${file.basename}`);
      }
    } catch (error) {
      logger.error(`Failed to resolve conflict`, error);
      NoticeHelper.error(`Failed to resolve conflict`);
      throw error;
    }
  }

  /**
   * Clear all sync mappings
   */
  public async clearAllMappings(): Promise<void> {
    this.syncMappings.clear();
    await this.saveMappings();
    logger.info('Cleared all sync mappings');
  }

  /**
   * Get all synced files
   */
  public getAllSyncedFiles(): SyncMapping[] {
    return Array.from(this.syncMappings.values());
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mark initialization as complete (called after startup verification)
   */
  public setInitializationComplete(): void {
    this.isInitializing = false;
    logger.info('ContentSyncManager initialization complete - auto-sync enabled');
  }

  /**
   * Verify and reconcile sync state on startup
   * Obsidian is the source of truth - if a file exists in Obsidian but not in Open Notebook, recreate it
   */
  public async verifySyncState(): Promise<{
    verified: number;
    resynced: number;
    removed: number;
    failed: number;
  }> {
    logger.info('Starting sync state verification');

    const results = {
      verified: 0,
      resynced: 0,
      removed: 0,
      failed: 0
    };

    // Get all synced files from mappings
    const mappings = Array.from(this.syncMappings.entries());
    const mappingsToRemove: string[] = [];

    for (const [filePath, mapping] of mappings) {
      try {
        // Check if file exists in Obsidian
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);

        if (!file || !(file instanceof TFile)) {
          // File was deleted from Obsidian - remove mapping
          logger.info(`File ${filePath} no longer exists, removing mapping`);
          mappingsToRemove.push(filePath);
          results.removed++;
          continue;
        }

        // Get notebook ID from file's folder
        const folder = file.parent;
        if (!folder) {
          logger.warn(`File ${filePath} has no parent folder, skipping`);
          mappingsToRemove.push(filePath);
          results.failed++;
          continue;
        }

        const notebookId = this.plugin.getNotebookManager().getNotebookForFolder(folder.path);
        if (!notebookId) {
          logger.warn(`No notebook mapped for folder ${folder.path}, removing mapping`);
          mappingsToRemove.push(filePath);
          results.removed++;
          continue;
        }

        // File exists in Obsidian - verify it exists in Open Notebook
        try {
          await this.plugin.getAPIClient().getSource(mapping.sourceId);
          results.verified++;
          logger.debug(`Source ${mapping.sourceId} verified for ${filePath}`);
        } catch (error) {
          // Source doesn't exist in Open Notebook - check if another source with same title exists
          logger.info(`Source ${mapping.sourceId} not found, checking for duplicates by title`);

          try {
            const allSources = await this.plugin.getAPIClient().getSources(notebookId);
            logger.debug(`Searching ${allSources.length} sources for title matching: "${file.basename}"`);

            // Log all source titles for debugging
            allSources.forEach(s => logger.debug(`  Available source: "${s.title}" (${s.id})`));

            const matchingSource = allSources.find(s => s.title === file.basename);

            if (matchingSource) {
              // Found a source with matching title - update mapping instead of creating duplicate
              logger.info(`Found existing source ${matchingSource.id} for ${filePath}, updating mapping`);
              mapping.sourceId = matchingSource.id;
              mapping.lastSynced = Date.now();
              results.verified++;
              // Will save mappings at the end
            } else {
              // No matching source found - resync from Obsidian
              logger.warn(`No matching source found for "${file.basename}" among ${allSources.length} sources, resyncing ${filePath}`);
              await this.syncFile(file, notebookId);
              results.resynced++;
              logger.info(`Resynced ${filePath} to Open Notebook`);
            }
          } catch (syncError) {
            logger.error(`Failed to handle missing source for ${filePath}`, syncError);
            results.failed++;
          }
        }
      } catch (error) {
        logger.error(`Error verifying ${filePath}`, error);
        results.failed++;
      }
    }

    // Remove stale mappings
    for (const filePath of mappingsToRemove) {
      this.syncMappings.delete(filePath);
    }

    // Save mappings if anything changed
    if (mappingsToRemove.length > 0 || results.verified > 0 || results.resynced > 0) {
      await this.saveMappings();
    }

    // Refresh indicators after reconciliation
    this.plugin.getSyncIndicatorManager()?.refreshAll();

    logger.info(`Sync state verification complete: ${results.verified} verified, ${results.resynced} resynced, ${results.removed} removed, ${results.failed} failed`);

    return results;
  }
}
