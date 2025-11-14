// Offline queue service for handling sync operations when connection fails
import { OpenNotebookClient } from '../api/client';
import { SyncOperation } from '../types/sync';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class OfflineQueue {
  private queue: SyncOperation[] = [];
  private isOnline: boolean = true;
  private processing: boolean = false;
  private processInterval: number | null = null;

  constructor(
    private client: OpenNotebookClient,
    private saveCallback: (queue: SyncOperation[]) => Promise<void>
  ) {}

  /**
   * Initialize queue from persisted data
   */
  public async initialize(savedQueue: SyncOperation[]): Promise<void> {
    this.queue = savedQueue || [];
    logger.info(`Offline queue initialized with ${this.queue.length} operations`);

    // Start processing if there are queued operations
    if (this.queue.length > 0) {
      await this.processQueue();
    }
  }

  /**
   * Add operation to queue
   */
  public async enqueue(operation: SyncOperation): Promise<void> {
    // Check if operation already exists
    const existing = this.queue.find(op =>
      op.resourceType === operation.resourceType &&
      op.resourceId === operation.resourceId &&
      op.type === operation.type
    );

    if (existing) {
      // Update existing operation
      existing.data = operation.data;
      existing.timestamp = operation.timestamp;
      logger.debug(`Updated existing operation in queue: ${operation.id}`);
    } else {
      // Add new operation
      this.queue.push(operation);
      logger.info(`Enqueued operation: ${operation.type} ${operation.resourceType} ${operation.resourceId || operation.localPath}`);
    }

    await this.saveQueue();

    // Try to process immediately if online
    if (this.isOnline && !this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process all queued operations
   */
  public async processQueue(): Promise<void> {
    if (this.processing) {
      logger.debug('Queue already processing, skipping');
      return;
    }

    if (this.queue.length === 0) {
      logger.debug('Queue is empty, nothing to process');
      return;
    }

    this.processing = true;
    logger.info(`Processing queue with ${this.queue.length} operations`);

    const pendingOps = this.queue.filter(op => op.status === 'pending' || op.status === 'failed');

    for (const operation of pendingOps) {
      try {
        await this.processOperation(operation);
      } catch (error) {
        logger.error(`Failed to process operation ${operation.id}`, error);
        operation.status = 'failed';
        operation.attempts++;
        operation.error = error instanceof Error ? error.message : 'Unknown error';

        // Remove if too many attempts
        if (operation.attempts >= 3) {
          logger.warn(`Operation ${operation.id} failed after ${operation.attempts} attempts, removing from queue`);
          this.queue = this.queue.filter(op => op.id !== operation.id);
          NoticeHelper.error(`Sync operation failed: ${operation.type} ${operation.resourceType}`);
        }
      }
    }

    await this.saveQueue();
    this.processing = false;

    logger.info(`Queue processing complete. Remaining: ${this.queue.length}`);
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: SyncOperation): Promise<void> {
    operation.status = 'processing';
    operation.attempts++;

    logger.debug(`Processing operation: ${operation.type} ${operation.resourceType} ${operation.resourceId}`);

    try {
      switch (operation.resourceType) {
        case 'source':
          await this.processSourceOperation(operation);
          break;
        case 'note':
          await this.processNoteOperation(operation);
          break;
        case 'notebook':
          await this.processNotebookOperation(operation);
          break;
        default:
          throw new Error(`Unknown resource type: ${operation.resourceType}`);
      }

      // Mark as completed and remove from queue
      operation.status = 'completed';
      this.queue = this.queue.filter(op => op.id !== operation.id);

      logger.info(`Operation completed: ${operation.id}`);
    } catch (error) {
      logger.error(`Operation failed: ${operation.id}`, error);
      throw error;
    }
  }

  /**
   * Process source operations
   */
  private async processSourceOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await this.client.createSource(operation.data);
        break;
      case 'update':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for update');
        }
        await this.client.updateSource(operation.resourceId, operation.data);
        break;
      case 'delete':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for delete');
        }
        await this.client.deleteSource(operation.resourceId);
        break;
    }
  }

  /**
   * Process note operations
   */
  private async processNoteOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await this.client.createNote(operation.data);
        break;
      case 'update':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for update');
        }
        await this.client.updateNote(operation.resourceId, operation.data);
        break;
      case 'delete':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for delete');
        }
        await this.client.deleteNote(operation.resourceId);
        break;
    }
  }

  /**
   * Process notebook operations
   */
  private async processNotebookOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        await this.client.createNotebook(operation.data);
        break;
      case 'update':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for update');
        }
        await this.client.updateNotebook(operation.resourceId, operation.data);
        break;
      case 'delete':
        if (!operation.resourceId) {
          throw new Error('Resource ID required for delete');
        }
        await this.client.deleteNotebook(operation.resourceId);
        break;
    }
  }

  /**
   * Retry a specific operation
   */
  public async retryOperation(operationId: string): Promise<void> {
    const operation = this.queue.find(op => op.id === operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found in queue`);
    }

    operation.status = 'pending';
    operation.attempts = 0;
    operation.error = undefined;

    await this.saveQueue();
    await this.processQueue();
  }

  /**
   * Clear all operations from queue
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    logger.info('Queue cleared');
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get queued operations
   */
  public getQueuedOperations(): SyncOperation[] {
    return [...this.queue];
  }

  /**
   * Check if queue is processing
   */
  public isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Set online status
   */
  public setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && wasOffline && this.queue.length > 0) {
      logger.info('Connection restored, processing queue');
      NoticeHelper.info(`Connection restored. Processing ${this.queue.length} queued operations...`);
      this.processQueue();
    }
  }

  /**
   * Save queue to disk
   */
  private async saveQueue(): Promise<void> {
    await this.saveCallback(this.queue);
  }

  /**
   * Start automatic queue processing
   */
  public startAutoProcess(intervalMs: number = 30000): void {
    if (this.processInterval) {
      return;
    }

    this.processInterval = window.setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        logger.debug('Auto-processing queue');
        this.processQueue();
      }
    }, intervalMs);

    logger.info(`Auto-process started with ${intervalMs}ms interval`);
  }

  /**
   * Stop automatic queue processing
   */
  public stopAutoProcess(): void {
    if (this.processInterval) {
      window.clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('Auto-process stopped');
    }
  }

  /**
   * Cleanup on unload
   */
  public async cleanup(): Promise<void> {
    this.stopAutoProcess();
    await this.saveQueue();
  }
}
