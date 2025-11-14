// Note types for Open Notebook integration

export interface Note {
  id: string;
  title?: string;
  content: string;
  noteType: 'human' | 'ai';
  created: Date;
  updated: Date;
  notebookId?: string;

  // Plugin-specific
  localPath?: string; // Path in vault
  checksum?: string; // For conflict detection
}

export interface NoteCreate {
  title?: string;
  content: string;
  noteType?: 'human' | 'ai';
  notebookId?: string;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  noteType?: string;
}

export interface NoteFrontmatter {
  on_notebook_id?: string;
  on_note_id?: string;
  on_source_id?: string;
  on_synced_at?: string;
  on_modified_at?: string;
  on_checksum?: string;
  on_sync_enabled?: boolean;
  on_topics?: string[];
  on_ai_generated?: boolean;
}
