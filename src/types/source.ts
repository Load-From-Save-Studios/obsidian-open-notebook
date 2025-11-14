// Internal source types

export interface Source {
  id: string;
  title?: string;
  topics?: string[];
  asset?: Asset;
  fullText?: string;
  embedded: boolean;
  embeddedChunks: number;
  created: Date;
  updated: Date;
  notebooks?: string[];

  // Processing status
  status?: SourceStatus;
  processingError?: string;
}

export interface Asset {
  type: string; // 'pdf', 'video', 'audio', 'url', 'text'
  url?: string;
  filePath?: string;
  size?: number;
  mimeType?: string;
}

export interface SourceStatus {
  state: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface SourceCreate {
  notebookId?: string;
  notebooks?: string[];
  type: string;
  url?: string;
  filePath?: string;
  content?: string;
  title?: string;
  transformations?: string[];
  embed: boolean;
  deleteSource: boolean;
  asyncProcessing: boolean;
}

export interface SourceUpdate {
  title?: string;
  topics?: string[];
}
