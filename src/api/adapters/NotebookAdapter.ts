// Adapter to convert between API and internal notebook types
import { APINotebook } from '../types';
import { Notebook } from '../../types/notebook';

export class NotebookAdapter {
  /**
   * Convert API notebook response to internal type
   */
  public static fromAPI(apiNotebook: APINotebook, localPath?: string): Notebook {
    return {
      id: apiNotebook.id,
      name: apiNotebook.name,
      description: apiNotebook.description,
      archived: apiNotebook.archived,
      created: new Date(apiNotebook.created),
      updated: new Date(apiNotebook.updated),
      sourceCount: apiNotebook.source_count,
      noteCount: apiNotebook.note_count,
      localPath,
      syncEnabled: true,
      lastSynced: undefined
    };
  }

  /**
   * Convert multiple API notebooks to internal type
   */
  public static fromAPIList(
    apiNotebooks: APINotebook[],
    folderMappings?: Record<string, string>
  ): Notebook[] {
    return apiNotebooks.map(apiNotebook => {
      // Find local path if there's a mapping
      const localPath = folderMappings
        ? Object.keys(folderMappings).find(
            path => folderMappings[path] === apiNotebook.id
          )
        : undefined;

      return NotebookAdapter.fromAPI(apiNotebook, localPath);
    });
  }

  /**
   * Convert internal notebook to API create request
   */
  public static toAPICreate(name: string, description?: string) {
    return {
      name,
      description: description || ''
    };
  }

  /**
   * Convert internal notebook update to API request
   */
  public static toAPIUpdate(data: {
    name?: string;
    description?: string;
    archived?: boolean;
  }) {
    return {
      name: data.name,
      description: data.description,
      archived: data.archived
    };
  }
}
