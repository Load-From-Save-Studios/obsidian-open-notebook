// API response types from Open Notebook

export interface APINotebook {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  created: string;
  updated: string;
  source_count: number;
  note_count: number;
}

export interface APISource {
  id: string;
  title?: string;
  topics?: string[];
  asset?: APIAsset;
  full_text?: string;
  embedded: boolean;
  embedded_chunks: number;
  created: string;
  updated: string;
  notebooks?: string[];
  status?: string;
  processing_error?: string;
}

export interface APIAsset {
  type: string;
  url?: string;
  file_path?: string;
  size?: number;
  mime_type?: string;
}

export interface APINote {
  id: string;
  title?: string;
  content: string;
  note_type: 'human' | 'ai';
  created: string;
  updated: string;
  notebook_id?: string;
}

export interface APIInsight {
  id: string;
  title: string;
  content: string;
  insight_type: string;
  source_id: string;
  created: string;
  updated: string;
  notebook_id?: string;
  metadata?: {
    topics?: string[];
    confidence?: number;
  };
}

export interface APIHealthResponse {
  status: string;
  version?: string;
  features?: string[];
}

export interface APIErrorResponse {
  detail: string | { msg: string; type: string }[];
}

export interface APITransformation {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  is_system?: boolean;
  created: string;
  updated: string;
}

export interface TransformRequest {
  transformation_id: string;
  input_text: string;
  model_id?: string;
}

export interface TransformResponse {
  output: string;  // The API returns 'output', not 'result'
  transformation_id: string;
  model_id: string;
}

export interface APIModelDefaults {
  default_chat_model: string;
  default_transformation_model: string;
  large_context_model: string;
  default_text_to_speech_model: string;
  default_speech_to_text_model: string;
  default_embedding_model: string;
  default_tools_model: string;
}

export interface APIModel {
  id: string;
  name: string;
  provider: string;
  context_length?: number;
  supports_vision?: boolean;
  supports_tools?: boolean;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}
