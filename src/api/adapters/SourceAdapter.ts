// Adapter to convert between API and internal source types
import { APISource } from '../types';
import { Source, SourceStatus } from '../../types/source';

export class SourceAdapter {
  /**
   * Convert API source response to internal type
   */
  public static fromAPI(apiSource: APISource): Source {
    return {
      id: apiSource.id,
      title: apiSource.title,
      topics: apiSource.topics,
      asset: apiSource.asset ? {
        type: apiSource.asset.type,
        url: apiSource.asset.url,
        filePath: apiSource.asset.file_path,
        size: apiSource.asset.size,
        mimeType: apiSource.asset.mime_type
      } : undefined,
      fullText: apiSource.full_text,
      embedded: apiSource.embedded,
      embeddedChunks: apiSource.embedded_chunks,
      created: new Date(apiSource.created),
      updated: new Date(apiSource.updated),
      notebooks: apiSource.notebooks,
      status: this.parseSourceStatus(apiSource.status),
      processingError: apiSource.processing_error
    };
  }

  /**
   * Convert multiple API sources to internal type
   */
  public static fromAPIList(apiSources: APISource[]): Source[] {
    return apiSources.map(apiSource => SourceAdapter.fromAPI(apiSource));
  }

  /**
   * Parse source status string to SourceStatus
   */
  private static parseSourceStatus(status?: string): SourceStatus | undefined {
    if (!status) return undefined;

    // Map status strings to our enum
    const stateMap: Record<string, SourceStatus['state']> = {
      'pending': 'pending',
      'processing': 'processing',
      'completed': 'completed',
      'failed': 'failed'
    };

    return {
      state: stateMap[status] || 'pending',
      message: status
    };
  }
}
