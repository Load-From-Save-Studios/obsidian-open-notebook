// Types for sync operations and conflict resolution

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resourceType: 'notebook' | 'source' | 'note';
  resourceId?: string;
  localPath?: string;
  data?: any;
  timestamp: number;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncResult {
  success: boolean;
  operationId: string;
  error?: string;
  conflicts?: ConflictInfo[];
}

export interface ConflictInfo {
  resourceType: 'note' | 'source';
  resourceId: string;
  filePath: string;
  localVersion: {
    content: string;
    modifiedAt: Date;
    checksum: string;
  };
  remoteVersion: {
    content: string;
    modifiedAt: Date;
    checksum: string;
  };
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedOperations: number;
  lastSyncTime?: Date;
  lastError?: string;
}
