// Notebook Manager - handles notebook CRUD and folder mapping
import { TFolder } from 'obsidian';
import { OpenNotebookClient } from '../api/client';
import { OpenNotebookSettings } from '../types/settings';
import { Notebook, NotebookCreate, NotebookUpdate } from '../types/notebook';
import { NotebookAdapter } from '../api/adapters/NotebookAdapter';
import { logger } from '../utils/Logger';

export class NotebookManager {
  private client: OpenNotebookClient;
  private settings: OpenNotebookSettings;
  private notebookCache: Map<string, Notebook> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(client: OpenNotebookClient, settings: OpenNotebookSettings) {
    this.client = client;
    this.settings = settings;
  }

  // ============ Mapping Operations ============

  /**
   * Map a folder path to a notebook ID
   */
  public async mapFolderToNotebook(folderPath: string, notebookId: string): Promise<void> {
    logger.info(`Mapping folder "${folderPath}" to notebook "${notebookId}"`);

    // Normalize path (remove leading/trailing slashes)
    const normalizedPath = this.normalizePath(folderPath);

    this.settings.folderToNotebook[normalizedPath] = notebookId;

    // Update cache
    const notebook = this.notebookCache.get(notebookId);
    if (notebook) {
      notebook.localPath = normalizedPath;
    }
  }

  /**
   * Remove folder mapping
   */
  public async unmapFolder(folderPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(folderPath);
    const notebookId = this.settings.folderToNotebook[normalizedPath];

    if (notebookId) {
      logger.info(`Unmapping folder "${folderPath}" from notebook "${notebookId}"`);

      // Update cache
      const notebook = this.notebookCache.get(notebookId);
      if (notebook) {
        notebook.localPath = undefined;
      }

      delete this.settings.folderToNotebook[normalizedPath];
    }
  }

  /**
   * Get notebook ID for a folder path
   */
  public getNotebookForFolder(folderPath: string): string | undefined {
    const normalizedPath = this.normalizePath(folderPath);
    return this.settings.folderToNotebook[normalizedPath];
  }

  /**
   * Get folder path for a notebook ID
   */
  public getFolderForNotebook(notebookId: string): string | undefined {
    return Object.keys(this.settings.folderToNotebook).find(
      path => this.settings.folderToNotebook[path] === notebookId
    );
  }

  /**
   * Get all folder mappings
   */
  public getAllMappings(): Record<string, string> {
    return { ...this.settings.folderToNotebook };
  }

  // ============ Notebook Operations ============

  /**
   * Get all notebooks (with caching)
   */
  public async getNotebooks(forceRefresh: boolean = false): Promise<Notebook[]> {
    const now = Date.now();

    if (!forceRefresh && now - this.lastCacheUpdate < this.CACHE_TTL) {
      logger.debug('Returning cached notebooks');
      return Array.from(this.notebookCache.values());
    }

    logger.debug('Fetching notebooks from API');
    const apiNotebooks = await this.client.getNotebooks();
    const notebooks = NotebookAdapter.fromAPIList(apiNotebooks, this.settings.folderToNotebook);

    // Update cache
    this.notebookCache.clear();
    notebooks.forEach(notebook => {
      this.notebookCache.set(notebook.id, notebook);
    });
    this.lastCacheUpdate = now;

    return notebooks;
  }

  /**
   * Get a single notebook by ID
   */
  public async getNotebook(id: string, useCache: boolean = true): Promise<Notebook | null> {
    // Check cache first
    if (useCache && this.notebookCache.has(id)) {
      logger.debug(`Returning cached notebook: ${id}`);
      return this.notebookCache.get(id)!;
    }

    try {
      const apiNotebook = await this.client.getNotebook(id);
      const localPath = this.getFolderForNotebook(id);
      const notebook = NotebookAdapter.fromAPI(apiNotebook, localPath);

      // Update cache
      this.notebookCache.set(id, notebook);

      return notebook;
    } catch (error) {
      logger.error(`Failed to fetch notebook ${id}`, error);
      return null;
    }
  }

  /**
   * Create a new notebook
   */
  public async createNotebook(data: NotebookCreate): Promise<Notebook> {
    logger.info(`Creating notebook: ${data.name}`);

    const apiData = NotebookAdapter.toAPICreate(data.name, data.description);
    const apiNotebook = await this.client.createNotebook(apiData);
    const notebook = NotebookAdapter.fromAPI(apiNotebook);

    // Update cache
    this.notebookCache.set(notebook.id, notebook);

    return notebook;
  }

  /**
   * Create a notebook from an Obsidian folder
   */
  public async createNotebookFromFolder(folder: TFolder): Promise<Notebook> {
    const folderName = folder.name || folder.path.split('/').pop() || 'Unnamed';

    logger.info(`Creating notebook from folder: ${folder.path}`);

    // Create notebook with folder name
    const notebook = await this.createNotebook({
      name: folderName,
      description: `Synced from Obsidian folder: ${folder.path}`
    });

    // Map folder to notebook
    await this.mapFolderToNotebook(folder.path, notebook.id);

    return notebook;
  }

  /**
   * Update a notebook
   */
  public async updateNotebook(id: string, data: NotebookUpdate): Promise<Notebook | null> {
    logger.info(`Updating notebook: ${id}`);

    try {
      const apiData = NotebookAdapter.toAPIUpdate(data);
      const apiNotebook = await this.client.updateNotebook(id, apiData);
      const localPath = this.getFolderForNotebook(id);
      const notebook = NotebookAdapter.fromAPI(apiNotebook, localPath);

      // Update cache
      this.notebookCache.set(id, notebook);

      return notebook;
    } catch (error) {
      logger.error(`Failed to update notebook ${id}`, error);
      return null;
    }
  }

  /**
   * Delete a notebook
   */
  public async deleteNotebook(id: string): Promise<boolean> {
    logger.info(`Deleting notebook: ${id}`);

    try {
      await this.client.deleteNotebook(id);

      // Remove from cache
      this.notebookCache.delete(id);

      // Remove folder mapping if exists
      const folderPath = this.getFolderForNotebook(id);
      if (folderPath) {
        await this.unmapFolder(folderPath);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to delete notebook ${id}`, error);
      return false;
    }
  }

  /**
   * Get or create a notebook for a folder
   */
  public async getOrCreateNotebook(folderPath: string): Promise<string> {
    const normalizedPath = this.normalizePath(folderPath);

    // Check if already mapped
    const existingId = this.getNotebookForFolder(normalizedPath);
    if (existingId) {
      logger.debug(`Folder "${folderPath}" already mapped to notebook: ${existingId}`);
      return existingId;
    }

    // Create new notebook
    const folderName = normalizedPath.split('/').pop() || 'Unnamed';
    const notebook = await this.createNotebook({
      name: folderName,
      description: `Synced from Obsidian folder: ${normalizedPath}`
    });

    // Map folder to notebook
    await this.mapFolderToNotebook(normalizedPath, notebook.id);

    return notebook.id;
  }

  /**
   * Validate that a mapping exists and the notebook is accessible
   */
  public async validateMapping(folderPath: string): Promise<boolean> {
    const notebookId = this.getNotebookForFolder(folderPath);
    if (!notebookId) {
      logger.debug(`No mapping found for folder: ${folderPath}`);
      return false;
    }

    const notebook = await this.getNotebook(notebookId, false);
    if (!notebook) {
      logger.warn(`Notebook ${notebookId} not found, removing invalid mapping`);
      await this.unmapFolder(folderPath);
      return false;
    }

    return true;
  }

  /**
   * Clear notebook cache
   */
  public clearCache(): void {
    logger.debug('Clearing notebook cache');
    this.notebookCache.clear();
    this.lastCacheUpdate = 0;
  }

  // ============ Helper Methods ============

  /**
   * Normalize folder path (remove leading/trailing slashes)
   */
  private normalizePath(path: string): string {
    return path.replace(/^\/+|\/+$/g, '');
  }

  /**
   * Get notebooks mapped to local folders
   */
  public getMappedNotebooks(): Notebook[] {
    return Array.from(this.notebookCache.values()).filter(
      notebook => notebook.localPath !== undefined
    );
  }

  /**
   * Get notebooks not mapped to any folder
   */
  public getUnmappedNotebooks(): Notebook[] {
    return Array.from(this.notebookCache.values()).filter(
      notebook => notebook.localPath === undefined
    );
  }
}
