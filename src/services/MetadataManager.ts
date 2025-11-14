// Metadata manager for handling frontmatter sync metadata
import { App, TFile } from 'obsidian';
import { NoteFrontmatter } from '../types/note';
import { logger } from '../utils/Logger';
import * as crypto from 'crypto';

export class MetadataManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get metadata from a file's frontmatter
   */
  public async getMetadata(file: TFile): Promise<NoteFrontmatter> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter || {};

      return {
        on_notebook_id: frontmatter.on_notebook_id,
        on_note_id: frontmatter.on_note_id,
        on_source_id: frontmatter.on_source_id,
        on_synced_at: frontmatter.on_synced_at,
        on_modified_at: frontmatter.on_modified_at,
        on_checksum: frontmatter.on_checksum,
        on_sync_enabled: frontmatter.on_sync_enabled !== false, // Default to true
        on_topics: frontmatter.on_topics,
        on_ai_generated: frontmatter.on_ai_generated
      };
    } catch (error) {
      logger.error(`Failed to get metadata for ${file.path}`, error);
      return {};
    }
  }

  /**
   * Update metadata in a file's frontmatter
   */
  public async updateMetadata(file: TFile, metadata: Partial<NoteFrontmatter>): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const updatedContent = this.updateFrontmatter(content, metadata);

      await this.app.vault.modify(file, updatedContent);
      logger.debug(`Updated metadata for ${file.path}`, metadata);
    } catch (error) {
      logger.error(`Failed to update metadata for ${file.path}`, error);
      throw error;
    }
  }

  /**
   * Update frontmatter in markdown content
   */
  private updateFrontmatter(content: string, metadata: Partial<NoteFrontmatter>): string {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    let frontmatter: Record<string, any> = {};
    let bodyContent = content;

    if (match) {
      // Parse existing frontmatter
      const frontmatterText = match[1];
      frontmatter = this.parseFrontmatter(frontmatterText);
      bodyContent = content.slice(match[0].length);
    }

    // Update with new metadata
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined) {
        frontmatter[key] = value;
      } else {
        delete frontmatter[key];
      }
    });

    // Serialize frontmatter
    const serialized = this.serializeFrontmatter(frontmatter);

    if (serialized) {
      return `---\n${serialized}\n---\n${bodyContent}`;
    } else {
      return bodyContent;
    }
  }

  /**
   * Parse YAML frontmatter to object
   */
  private parseFrontmatter(text: string): Record<string, any> {
    const result: Record<string, any> = {};

    const lines = text.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: any = line.slice(colonIndex + 1).trim();

      // Handle different value types
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value.startsWith('[') && value.endsWith(']')) {
        // Simple array parsing
        value = value.slice(1, -1).split(',').map((v: string) => v.trim().replace(/['"]/g, ''));
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      } else {
        // Remove quotes if present
        value = value.replace(/^['"]|['"]$/g, '');
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * Serialize object to YAML frontmatter
   */
  private serializeFrontmatter(obj: Record<string, any>): string {
    const lines: string[] = [];

    Object.entries(obj).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        if (value.length === 0) return;
        lines.push(`${key}: [${value.map((v: any) => `"${v}"`).join(', ')}]`);
      } else if (typeof value === 'string') {
        // Escape quotes in strings
        const escaped = value.replace(/"/g, '\\"');
        lines.push(`${key}: "${escaped}"`);
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      } else {
        lines.push(`${key}: "${String(value)}"`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Compute checksum of content (excluding frontmatter)
   */
  public async computeChecksum(file: TFile): Promise<string> {
    try {
      const content = await this.app.vault.read(file);
      const bodyContent = this.extractBodyContent(content);
      return this.hashContent(bodyContent);
    } catch (error) {
      logger.error(`Failed to compute checksum for ${file.path}`, error);
      throw error;
    }
  }

  /**
   * Compute checksum from content string
   */
  public computeChecksumFromContent(content: string): string {
    const bodyContent = this.extractBodyContent(content);
    return this.hashContent(bodyContent);
  }

  /**
   * Extract body content (without frontmatter)
   */
  private extractBodyContent(content: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return content.replace(frontmatterRegex, '').trim();
  }

  /**
   * Hash content using SHA-256
   */
  private hashContent(content: string): string {
    // For browser environment, use a simple hash
    // In Node.js, we'd use crypto.createHash('sha256')

    // Simple djb2 hash (good enough for conflict detection)
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to hex string
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Check if file has sync metadata
   */
  public async hasSyncMetadata(file: TFile): Promise<boolean> {
    const metadata = await this.getMetadata(file);
    return !!(metadata.on_source_id || metadata.on_note_id);
  }

  /**
   * Validate metadata
   */
  public validateMetadata(metadata: NoteFrontmatter): boolean {
    // Must have either source_id or note_id
    if (!metadata.on_source_id && !metadata.on_note_id) {
      return false;
    }

    // If synced_at exists, must be valid timestamp
    if (metadata.on_synced_at) {
      const date = new Date(metadata.on_synced_at);
      if (isNaN(date.getTime())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clear sync metadata from file
   */
  public async clearMetadata(file: TFile): Promise<void> {
    await this.updateMetadata(file, {
      on_notebook_id: undefined,
      on_note_id: undefined,
      on_source_id: undefined,
      on_synced_at: undefined,
      on_modified_at: undefined,
      on_checksum: undefined,
      on_sync_enabled: undefined,
      on_topics: undefined,
      on_ai_generated: undefined
    });
  }

  /**
   * Check if content has changed since last sync
   */
  public async hasContentChanged(file: TFile): Promise<boolean> {
    const metadata = await this.getMetadata(file);
    if (!metadata.on_checksum) {
      return true; // No checksum means never synced
    }

    const currentChecksum = await this.computeChecksum(file);
    return currentChecksum !== metadata.on_checksum;
  }

  /**
   * Get the body content without frontmatter
   */
  public async getBodyContent(file: TFile): Promise<string> {
    const content = await this.app.vault.read(file);
    return this.extractBodyContent(content);
  }
}
