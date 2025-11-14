// Chat view for AI conversations
import { ItemView, WorkspaceLeaf } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { ChatSession, ChatMessage, APIChatMessage } from '../types/chat';
import { ChatAdapter } from '../api/adapters/ChatAdapter';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export const VIEW_TYPE_CHAT = 'open-notebook-chat';

export class ChatView extends ItemView {
  private plugin: OpenNotebookPlugin;
  private chatAdapter: ChatAdapter;
  private currentSession: ChatSession | null = null;
  private currentNotebookId: string | null = null;

  // UI elements
  private headerEl: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendButtonEl: HTMLButtonElement;
  private contextEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: OpenNotebookPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.chatAdapter = new ChatAdapter();
  }

  getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText(): string {
    return 'Open Notebook Chat';
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('open-notebook-chat-view');

    // Create header
    this.headerEl = container.createDiv({ cls: 'chat-header' });
    this.renderHeader();

    // Create context indicator
    this.contextEl = container.createDiv({ cls: 'chat-context' });
    this.contextEl.setText('No notebook selected');

    // Create messages container
    this.messagesEl = container.createDiv({ cls: 'chat-messages' });

    // Create input area
    const inputContainer = container.createDiv({ cls: 'chat-input-container' });

    this.inputEl = inputContainer.createEl('textarea', {
      cls: 'chat-input',
      attr: {
        placeholder: 'Type your message...',
        rows: '3'
      }
    });

    this.sendButtonEl = inputContainer.createEl('button', {
      cls: 'chat-send-button',
      text: 'Send'
    });

    // Event listeners
    this.sendButtonEl.addEventListener('click', () => this.handleSend());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter sends message, Shift+Enter creates new line
        e.preventDefault();
        this.handleSend();
      }
    });

    logger.info('Chat view opened');
  }

  async onClose(): Promise<void> {
    logger.info('Chat view closed');
  }

  /**
   * Set the context for the chat (notebook)
   */
  public async setNotebook(notebookId: string): Promise<void> {
    this.currentNotebookId = notebookId;

    try {
      const notebook = await this.plugin.getNotebookManager().getNotebook(notebookId);

      if (notebook) {
        this.contextEl.setText(`📚 ${notebook.name}`);

        // Load or create session for this notebook
        await this.loadOrCreateSession(notebookId);

        // Enable input
        this.inputEl.disabled = false;
        this.sendButtonEl.disabled = false;
      } else {
        this.contextEl.setText('⚠ Notebook not found');
      }
    } catch (error) {
      logger.error('Failed to set notebook context', error);
      NoticeHelper.error('Failed to load notebook');
    }
  }

  /**
   * Show "not linked" state when current file is not in a linked folder
   */
  public showNotLinked(): void {
    this.currentNotebookId = null;
    this.currentSession = null;

    this.contextEl.setText('⚠ Not linked to Open Notebook');
    this.messagesEl.empty();

    // Show helpful message in chat area
    const messageEl = this.messagesEl.createDiv({
      cls: 'chat-not-linked-message'
    });
    messageEl.createEl('p', {
      text: '📁 This folder is not linked to an Open Notebook.'
    });
    messageEl.createEl('p', {
      text: 'Right-click the folder in the file explorer to create or link a notebook.'
    });

    // Disable input
    this.inputEl.disabled = true;
    this.sendButtonEl.disabled = true;
    this.inputEl.placeholder = 'Link a folder to enable chat...';

    this.headerEl.empty();
    const titleEl = this.headerEl.createDiv({ cls: 'chat-title' });
    titleEl.setText('Open Notebook Chat');
  }

  /**
   * Load existing session or create new one
   */
  private async loadOrCreateSession(notebookId: string): Promise<void> {
    // Show loading state
    this.messagesEl.empty();
    const loadingEl = this.createLoadingElement();
    this.messagesEl.appendChild(loadingEl);

    // Update loading message
    const contentEl = loadingEl.querySelector('.chat-message-content');
    if (contentEl) {
      const spinner = contentEl.querySelector('.chat-loading-spinner');
      if (spinner) {
        contentEl.empty();
        contentEl.createSpan({ cls: 'chat-loading-spinner', text: '●●●' });
        contentEl.createSpan({ text: ' Loading chat session...' });
      }
    }

    try {
      const client = this.plugin.getAPIClient();
      let apiSessions: any[] = [];

      // Try to get existing sessions
      try {
        apiSessions = await client.getChatSessions(notebookId);
      } catch (error: any) {
        // If 404, it might mean no sessions exist yet
        if (error.statusCode === 404) {
          apiSessions = [];
        } else {
          throw error;
        }
      }

      if (apiSessions.length > 0) {
        // Load the most recent session
        const latestSession = apiSessions[0];
        this.currentSession = this.chatAdapter.fromAPI(latestSession);

        // Update loading message
        if (contentEl) {
          contentEl.empty();
          contentEl.createSpan({ cls: 'chat-loading-spinner', text: '●●●' });
          contentEl.createSpan({ text: ' Loading messages...' });
        }

        // Try to get full session details which might include messages
        try {
          const fullSession = await client.getChatSession(this.currentSession.id);

          // Check if session includes messages
          if (fullSession.messages && Array.isArray(fullSession.messages)) {
            this.currentSession.messages = fullSession.messages.map((msg: any) => {
              const apiMessage: APIChatMessage = {
                id: msg.id,
                role: msg.role || (msg.type === 'human' ? 'user' : msg.type === 'ai' ? 'assistant' : 'system'),
                content: msg.content,
                timestamp: msg.timestamp,
                sources: msg.sources || []
              };
              return this.chatAdapter.messageFromAPI(apiMessage);
            });
            this.renderMessages();
          } else {
            // Try the messages endpoint as fallback
            try {
              const apiMessages = await client.getChatMessages(this.currentSession.id);
              this.currentSession.messages = apiMessages.map((msg: any) => {
                const apiMessage: APIChatMessage = {
                  id: msg.id,
                  role: msg.role || (msg.type === 'human' ? 'user' : msg.type === 'ai' ? 'assistant' : 'system'),
                  content: msg.content,
                  timestamp: msg.timestamp,
                  sources: msg.sources || []
                };
                return this.chatAdapter.messageFromAPI(apiMessage);
              });
              this.renderMessages();
            } catch (msgError: any) {
              if (msgError.statusCode === 404) {
                this.currentSession.messages = [];
                this.renderMessages();
              } else {
                throw msgError;
              }
            }
          }
        } catch (sessionError: any) {
          logger.error('Failed to get session details', sessionError);
          // Fall back to empty messages
          this.currentSession.messages = [];
          this.renderMessages();
        }
      } else {
        // Create new session
        try {
          // Update loading message
          if (contentEl) {
            contentEl.empty();
            contentEl.createSpan({ cls: 'chat-loading-spinner', text: '●●●' });
            contentEl.createSpan({ text: ' Creating new chat session...' });
          }

          // Use model override from settings if configured
          const modelOverride = this.plugin.settings.defaultChatModel;

          const apiSession = await client.createChatSession({
            notebook_id: notebookId,
            title: 'New Chat',
            model_override: modelOverride
          });

          this.currentSession = this.chatAdapter.fromAPI(apiSession);
          this.messagesEl.empty();
        } catch (createError: any) {
          logger.error('Failed to create session', createError);
          throw createError;
        }
      }

      // Remove loading indicator
      loadingEl.remove();

      this.renderHeader();
    } catch (error: any) {
      logger.error('Failed to load/create session', error);
      const errorMsg = error.message || 'Unknown error';
      NoticeHelper.error(`Failed to load chat session: ${errorMsg}`);

      // Remove loading indicator on error
      loadingEl.remove();

      // Show error message in chat
      this.messagesEl.empty();
      const errorEl = this.messagesEl.createDiv({
        cls: 'chat-error-message'
      });
      errorEl.createEl('p', {
        text: '⚠️ Failed to load chat session'
      });
      errorEl.createEl('p', {
        text: errorMsg,
        cls: 'chat-error-details'
      });
    }
  }

  /**
   * Handle send button click
   */
  private async handleSend(): Promise<void> {
    const message = this.inputEl.value.trim();

    if (!message) {
      return;
    }

    if (!this.currentSession) {
      NoticeHelper.warn('Please select a notebook first');
      return;
    }

    // Disable input
    this.inputEl.disabled = true;
    this.sendButtonEl.disabled = true;
    this.inputEl.value = '';

    // Add user message immediately
    this.addUserMessage(message);

    // Add loading indicator
    const loadingEl = this.createLoadingElement();
    this.messagesEl.appendChild(loadingEl);
    this.scrollToBottom();

    try {
      const client = this.plugin.getAPIClient();

      // Build context for the chat
      const context: { notebook_id?: string; source_id?: string } = {};
      if (this.currentNotebookId) {
        context.notebook_id = this.currentNotebookId;
      }

      // Send message and get full conversation
      const response = await client.sendMessage(this.currentSession.id, message, context);

      // Remove loading indicator
      loadingEl.remove();

      // Convert API messages to internal format
      if (response.messages && Array.isArray(response.messages)) {
        this.currentSession.messages = response.messages.map((msg: any) => {
          // Convert API format (with 'type' field) to internal APIChatMessage format (with 'role' field)
          const apiMessage: APIChatMessage = {
            id: msg.id,
            role: msg.type === 'human' ? 'user' : msg.type === 'ai' ? 'assistant' : 'system',
            content: msg.content,
            timestamp: msg.timestamp,
            sources: msg.sources || []
          };
          // Use adapter to convert to internal format
          return this.chatAdapter.messageFromAPI(apiMessage);
        });

        // Find the latest AI message to animate
        const latestAiMessage = [...this.currentSession.messages].reverse().find(m => m.role === 'assistant');

        if (latestAiMessage) {
          // Create empty AI message element
          const aiMessageEl = this.createMessageElement('assistant', '');
          this.messagesEl.appendChild(aiMessageEl);

          // Animate the response letter by letter
          await this.animateMessageContent(aiMessageEl, latestAiMessage.content);
        }
      }

    } catch (error) {
      logger.error('Failed to send message', error);
      NoticeHelper.error('Failed to send message');
      // Remove loading indicator on error
      loadingEl.remove();
    } finally {
      // Re-enable input
      this.inputEl.disabled = false;
      this.sendButtonEl.disabled = false;
      this.inputEl.focus();
    }
  }

  /**
   * Add user message to UI
   */
  private addUserMessage(content: string): void {
    const messageEl = this.createMessageElement('user', content);
    this.messagesEl.appendChild(messageEl);
    this.scrollToBottom();
  }

  /**
   * Create a message element
   */
  private createMessageElement(role: 'user' | 'assistant' | 'system', content: string): HTMLElement {
    const messageEl = this.messagesEl.createDiv({
      cls: `chat-message chat-message-${role}`
    });

    const roleEl = messageEl.createDiv({ cls: 'chat-message-role' });
    roleEl.setText(role === 'user' ? 'You' : 'AI');

    const contentEl = messageEl.createDiv({ cls: 'chat-message-content' });
    contentEl.setText(content);

    return messageEl;
  }

  /**
   * Update message content (for streaming)
   */
  private updateMessageContent(messageEl: HTMLElement, content: string): void {
    const contentEl = messageEl.querySelector('.chat-message-content');
    if (contentEl) {
      contentEl.setText(content);
    }
  }

  /**
   * Render all messages
   */
  private renderMessages(): void {
    this.messagesEl.empty();

    if (!this.currentSession || !this.currentSession.messages) {
      return;
    }

    for (const message of this.currentSession.messages) {
      const messageEl = this.createMessageElement(message.role, message.content);
      this.messagesEl.appendChild(messageEl);
    }

    this.scrollToBottom();
  }

  /**
   * Render header
   */
  private renderHeader(): void {
    this.headerEl.empty();

    const titleEl = this.headerEl.createDiv({ cls: 'chat-title' });
    titleEl.setText(this.currentSession?.title || 'Open Notebook Chat');

    // Add new session button
    const newSessionBtn = this.headerEl.createEl('button', {
      cls: 'chat-new-session-button',
      text: '+ New'
    });

    newSessionBtn.addEventListener('click', async () => {
      if (this.currentNotebookId) {
        await this.createNewSession(this.currentNotebookId);
      }
    });
  }

  /**
   * Create a new chat session
   */
  private async createNewSession(notebookId: string): Promise<void> {
    try {
      const client = this.plugin.getAPIClient();

      // Use model override from settings if configured
      const modelOverride = this.plugin.settings.defaultChatModel;

      const apiSession = await client.createChatSession({
        notebook_id: notebookId,
        title: 'New Chat',
        model_override: modelOverride
      });

      this.currentSession = this.chatAdapter.fromAPI(apiSession);
      this.messagesEl.empty();
      this.renderHeader();

      NoticeHelper.success('New chat session created');
    } catch (error) {
      logger.error('Failed to create new session', error);
      NoticeHelper.error('Failed to create new session');
    }
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /**
   * Create loading indicator element
   */
  private createLoadingElement(): HTMLElement {
    const loadingEl = this.messagesEl.createDiv({
      cls: 'chat-message chat-message-assistant chat-loading'
    });

    const roleEl = loadingEl.createDiv({ cls: 'chat-message-role' });
    roleEl.setText('AI');

    const contentEl = loadingEl.createDiv({ cls: 'chat-message-content' });
    const spinner = contentEl.createSpan({ cls: 'chat-loading-spinner' });
    spinner.setText('●●●');

    return loadingEl;
  }

  /**
   * Animate message content letter by letter
   */
  private async animateMessageContent(messageEl: HTMLElement, content: string): Promise<void> {
    const contentEl = messageEl.querySelector('.chat-message-content') as HTMLElement;
    if (!contentEl) return;

    // Characters per batch for smoother animation
    const charsPerBatch = 2;
    const delayMs = 10; // milliseconds between batches

    let currentIndex = 0;

    while (currentIndex < content.length) {
      const nextIndex = Math.min(currentIndex + charsPerBatch, content.length);
      const textChunk = content.substring(0, nextIndex);
      contentEl.setText(textChunk);
      this.scrollToBottom();

      currentIndex = nextIndex;

      if (currentIndex < content.length) {
        await this.sleep(delayMs);
      }
    }
  }

  /**
   * Sleep utility for animation
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
