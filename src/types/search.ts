// Types for search functionality

export interface SearchRequest {
  query: string;
  type: 'text' | 'vector';
  limit: number;
  searchSources: boolean;
  searchNotes: boolean;
  minimumScore?: number;
  notebookId?: string;
}

export interface SearchResult {
  id: string;
  type: 'source' | 'note';
  title: string;
  excerpt: string;
  score: number;
  highlights?: string[];
  metadata?: {
    notebookId?: string;
    topics?: string[];
    created?: Date;
  };
  content?: string;
}

export interface AskRequest {
  query: string;
  notebookId?: string;
  streaming?: boolean;
}
