// Adapter for converting between API chat types and internal types
import {
  ChatSession,
  ChatMessage,
  SourceReference,
  APIChatSession,
  APIChatMessage,
  APISourceReference
} from '../../types/chat';

export class ChatAdapter {
  /**
   * Convert API chat session to internal type
   */
  public fromAPI(apiSession: APIChatSession): ChatSession {
    return {
      id: apiSession.id,
      title: apiSession.title,
      notebookId: apiSession.notebook_id,
      sourceId: apiSession.source_id,
      modelOverride: apiSession.model_override,
      created: new Date(apiSession.created),
      updated: new Date(apiSession.updated),
      messages: []
    };
  }

  /**
   * Convert API chat message to internal type
   */
  public messageFromAPI(apiMessage: APIChatMessage): ChatMessage {
    return {
      id: apiMessage.id,
      role: apiMessage.role,
      content: apiMessage.content,
      timestamp: new Date(apiMessage.timestamp),
      sources: apiMessage.sources?.map(s => this.sourceRefFromAPI(s))
    };
  }

  /**
   * Convert API source reference to internal type
   */
  private sourceRefFromAPI(apiRef: APISourceReference): SourceReference {
    return {
      sourceId: apiRef.source_id,
      title: apiRef.title,
      excerpt: apiRef.excerpt
    };
  }

  /**
   * Convert internal session to API format (for updates)
   */
  public toAPI(session: ChatSession): Partial<APIChatSession> {
    return {
      title: session.title,
      notebook_id: session.notebookId,
      source_id: session.sourceId,
      model_override: session.modelOverride
    };
  }
}
