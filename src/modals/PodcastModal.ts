// Modal for generating and managing podcast episodes for notebooks
import { App, Modal, Setting, Notice } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { APIPodcastEpisode, PodcastStatus, APIEpisodeProfile, APISpeakerProfile } from '../types/podcast';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class PodcastModal extends Modal {
  private plugin: OpenNotebookPlugin;
  private notebookId: string;
  private notebookName: string;
  private episodes: APIPodcastEpisode[] = [];
  private episodeProfiles: APIEpisodeProfile[] = [];
  private speakerProfiles: APISpeakerProfile[] = [];
  private selectedEpisodeProfile: string = '';
  private selectedSpeakerProfile: string = '';
  private isGenerating: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private statusCheckInterval: number | null = null;

  constructor(
    app: App,
    plugin: OpenNotebookPlugin,
    notebookId: string,
    notebookName: string
  ) {
    super(app);
    this.plugin = plugin;
    this.notebookId = notebookId;
    this.notebookName = notebookName;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('open-notebook-podcast-modal');

    // Title
    contentEl.createEl('h2', { text: `Podcasts - ${this.notebookName}` });

    // Description
    const descEl = contentEl.createDiv({ cls: 'podcast-description' });
    descEl.createEl('p', {
      text: 'Generate AI-powered podcast episodes from your notebook sources.'
    });

    // Load profiles and episodes
    await this.loadProfiles();
    await this.loadEpisodes();

    // Generate new podcast section
    this.renderGenerateSection();

    // Episodes list
    this.renderEpisodesList();

    // Start polling for processing episodes
    this.startStatusPolling();
  }

  async onClose() {
    const { contentEl } = this;

    // Stop any playing audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // Stop status polling
    if (this.statusCheckInterval) {
      window.clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    contentEl.empty();
  }

  /**
   * Load episode and speaker profiles
   */
  private async loadProfiles(): Promise<void> {
    try {
      const client = this.plugin.getAPIClient();

      // Load episode profiles
      this.episodeProfiles = await client.getEpisodeProfiles();
      logger.info(`Loaded ${this.episodeProfiles.length} episode profiles`);

      // Load speaker profiles
      this.speakerProfiles = await client.getSpeakerProfiles();
      logger.info(`Loaded ${this.speakerProfiles.length} speaker profiles`);

      // Set defaults to first available profiles
      if (this.episodeProfiles.length > 0) {
        this.selectedEpisodeProfile = this.episodeProfiles[0].name;
      }
      if (this.speakerProfiles.length > 0) {
        this.selectedSpeakerProfile = this.speakerProfiles[0].name;
      }
    } catch (error) {
      logger.error('Failed to load podcast profiles', error);
      NoticeHelper.error('Failed to load podcast profiles');
    }
  }

  /**
   * Load podcast episodes for the notebook
   * Note: Backend returns all episodes globally, so we filter client-side
   * by matching episode names that contain the notebook name
   */
  private async loadEpisodes(): Promise<void> {
    try {
      const client = this.plugin.getAPIClient();
      const allEpisodes = await client.getPodcastEpisodes();

      // Filter episodes by notebook name (episodes generated from this notebook
      // will have names like "NotebookName Podcast - Date")
      this.episodes = allEpisodes.filter(episode =>
        episode.name?.includes(this.notebookName)
      );

      logger.info(`Loaded ${this.episodes.length} podcast episodes for notebook "${this.notebookName}" (filtered from ${allEpisodes.length} total)`);
    } catch (error) {
      logger.error('Failed to load podcast episodes', error);
      NoticeHelper.error('Failed to load podcast episodes');
      this.episodes = [];
    }
  }

  /**
   * Render the generate new podcast section
   */
  private renderGenerateSection(): void {
    const { contentEl } = this;

    // Find or create generate section container
    let generateSection = contentEl.querySelector('.podcast-generate-section') as HTMLElement;
    if (!generateSection) {
      generateSection = contentEl.createDiv({ cls: 'podcast-generate-section' });
    } else {
      // Clear existing content but keep the container
      generateSection.empty();
    }

    // Episode Profile selection
    new Setting(generateSection)
      .setName('Episode Profile')
      .setDesc('Select the episode profile for podcast generation')
      .addDropdown(dropdown => {
        // Add episode profiles to dropdown
        this.episodeProfiles.forEach(profile => {
          dropdown.addOption(profile.name, profile.name);
        });

        // Set current value
        if (this.selectedEpisodeProfile) {
          dropdown.setValue(this.selectedEpisodeProfile);
        }

        // Handle selection change
        dropdown.onChange(value => {
          this.selectedEpisodeProfile = value;
          logger.debug(`Selected episode profile: ${value}`);
        });
      });

    // Speaker Profile selection
    new Setting(generateSection)
      .setName('Speaker Profile')
      .setDesc('Select the speaker profile for podcast voices')
      .addDropdown(dropdown => {
        // Add speaker profiles to dropdown
        this.speakerProfiles.forEach(profile => {
          dropdown.addOption(profile.name, profile.name);
        });

        // Set current value
        if (this.selectedSpeakerProfile) {
          dropdown.setValue(this.selectedSpeakerProfile);
        }

        // Handle selection change
        dropdown.onChange(value => {
          this.selectedSpeakerProfile = value;
          logger.debug(`Selected speaker profile: ${value}`);
        });
      });

    // Generate button
    new Setting(generateSection)
      .setName('Generate New Podcast')
      .setDesc('Create a new AI-generated podcast episode from all sources in this notebook')
      .addButton(button => button
        .setButtonText(this.isGenerating ? 'Generating...' : 'Generate Podcast')
        .setDisabled(this.isGenerating || !this.selectedEpisodeProfile || !this.selectedSpeakerProfile)
        .setCta()
        .onClick(async () => {
          await this.generatePodcast();
        })
      );
  }

  /**
   * Render the list of episodes
   */
  private renderEpisodesList(): void {
    const { contentEl } = this;

    // Find or create episodes container
    let episodesContainer = contentEl.querySelector('.podcast-episodes-container') as HTMLElement;
    if (!episodesContainer) {
      episodesContainer = contentEl.createDiv({ cls: 'podcast-episodes-container' });
    } else {
      // Clear existing content but keep the container
      episodesContainer.empty();
    }

    if (this.episodes.length === 0) {
      episodesContainer.createEl('p', {
        text: 'No podcast episodes yet. Generate your first podcast above!',
        cls: 'podcast-empty-state'
      });
      return;
    }

    episodesContainer.createEl('h3', { text: 'Episodes' });

    // Sort episodes by date (newest first)
    const sortedEpisodes = [...this.episodes].sort((a, b) => {
      const aTime = a.created ? new Date(a.created).getTime() : 0;
      const bTime = b.created ? new Date(b.created).getTime() : 0;
      return bTime - aTime;
    });

    sortedEpisodes.forEach(episode => {
      this.renderEpisodeItem(episodesContainer, episode);
    });
  }

  /**
   * Render a single episode item
   */
  private renderEpisodeItem(container: HTMLElement, episode: APIPodcastEpisode): void {
    const episodeEl = container.createDiv({ cls: 'podcast-episode-item' });

    // Header with title and status
    const headerEl = episodeEl.createDiv({ cls: 'podcast-episode-header' });

    const titleEl = headerEl.createDiv({ cls: 'podcast-episode-title' });
    titleEl.createSpan({ text: episode.name || 'Untitled Episode', cls: 'episode-title-text' });

    const statusBadge = titleEl.createSpan({
      text: this.getStatusText(episode.job_status),
      cls: `episode-status status-${episode.job_status}`
    });

    // Metadata
    const metaEl = episodeEl.createDiv({ cls: 'podcast-episode-meta' });
    if (episode.created) {
      const createdDate = new Date(episode.created).toLocaleDateString();
      metaEl.createSpan({ text: `Created: ${createdDate}`, cls: 'episode-meta-date' });
    }

    // Note: Duration is not provided by the backend API
    // If it becomes available, we can add it here

    // Actions based on status
    const actionsEl = episodeEl.createDiv({ cls: 'podcast-episode-actions' });

    if (episode.job_status === 'completed' && (episode.audio_url || episode.audio_file)) {
      // Play button
      actionsEl.createEl('button', {
        text: '▶ Play',
        cls: 'mod-cta podcast-action-button'
      }).addEventListener('click', () => this.playEpisode(episode));

      // Download button
      actionsEl.createEl('button', {
        text: '⬇ Download',
        cls: 'podcast-action-button'
      }).addEventListener('click', () => this.downloadEpisode(episode));

      // Save as note button
      actionsEl.createEl('button', {
        text: '📝 Save as Note',
        cls: 'podcast-action-button'
      }).addEventListener('click', () => this.saveEpisodeAsNote(episode));
    } else if (episode.job_status === 'processing' || episode.job_status === 'pending' || episode.job_status === 'running') {
      const progressText = episode.job_status === 'processing' || episode.job_status === 'running' ? 'Processing...' : 'Pending...';
      actionsEl.createSpan({ text: progressText, cls: 'episode-processing' });
    } else if (episode.job_status === 'failed' || episode.job_status === 'error') {
      actionsEl.createSpan({ text: 'Generation failed', cls: 'episode-error' });
    }

    // Delete button (always available)
    actionsEl.createEl('button', {
      text: '🗑 Delete',
      cls: 'mod-warning podcast-action-button'
    }).addEventListener('click', () => this.deleteEpisode(episode));
  }

  /**
   * Generate a new podcast
   */
  private async generatePodcast(): Promise<void> {
    if (!this.selectedEpisodeProfile || !this.selectedSpeakerProfile) {
      NoticeHelper.error('Please select both episode and speaker profiles');
      return;
    }

    // Open loading modal immediately
    const { PodcastGenerationModal } = require('./PodcastGenerationModal');
    const loadingModal = new PodcastGenerationModal(this.app);
    loadingModal.open();

    this.isGenerating = true;

    try {
      const client = this.plugin.getAPIClient();
      const response = await client.generatePodcast({
        episode_profile: this.selectedEpisodeProfile,
        speaker_profile: this.selectedSpeakerProfile,
        episode_name: `${this.notebookName} Podcast - ${new Date().toLocaleDateString()}`,
        notebook_id: this.notebookId
      });

      logger.info('Podcast generation started:', response);

      // Show success in loading modal for 5 seconds
      loadingModal.setSuccess('Podcast generation started! This may take a few minutes.', 5000);

      // Close both modals after 5 seconds
      setTimeout(() => {
        this.close();
      }, 5000);

      // Reload episodes to show the new one
      await this.loadEpisodes();
      this.refresh();

    } catch (error) {
      logger.error('Failed to generate podcast', error);
      loadingModal.setError(error.message || 'Failed to generate podcast');
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Play a podcast episode
   */
  private async playEpisode(episode: APIPodcastEpisode): Promise<void> {
    try {
      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      logger.info('Playing podcast episode:', episode.id);

      // Download audio file
      const loadingNotice = NoticeHelper.loading('Loading audio...');
      const client = this.plugin.getAPIClient();
      const audioData = await client.downloadPodcastAudio(episode.id);
      NoticeHelper.hideNotice(loadingNotice);

      // Create audio element
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      this.currentAudio = new Audio(audioUrl);

      // Play audio
      this.currentAudio.play();

      // Show simple audio controls in a notice
      const controlsNotice = new Notice('', 0); // 0 = persistent
      const noticeEl = controlsNotice.noticeEl;
      noticeEl.empty();
      noticeEl.addClass('podcast-player-notice');

      const container = noticeEl.createDiv({ cls: 'podcast-player-controls' });
      container.createSpan({ text: `▶ Playing: ${episode.name}` });

      const stopButton = container.createEl('button', { text: 'Stop', cls: 'mod-warning' });
      stopButton.addEventListener('click', () => {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
        controlsNotice.hide();
      });

      // Auto-hide notice when audio ends
      this.currentAudio.addEventListener('ended', () => {
        controlsNotice.hide();
        this.currentAudio = null;
      });

    } catch (error) {
      logger.error('Failed to play podcast', error);
      NoticeHelper.error('Failed to play podcast');
    }
  }

  /**
   * Download a podcast episode
   */
  private async downloadEpisode(episode: APIPodcastEpisode): Promise<void> {
    try {
      const loadingNotice = NoticeHelper.loading('Downloading podcast...');
      const client = this.plugin.getAPIClient();
      const audioData = await client.downloadPodcastAudio(episode.id);
      NoticeHelper.hideNotice(loadingNotice);

      // Create download link
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${episode.name || 'podcast'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      NoticeHelper.success('Podcast downloaded');
    } catch (error) {
      logger.error('Failed to download podcast', error);
      NoticeHelper.error('Failed to download podcast');
    }
  }

  /**
   * Sanitize filename by replacing invalid characters
   */
  private sanitizeFilename(filename: string): string {
    // Replace invalid filename characters with dashes
    return filename.replace(/[\/\\:*?"<>|]/g, '-');
  }

  /**
   * Save episode information as a note
   */
  private async saveEpisodeAsNote(episode: APIPodcastEpisode): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Saving podcast note...');

    try {
      const podcastFolderName = 'Generated Podcasts';

      // Create "Generated Podcasts" folder if it doesn't exist
      const existingFolder = this.app.vault.getAbstractFileByPath(podcastFolderName);
      if (!existingFolder) {
        await this.app.vault.createFolder(podcastFolderName);
        logger.info(`Created ${podcastFolderName} folder`);
      }

      // Create a subfolder for this specific episode
      // If folder exists, add a suffix (_1, _2, etc.)
      const sanitizedName = this.sanitizeFilename(episode.name || 'Untitled Episode');
      let episodeFolder = `${podcastFolderName}/${sanitizedName}`;
      let suffix = 0;

      // Check if folder exists and find an available name
      while (this.app.vault.getAbstractFileByPath(episodeFolder)) {
        suffix++;
        episodeFolder = `${podcastFolderName}/${sanitizedName}_${suffix}`;
      }

      // Create the unique episode folder
      await this.app.vault.createFolder(episodeFolder);
      logger.info(`Created episode folder: ${episodeFolder}`);

      const audioFileName = `${sanitizedName}.mp3`;
      const audioFilePath = `${episodeFolder}/${audioFileName}`;
      const noteFileName = `${episodeFolder}/${sanitizedName}.md`;

      // Download and save the audio file
      try {
        const client = this.plugin.getAPIClient();
        const audioData = await client.downloadPodcastAudio(episode.id);

        // Create audio file in the vault
        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioArrayBuffer = await audioBlob.arrayBuffer();
        await this.app.vault.createBinary(audioFilePath, audioArrayBuffer);
        logger.info(`Saved audio file: ${audioFilePath}`);
      } catch (audioError) {
        logger.error('Failed to download audio file', audioError);
        NoticeHelper.hideNotice(loadingNotice);
        NoticeHelper.error('Failed to download audio file');
        return;
      }

      // Create the note with embedded audio
      const content = `# ${episode.name}

**Status:** ${episode.job_status || 'Unknown'}
**Created:** ${episode.created ? new Date(episode.created).toLocaleString() : 'Unknown'}
**Notebook:** ${this.notebookName}

## Audio

![[${audioFileName}]]

## Briefing

${episode.briefing || 'No briefing available'}

---

*Generated by Open Notebook*
`;

      await this.app.vault.create(noteFileName, content);
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.success(`Podcast saved: ${noteFileName}`);
      this.close();
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      logger.error('Failed to save episode as note', error);
      NoticeHelper.error('Failed to create note');
    }
  }

  /**
   * Delete a podcast episode
   */
  private async deleteEpisode(episode: APIPodcastEpisode): Promise<void> {
    try {
      const confirmed = confirm(`Are you sure you want to delete "${episode.name}"?`);
      if (!confirmed) return;

      const client = this.plugin.getAPIClient();
      await client.deletePodcastEpisode(episode.id);

      NoticeHelper.success('Episode deleted');

      // Reload episodes
      await this.loadEpisodes();
      this.refresh();

    } catch (error) {
      logger.error('Failed to delete episode', error);
      NoticeHelper.error('Failed to delete episode');
    }
  }

  /**
   * Start polling for status updates on processing episodes
   */
  private startStatusPolling(): void {
    // Check every 10 seconds
    this.statusCheckInterval = window.setInterval(async () => {
      const processingEpisodes = this.episodes.filter(
        e => e.job_status === 'processing' || e.job_status === 'pending' || e.job_status === 'running'
      );

      if (processingEpisodes.length === 0) {
        return;
      }

      // Reload episodes to get updated status
      await this.loadEpisodes();
      this.refresh();
    }, 10000);
  }

  /**
   * Refresh the modal display
   */
  private refresh(): void {
    // Re-render episodes list
    this.renderEpisodesList();

    // Re-render generate section (it will find and reuse existing container)
    this.renderGenerateSection();
  }

  /**
   * Get status display text
   */
  private getStatusText(status?: string): string {
    if (!status) return 'Unknown';

    switch (status.toLowerCase()) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'running': return 'Processing';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'error': return 'Error';
      default: return status;
    }
  }
}
