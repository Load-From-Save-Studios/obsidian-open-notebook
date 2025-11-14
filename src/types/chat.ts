// Chat types for Open Notebook integration

export interface ChatSession {
  id: string;
  title: string;
  notebookId?: string;
  sourceId?: string;
  modelOverride?: string;
  created: Date;
  updated: Date;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: SourceReference[];
}

export interface SourceReference {
  sourceId: string;
  title: string;
  excerpt?: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  context?: {
    notebookId?: string;
    sourceIds?: string[];
  };
}

export interface ChatEvent {
  type: 'message' | 'context' | 'complete' | 'error';
  data: any;
}

export interface CreateSessionRequest {
  notebookId: string;
  title?: string;
}

// API response types
export interface APIChatSession {
  id: string;
  title: string;
  notebook_id?: string;
  source_id?: string;
  model_override?: string;
  created: string;
  updated: string;
  messages?: any[]; // Optional messages array that may be included in full session response
}

export interface APIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: APISourceReference[];
}

export interface APISourceReference {
  source_id: string;
  title: string;
  excerpt?: string;
}
