// Internal notebook types

export interface Notebook {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  created: Date;
  updated: Date;
  sourceCount: number;
  noteCount: number;

  // Plugin-specific
  localPath?: string; // Obsidian folder path
  syncEnabled: boolean;
  lastSynced?: Date;
}

export interface NotebookCreate {
  name: string;
  description?: string;
}

export interface NotebookUpdate {
  name?: string;
  description?: string;
  archived?: boolean;
}

export interface CachedNotebook extends Notebook {
  cachedAt: number;
}
