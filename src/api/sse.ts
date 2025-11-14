// Server-Sent Events handler for streaming responses
import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { logger } from '../utils/Logger';

export class SSEHandler {
  /**
   * Stream events from an SSE endpoint
   * @param url The SSE endpoint URL
   * @param options Request options
   * @yields Parsed event data
   */
  async *streamEvents(url: string, options: RequestUrlParam): AsyncGenerator<any> {
    logger.debug(`Starting SSE stream from: ${url}`);

    try {
      // Note: Obsidian's requestUrl doesn't natively support streaming
      // We'll use a workaround with chunked responses
      const response: RequestUrlResponse = await requestUrl({
        ...options,
        url,
        headers: {
          ...options.headers,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      // Parse the complete response as SSE format
      const text = response.text;
      const lines = text.split('\n');
      let currentEvent: any = {};

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            // Try to parse as JSON
            const parsed = JSON.parse(data);
            yield parsed;
          } catch {
            // If not JSON, yield as string
            if (data && data !== '[DONE]') {
              yield { type: 'message', data };
            }
          }
        } else if (line.startsWith('event: ')) {
          currentEvent.event = line.slice(7);
        } else if (line === '') {
          // Empty line marks end of event
          if (currentEvent.event) {
            yield currentEvent;
            currentEvent = {};
          }
        }
      }

      logger.debug('SSE stream completed');
    } catch (error) {
      logger.error('SSE stream error', error);
      throw error;
    }
  }

  /**
   * Stream chat responses using async iteration
   * This is a simplified version that works with Obsidian's limitations
   */
  async *streamChatResponse(
    url: string,
    sessionId: string,
    message: string,
    context: { notebook_id?: string; source_id?: string },
    headers: Record<string, string>
  ): AsyncGenerator<string> {
    logger.debug('Streaming chat response');

    const payload = {
      session_id: sessionId,
      message,
      context
    };

    console.log('[SSE Debug] Streaming chat to URL:', url);
    console.log('[SSE Debug] Payload:', payload);
    console.log('[SSE Debug] Headers:', headers);

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload),
        throw: false  // Don't throw on error status, let us handle it
      });

      console.log('[SSE Debug] Response status:', response.status);
      console.log('[SSE Debug] Response headers:', response.headers);

      if (response.status >= 400) {
        console.error('[SSE Debug] Error response body:', response.text);
        console.error('[SSE Debug] Error response JSON:', response.json);
        throw new Error(`Chat API error ${response.status}: ${JSON.stringify(response.json)}`);
      }

      // Parse response - could be SSE or JSON
      const text = response.text;
      console.log('[SSE Debug] Full response text length:', text.length);
      console.log('[SSE Debug] First 500 chars:', text.substring(0, 500));

      // Check if response is JSON (not SSE)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        console.log('[SSE Debug] Response is JSON, not SSE - parsing as conversation response');
        try {
          const jsonResponse = JSON.parse(text);
          console.log('[SSE Debug] Parsed JSON response:', jsonResponse);

          // Extract the latest AI message from the messages array
          if (jsonResponse.messages && Array.isArray(jsonResponse.messages)) {
            console.log(`[SSE Debug] Found ${jsonResponse.messages.length} messages in response`);

            // Find the last AI message
            for (let i = jsonResponse.messages.length - 1; i >= 0; i--) {
              const msg = jsonResponse.messages[i];
              if (msg.type === 'ai' && msg.content) {
                console.log('[SSE Debug] Found latest AI message:', msg);
                console.log('[SSE Debug] Yielding AI content:', msg.content);
                yield msg.content;
                return;
              }
            }
          }

          console.warn('[SSE Debug] No AI message found in response');
        } catch (e) {
          console.error('[SSE Debug] Failed to parse JSON response:', e);
        }
        return;
      }

      // Original SSE parsing logic
      const lines = text.split('\n');
      console.log('[SSE Debug] Total lines:', lines.length);

      let chunkCount = 0;
      for (const line of lines) {
        console.log('[SSE Debug] Processing line:', line.substring(0, 100));

        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          console.log('[SSE Debug] Extracted data:', data);

          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              console.log('[SSE Debug] Parsed JSON:', parsed);

              if (parsed.content) {
                chunkCount++;
                console.log(`[SSE Debug] Yielding chunk ${chunkCount}:`, parsed.content);
                yield parsed.content;
              } else if (typeof parsed === 'string') {
                chunkCount++;
                console.log(`[SSE Debug] Yielding string chunk ${chunkCount}:`, parsed);
                yield parsed;
              } else {
                console.warn('[SSE Debug] Parsed object has no content field:', parsed);
              }
            } catch (e) {
              // Not JSON, yield as-is
              chunkCount++;
              console.log(`[SSE Debug] Yielding raw data chunk ${chunkCount}:`, data);
              yield data;
            }
          }
        }
      }

      console.log(`[SSE Debug] Total chunks yielded: ${chunkCount}`);
    } catch (error) {
      console.error('[SSE Debug] Chat stream error:', error);
      logger.error('Chat stream error', error);
      throw error;
    }
  }
}
