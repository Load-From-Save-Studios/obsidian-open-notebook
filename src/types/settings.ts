// Settings types for Open Notebook plugin
import { SyncOperation } from './sync';
import { DetectedFeatures } from '../services/FeatureDetector';

export interface OpenNotebookSettings {
  // Connection
  apiEndpoint: string;
  apiPassword: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastConnectionCheck?: number;

  // Notebook Mapping
  mappingStrategy: NotebookMappingStrategy;
  folderToNotebook: Record<string, string>;
  notebookTagPrefix: string;
  notebookPropertyName: string;

  // Sync Configuration
  syncMode: SyncMode;
  syncOnSave: boolean;
  syncDebounceMs: number;
  syncIntervalMinutes: number;
  conflictResolution: ConflictResolution;
  syncAttachments: boolean;
  syncOnStartup: boolean;

  // Features
  enableChat: boolean;
  enableSearch: boolean;
  enableTransformations: boolean;
  enablePodcasts: boolean;

  // UI Preferences
  chatSidebarPosition: 'left' | 'right';
  defaultSearchMode: 'text' | 'vector';
  showSyncStatus: boolean;
  showNotifications: boolean;

  // Advanced
  apiVersion?: string;
  enableDebugLogging: boolean;
  requestTimeout: number;
  retryAttempts: number;
  excludedFolders: string[];

  // Model Selection
  defaultChatModel?: string;  // Override for chat operations
  defaultTransformationModel?: string;  // Override for transformations
  largeContextModel?: string;  // Override for large context operations

  // Processing Options
  autoDeleteFiles: boolean;
  preferredLanguage: string;

  // Mobile Settings
  mobileOptimized: boolean;
  disableHeavyFeaturesOnMobile: boolean;
  increasedTouchTargets: boolean;

  // Cache
  cachedNotebooks?: CachedNotebook[];
  lastSyncTimestamp?: number;

  // Content Sync Mappings
  sourceMappings?: Record<string, {
    filePath: string;
    sourceId: string;
    lastSynced: number;
    hash: string;
  }>;
  autoSyncOnSave?: boolean;

  // Offline Queue
  offlineQueue?: SyncOperation[];

  // Feature Detection
  detectedFeatures?: DetectedFeatures;
}

export enum NotebookMappingStrategy {
  FOLDER = 'folder',
  TAG = 'tag',
  PROPERTY = 'property'
}

export enum SyncMode {
  REALTIME = 'realtime',
  MANUAL = 'manual',
  INTERVAL = 'interval'
}

export enum ConflictResolution {
  OBSIDIAN_WINS = 'obsidian-wins',
  SERVER_WINS = 'server-wins',
  ASK_USER = 'ask-user'
}

export interface CachedNotebook {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  created: Date;
  updated: Date;
  sourceCount: number;
  noteCount: number;
  localPath?: string;
  syncEnabled: boolean;
  lastSynced?: Date;
  cachedAt: number;
}

export const DEFAULT_SETTINGS: OpenNotebookSettings = {
  apiEndpoint: 'http://localhost:8000',
  apiPassword: '',
  connectionStatus: 'disconnected',

  mappingStrategy: NotebookMappingStrategy.FOLDER,
  folderToNotebook: {},
  notebookTagPrefix: 'on-notebook/',
  notebookPropertyName: 'notebook',

  syncMode: SyncMode.REALTIME,
  syncOnSave: true,
  syncDebounceMs: 2000,
  syncIntervalMinutes: 5,
  conflictResolution: ConflictResolution.OBSIDIAN_WINS,
  syncAttachments: true,
  syncOnStartup: true,

  enableChat: true,
  enableSearch: true,
  enableTransformations: true,
  enablePodcasts: false,

  chatSidebarPosition: 'right',
  defaultSearchMode: 'vector',
  showSyncStatus: true,
  showNotifications: true,

  enableDebugLogging: false,
  requestTimeout: 30000,
  retryAttempts: 3,
  excludedFolders: ['Generated Podcasts'],

  // Model defaults (use API defaults if not set)
  defaultChatModel: undefined,
  defaultTransformationModel: undefined,
  largeContextModel: undefined,

  // Processing options
  autoDeleteFiles: false,
  preferredLanguage: 'en',

  // Mobile settings
  mobileOptimized: true,
  disableHeavyFeaturesOnMobile: true,
  increasedTouchTargets: true,

  sourceMappings: {},
  autoSyncOnSave: true
};
