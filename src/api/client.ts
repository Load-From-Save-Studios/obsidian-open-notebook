// Main API client for Open Notebook
import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { AuthManager } from './auth';
import { SSEHandler } from './sse';
import { logger } from '../utils/Logger';
import {
  APINotebook,
  APISource,
  APINote,
  APIInsight,
  APIHealthResponse,
  APIErrorResponse,
  RequestOptions,
  APITransformation,
  TransformRequest,
  TransformResponse,
  APIModelDefaults,
  APIModel
} from './types';
import { APIChatSession, APIChatMessage } from '../types/chat';
import { SearchRequest, SearchResult } from '../types/search';
import { APIPodcastEpisode, PodcastGenerateRequest, PodcastGenerateResponse, APIEpisodeProfile, APISpeakerProfile } from '../types/podcast';

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public endpoint: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class OpenNotebookClient {
  private endpoint: string;
  private authManager: AuthManager;
  private sseHandler: SSEHandler;
  private timeout: number;
  private retryAttempts: number;

  // Cache with TTL
  private modelDefaultsCache: APIModelDefaults | null = null;
  private notebooksCache: CacheEntry<APINotebook[]> | null = null;
  private transformationsCache: CacheEntry<APITransformation[]> | null = null;
  private episodeProfilesCache: CacheEntry<APIEpisodeProfile[]> | null = null;
  private speakerProfilesCache: CacheEntry<APISpeakerProfile[]> | null = null;

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(
    endpoint: string,
    password: string,
    timeout: number = 30000,
    retryAttempts: number = 3
  ) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.authManager = new AuthManager(password);
    this.sseHandler = new SSEHandler();
    this.timeout = timeout;
    this.retryAttempts = retryAttempts;
  }

  public setPassword(password: string): void {
    this.authManager.setPassword(password);
  }

  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  public setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  public setRetryAttempts(attempts: number): void {
    this.retryAttempts = attempts;
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
    if (!cache) return false;
    const now = Date.now();
    return (now - cache.timestamp) < cache.ttl;
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.modelDefaultsCache = null;
    this.notebooksCache = null;
    this.transformationsCache = null;
    this.episodeProfilesCache = null;
    this.speakerProfilesCache = null;
    logger.debug('All caches cleared');
  }

  /**
   * Clear specific cache
   */
  public clearNotebooksCache(): void {
    this.notebooksCache = null;
  }

  public clearTransformationsCache(): void {
    this.transformationsCache = null;
  }

  /**
   * Test connection to the API
   */
  public async testConnection(): Promise<boolean> {
    try {
      const response = await this.request<APIHealthResponse>('/health', {
        method: 'GET'
      });
      logger.info('Connection test successful', response);
      return true;
    } catch (error) {
      logger.error('Connection test failed', error);
      return false;
    }
  }

  /**
   * Authenticate with the API
   */
  public async authenticate(): Promise<boolean> {
    // Note: Some Open Notebook instances may not require a password
    // We'll test by trying to fetch notebooks
    try {
      await this.getNotebooks();
      logger.info('Authentication successful');
      return true;
    } catch (error) {
      logger.error('Authentication failed', error);
      return false;
    }
  }

  /**
   * Get API version
   */
  public async getApiVersion(): Promise<string> {
    try {
      const response = await this.request<APIHealthResponse>('/health');
      return response.version || 'unknown';
    } catch (error) {
      logger.error('Failed to get API version', error);
      return 'unknown';
    }
  }

  // Notebook methods

  public async getNotebooks(archived?: boolean, skipCache = false): Promise<APINotebook[]> {
    // Only cache non-archived requests
    if (!archived && !skipCache && this.isCacheValid(this.notebooksCache)) {
      logger.debug('Returning cached notebooks');
      return this.notebooksCache!.data;
    }

    const params = archived !== undefined ? `?archived=${archived}` : '';
    const notebooks = await this.request<APINotebook[]>(`/api/notebooks${params}`);

    // Cache non-archived results
    if (!archived) {
      this.notebooksCache = {
        data: notebooks,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL
      };
      logger.debug(`Cached ${notebooks.length} notebooks`);
    }

    return notebooks;
  }

  public async getNotebook(id: string): Promise<APINotebook> {
    return this.request<APINotebook>(`/api/notebooks/${id}`);
  }

  public async createNotebook(data: {
    name: string;
    description?: string;
  }): Promise<APINotebook> {
    return this.request<APINotebook>('/api/notebooks', {
      method: 'POST',
      body: data
    });
  }

  public async updateNotebook(
    id: string,
    data: { name?: string; description?: string; archived?: boolean }
  ): Promise<APINotebook> {
    return this.request<APINotebook>(`/api/notebooks/${id}`, {
      method: 'PUT',
      body: data
    });
  }

  public async deleteNotebook(id: string): Promise<void> {
    await this.request<void>(`/api/notebooks/${id}`, {
      method: 'DELETE'
    });
  }

  // Source methods

  public async getSources(notebookId?: string): Promise<APISource[]> {
    const params = notebookId ? `?notebook_id=${notebookId}` : '';
    return this.request<APISource[]>(`/api/sources${params}`);
  }

  public async getSource(id: string): Promise<APISource> {
    return this.request<APISource>(`/api/sources/${id}`);
  }

  public async createSource(data: {
    type: string;
    title: string;
    full_text?: string;
    content?: string;
    asset?: {
      type: string;
      file_path?: string;
      url?: string;
    };
    notebooks?: string[];
    embed?: boolean;
  }): Promise<APISource> {
    try {
      // Call makeRequest directly to bypass retry logic
      // (retrying creates duplicate sources due to asyncio bug)
      return await this.makeRequest<APISource>('/api/sources/json', {
        method: 'POST',
        body: data
      });
    } catch (error) {
      // Workaround for Open Notebook backend bug where sync processing fails
      // but the source is still created successfully.
      // Backend error: "asyncio.run() cannot be called from a running event loop"
      // This happens because the backend uses execute_command_sync which calls
      // asyncio.run() while already in FastAPI's async event loop.
      if (error instanceof APIError &&
          error.statusCode === 500 &&
          error.message.includes('asyncio.run()')) {

        logger.debug('Known backend asyncio bug detected - verifying source creation');

        // Wait for source to be fully created in database
        await this.sleep(1000);

        // Find the newly created source by title and notebook
        const notebookId = data.notebooks?.[0];
        if (notebookId) {
          const sources = await this.getSources(notebookId);

          // Filter sources by title and sort by updated/created timestamp to get the most recent
          const matchingSources = sources.filter(s => s.title === data.title);

          if (matchingSources.length > 0) {
            // Sort by updated timestamp (most recent first), fall back to created timestamp
            matchingSources.sort((a, b) => {
              const timeA = new Date(a.updated || a.created).getTime();
              const timeB = new Date(b.updated || b.created).getTime();
              return timeB - timeA; // Descending order (newest first)
            });

            const newSource = matchingSources[0]; // Get the most recent one
            logger.info(`Source created successfully (backend asyncio error ignored): ${newSource.id}`);
            return newSource;
          }
        }

        // If we can't find it, re-throw the original error
        logger.error('Failed to verify source creation after backend error');
        throw error;
      }

      throw error;
    }
  }

  /**
   * Update source metadata (title and topics only)
   * Note: Open Notebook API does not support updating source content.
   * To update content, you must delete and recreate the source.
   */
  public async updateSource(
    id: string,
    data: {
      title?: string;
      topics?: string[];
    }
  ): Promise<APISource> {
    return this.request<APISource>(`/api/sources/${id}`, {
      method: 'PUT',
      body: data
    });
  }

  public async deleteSource(id: string): Promise<void> {
    await this.request<void>(`/api/sources/${id}`, {
      method: 'DELETE'
    });
  }

  // Note methods

  public async getNotes(notebookId?: string): Promise<APINote[]> {
    const params = notebookId ? `?notebook_id=${notebookId}` : '';
    return this.request<APINote[]>(`/api/notes${params}`);
  }

  public async getNote(id: string): Promise<APINote> {
    return this.request<APINote>(`/api/notes/${id}`);
  }

  public async createNote(data: {
    title?: string;
    content: string;
    note_type?: 'human' | 'ai';
    notebook_id?: string;
  }): Promise<APINote> {
    return this.request<APINote>('/api/notes', {
      method: 'POST',
      body: data
    });
  }

  public async updateNote(
    id: string,
    data: { title?: string; content?: string; note_type?: string }
  ): Promise<APINote> {
    return this.request<APINote>(`/api/notes/${id}`, {
      method: 'PUT',
      body: data
    });
  }

  public async deleteNote(id: string): Promise<void> {
    await this.request<void>(`/api/notes/${id}`, {
      method: 'DELETE'
    });
  }

  // Insight methods

  /**
   * Get insights for a specific source
   */
  public async getInsights(sourceId: string): Promise<APIInsight[]> {
    return this.request<APIInsight[]>(`/api/sources/${sourceId}/insights`);
  }

  /**
   * Get a single insight by ID
   */
  public async getInsight(id: string): Promise<APIInsight> {
    return this.request<APIInsight>(`/api/insights/${id}`);
  }

  /**
   * Generate an insight for a source using a transformation
   */
  public async generateInsight(sourceId: string, transformationId: string): Promise<APIInsight> {
    return this.request<APIInsight>(`/api/sources/${sourceId}/insights`, {
      method: 'POST',
      body: { transformation_id: transformationId }
    });
  }

  /**
   * Get available transformations for generating insights and text transformations
   */
  public async getTransformations(skipCache = false): Promise<APITransformation[]> {
    if (!skipCache && this.isCacheValid(this.transformationsCache)) {
      logger.debug('Returning cached transformations');
      return this.transformationsCache!.data;
    }

    const transformations = await this.request<APITransformation[]>('/api/transformations/');

    this.transformationsCache = {
      data: transformations,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };
    logger.debug(`Cached ${transformations.length} transformations`);

    return transformations;
  }

  /**
   * Get default models configuration
   */
  public async getModelDefaults(): Promise<APIModelDefaults> {
    if (this.modelDefaultsCache) {
      return this.modelDefaultsCache;
    }
    this.modelDefaultsCache = await this.request<APIModelDefaults>('/api/models/defaults');
    return this.modelDefaultsCache;
  }

  /**
   * Get list of available models
   */
  public async getAvailableModels(): Promise<APIModel[]> {
    try {
      return await this.request<APIModel[]>('/api/models');
    } catch (error) {
      // If the endpoint doesn't exist, return empty array
      // (older versions of Open Notebook may not have this endpoint)
      logger.warn('Failed to fetch available models, endpoint may not exist', error);
      return [];
    }
  }

  /**
   * Execute a transformation on text
   */
  public async executeTransformation(
    transformationId: string,
    text: string,
    modelOverride?: string
  ): Promise<TransformResponse> {
    // Determine which model to use
    let modelId: string;

    if (modelOverride) {
      // Use the override if provided
      modelId = modelOverride;
    } else {
      // Get the transformation to check if it has a model configured
      const transformations = await this.getTransformations();
      const transformation = transformations.find(t => t.id === transformationId);

      if (!transformation) {
        throw new Error(`Transformation ${transformationId} not found`);
      }

      if (transformation.model) {
        // Use the transformation's configured model
        modelId = transformation.model;
      } else {
        // Fall back to the default transformation model
        const defaults = await this.getModelDefaults();
        modelId = defaults.default_transformation_model;
      }
    }

    const body: any = {
      transformation_id: transformationId,
      input_text: text,
      model_id: modelId
    };

    return this.request<TransformResponse>('/api/transformations/execute', {
      method: 'POST',
      body
    });
  }

  /**
   * Delete an insight by ID
   */
  public async deleteInsight(id: string): Promise<void> {
    await this.request<void>(`/api/insights/${id}`, {
      method: 'DELETE'
    });
  }

  // Chat methods

  public async getChatSessions(notebookId: string): Promise<APIChatSession[]> {
    return this.request<APIChatSession[]>(`/api/chat/sessions?notebook_id=${notebookId}`);
  }

  public async getChatSession(sessionId: string): Promise<APIChatSession> {
    return this.request<APIChatSession>(`/api/chat/sessions/${sessionId}`);
  }

  public async createChatSession(data: {
    notebook_id: string;
    title?: string;
    model_override?: string;
  }): Promise<APIChatSession> {
    return this.request<APIChatSession>('/api/chat/sessions', {
      method: 'POST',
      body: data
    });
  }

  public async deleteChatSession(sessionId: string): Promise<void> {
    await this.request<void>(`/api/chat/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  public async getChatMessages(sessionId: string): Promise<APIChatMessage[]> {
    return this.request<APIChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`);
  }

  /**
   * Send a chat message and get the full conversation response
   */
  public async sendMessage(
    sessionId: string,
    message: string,
    context: { notebook_id?: string; source_id?: string }
  ): Promise<{ session_id: string; messages: APIChatMessage[] }> {
    const url = `${this.endpoint}/api/chat/execute`;

    logger.debug(`Sending chat message to session: ${sessionId}`);

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          ...this.authManager.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          context
        }),
        throw: false
      });

      if (response.status >= 400) {
        throw new Error(`Chat API error ${response.status}: ${JSON.stringify(response.json)}`);
      }

      const result = response.json as { session_id: string; messages: any[] };
      return result;
    } catch (error) {
      logger.error('Failed to send chat message', error);
      throw error;
    }
  }

  // Search methods

  /**
   * Search sources and notes
   */
  public async search(request: SearchRequest): Promise<SearchResult[]> {
    const body: any = {
      query: request.query,
      search_type: request.type,
      limit: request.limit,
      search_sources: request.searchSources,
      search_notes: request.searchNotes
    };

    if (request.minimumScore !== undefined) {
      body.minimum_score = request.minimumScore;
    }

    if (request.notebookId) {
      body.notebook_id = request.notebookId;
    }

    const response = await this.request<any>('/api/search', {
      method: 'POST',
      body
    });

    logger.debug('Search API response:', response);
    logger.debug('Search API response type:', typeof response);
    logger.debug('Search API response is array?', Array.isArray(response));

    // Handle different response formats from the API
    let results: any[] = [];

    if (Array.isArray(response)) {
      results = response;
    } else if (response && typeof response === 'object') {
      // API might return { results: [...] } or { sources: [...], notes: [...] }
      if (Array.isArray(response.results)) {
        results = response.results;
      } else if (response.sources || response.notes) {
        // Combine sources and notes if returned separately
        results = [
          ...(Array.isArray(response.sources) ? response.sources : []),
          ...(Array.isArray(response.notes) ? response.notes : [])
        ];
      } else {
        logger.warn('Unexpected search response format:', response);
        return [];
      }
    } else {
      logger.warn('Search returned non-array, non-object response:', response);
      return [];
    }

    logger.debug(`Found ${results.length} raw results from API`);
    if (results.length > 0) {
      logger.debug('First raw result:', results[0]);
      logger.debug('First result keys:', Object.keys(results[0]));
    }

    // Transform API results to our internal format
    return results.map((result, index) => {
      // Handle different score formats (might be 0-1 or 0-100, or similarity/distance/relevance)
      let score = 0;
      if (result.score !== undefined && result.score !== null) {
        score = result.score;
        logger.debug(`Result ${index} has score:`, score);
      } else if (result.similarity !== undefined) {
        score = result.similarity;
        logger.debug(`Result ${index} has similarity:`, score);
      } else if (result.distance !== undefined) {
        // Convert distance to similarity (assuming lower is better)
        score = Math.max(0, 1 - result.distance);
        logger.debug(`Result ${index} has distance:`, result.distance, 'converted to score:', score);
      } else if (result.relevance !== undefined) {
        // Text search returns relevance score
        score = result.relevance;
        logger.debug(`Result ${index} has relevance:`, score);
      } else {
        logger.warn(`Result ${index} has no score/similarity/distance/relevance field. Keys:`, Object.keys(result));
      }

      // Ensure score is between 0 and 1 (relevance scores are often 0-100)
      if (score > 1) {
        logger.debug(`Normalizing score from ${score} to ${score / 100}`);
        score = score / 100;
      }

      const content = result.content || result.full_text || result.text || '';
      const excerpt = result.excerpt || content.substring(0, 300) || '';

      logger.debug(`Result ${index} content length:`, content.length, 'excerpt length:', excerpt.length);

      const transformed = {
        id: result.id,
        type: result.type || (result.asset ? 'source' : 'note'),
        title: result.title || 'Untitled',
        excerpt: excerpt,
        score: score,
        highlights: result.highlights,
        metadata: {
          notebookId: result.notebook_id,
          topics: result.topics,
          created: result.created ? new Date(result.created) : undefined
        },
        content: content
      };

      logger.debug(`Transformed result ${index}:`, transformed);

      return transformed;
    });
  }

  /**
   * Ask a question and get an AI-generated answer
   */
  public async ask(query: string, notebookId?: string): Promise<string> {
    const body: any = {
      query
    };

    if (notebookId) {
      body.notebook_id = notebookId;
    }

    const response = await this.request<{ answer: string }>('/api/ask', {
      method: 'POST',
      body
    });

    return response.answer;
  }

  // Podcast methods

  /**
   * Generate a podcast for a notebook
   */
  public async generatePodcast(request: PodcastGenerateRequest): Promise<PodcastGenerateResponse> {
    return this.request<PodcastGenerateResponse>('/api/podcasts/generate', {
      method: 'POST',
      body: request
    });
  }

  /**
   * Get status of a podcast episode
   */
  public async getPodcastStatus(episodeId: string): Promise<APIPodcastEpisode> {
    return this.request<APIPodcastEpisode>(`/api/podcasts/episodes/${episodeId}`);
  }

  /**
   * Get all podcast episodes
   * Note: The backend does not filter by notebook_id.
   * Episodes are global and must be filtered client-side if needed.
   */
  public async getPodcastEpisodes(): Promise<APIPodcastEpisode[]> {
    return this.request<APIPodcastEpisode[]>('/api/podcasts/episodes');
  }

  /**
   * Download podcast audio file
   */
  public async downloadPodcastAudio(episodeId: string): Promise<ArrayBuffer> {
    const url = `${this.endpoint}/api/podcasts/episodes/${episodeId}/audio`;

    logger.debug(`Downloading podcast audio: ${episodeId}`);

    try {
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
          ...this.authManager.getAuthHeaders()
        },
        throw: false
      });

      if (response.status >= 400) {
        throw new Error(`Failed to download podcast: ${response.status}`);
      }

      return response.arrayBuffer;
    } catch (error) {
      logger.error('Failed to download podcast audio', error);
      throw error;
    }
  }

  /**
   * Delete a podcast episode
   */
  public async deletePodcastEpisode(episodeId: string): Promise<void> {
    await this.request<void>(`/api/podcasts/episodes/${episodeId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all episode profiles
   */
  public async getEpisodeProfiles(skipCache = false): Promise<APIEpisodeProfile[]> {
    if (!skipCache && this.isCacheValid(this.episodeProfilesCache)) {
      logger.debug('Returning cached episode profiles');
      return this.episodeProfilesCache!.data;
    }

    const profiles = await this.request<APIEpisodeProfile[]>('/api/episode-profiles');

    this.episodeProfilesCache = {
      data: profiles,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };
    logger.debug(`Cached ${profiles.length} episode profiles`);

    return profiles;
  }

  /**
   * Get all speaker profiles
   */
  public async getSpeakerProfiles(skipCache = false): Promise<APISpeakerProfile[]> {
    if (!skipCache && this.isCacheValid(this.speakerProfilesCache)) {
      logger.debug('Returning cached speaker profiles');
      return this.speakerProfilesCache!.data;
    }

    const profiles = await this.request<APISpeakerProfile[]>('/api/speaker-profiles');

    this.speakerProfilesCache = {
      data: profiles,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };
    logger.debug(`Cached ${profiles.length} speaker profiles`);

    return profiles;
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.withRetry(() => this.makeRequest<T>(path, options));
  }

  /**
   * Make single HTTP request
   */
  private async makeRequest<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.endpoint}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authManager.getAuthHeaders(),
      ...(options.headers || {})
    };

    const requestParams: RequestUrlParam = {
      url,
      method: options.method || 'GET',
      headers,
      throw: false // We handle errors manually
    };

    if (options.body) {
      requestParams.body = JSON.stringify(options.body);
    }

    logger.debug(`API Request: ${requestParams.method} ${url}`);

    try {
      const response: RequestUrlResponse = await requestUrl(requestParams);

      logger.debug(`API Response: ${response.status}`, response.json);

      if (response.status >= 200 && response.status < 300) {
        // Success
        if (response.status === 204 || !response.text) {
          return undefined as unknown as T;
        }
        return response.json as T;
      } else {
        // Error
        const errorBody = response.json as APIErrorResponse;
        const message = this.extractErrorMessage(errorBody);
        throw new APIError(response.status, message, path);
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      // Network or other error
      logger.error('Request failed', error);
      throw new APIError(0, error.message || 'Network error', path);
    }
  }

  /**
   * Extract error message from API response
   */
  private extractErrorMessage(errorBody: APIErrorResponse): string {
    if (typeof errorBody.detail === 'string') {
      return errorBody.detail;
    }

    if (Array.isArray(errorBody.detail)) {
      return errorBody.detail.map(e => e.msg).join(', ');
    }

    return 'Unknown error';
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on client errors (4xx)
      if (error instanceof APIError && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      if (attempt >= this.retryAttempts) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      logger.debug(`Retrying request (attempt ${attempt + 1}) after ${delay}ms`);

      await this.sleep(delay);
      return this.withRetry(fn, attempt + 1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
