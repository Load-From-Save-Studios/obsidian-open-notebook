// Settings tab for Open Notebook plugin
import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import OpenNotebookPlugin from '../main';
import { NotebookMappingStrategy, SyncMode, ConflictResolution } from '../types/settings';
import { OpenNotebookClient } from '../api/client';
import { Feature, FeatureDetector } from '../services/FeatureDetector';
import { logger } from '../utils/Logger';
import { NoticeHelper } from '../utils/NoticeHelper';

export class OpenNotebookSettingsTab extends PluginSettingTab {
  plugin: OpenNotebookPlugin;

  constructor(app: App, plugin: OpenNotebookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Open Notebook Settings' });

    // Connection Settings
    this.addConnectionSettings(containerEl);

    // Notebook Mapping Settings
    this.addMappingSettings(containerEl);

    // Sync Settings
    this.addSyncSettings(containerEl);

    // Feature Settings
    this.addFeatureSettings(containerEl);

    // UI Preferences
    this.addUISettings(containerEl);

    // Advanced Settings
    this.addAdvancedSettings(containerEl);
  }

  private addConnectionSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Connection' });

    // API Endpoint
    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc('URL of your Open Notebook instance (e.g., http://localhost:8000)')
      .addText(text => text
        .setPlaceholder('http://localhost:8000')
        .setValue(this.plugin.settings.apiEndpoint)
        .onChange(async (value) => {
          this.plugin.settings.apiEndpoint = value.trim();
          await this.plugin.saveSettings();
        }));

    // API Password
    new Setting(containerEl)
      .setName('API Password')
      .setDesc('Password configured in your Open Notebook instance')
      .addText(text => {
        text
          .setPlaceholder('Enter password')
          .setValue(this.plugin.settings.apiPassword)
          .onChange(async (value) => {
            this.plugin.settings.apiPassword = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    // Test Connection Button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify connection to Open Notebook API')
      .addButton(button => button
        .setButtonText('Test Connection')
        .setCta()
        .onClick(async () => {
          await this.testConnection();
        }));

    // Connection Status Display
    const statusSetting = new Setting(containerEl)
      .setName('Connection Status')
      .setDesc('Current connection status');

    this.updateConnectionStatusDisplay(statusSetting);

    // Detected Features Display
    if (this.plugin.settings.detectedFeatures && this.plugin.settings.connectionStatus === 'connected') {
      this.addDetectedFeaturesDisplay(containerEl);
    }
  }

  private updateConnectionStatusDisplay(setting: Setting): void {
    const status = this.plugin.settings.connectionStatus;
    const statusText = status === 'connected' ? '✓ Connected'
                     : status === 'error' ? '✗ Error'
                     : '○ Disconnected';

    const statusClass = status === 'connected' ? 'mod-success'
                      : status === 'error' ? 'mod-warning'
                      : '';

    setting.controlEl.empty();
    const statusEl = setting.controlEl.createDiv({ cls: statusClass });
    statusEl.setText(statusText);

    if (this.plugin.settings.lastConnectionCheck) {
      const lastCheck = new Date(this.plugin.settings.lastConnectionCheck);
      statusEl.createEl('div', {
        text: `Last checked: ${lastCheck.toLocaleString()}`,
        cls: 'setting-item-description'
      });
    }
  }

  private addDetectedFeaturesDisplay(containerEl: HTMLElement): void {
    const features = this.plugin.settings.detectedFeatures;
    if (!features) return;

    const featureDetector = this.plugin.getFeatureDetector();
    const availableFeatures = featureDetector.getAvailableFeaturesList();
    const unavailableFeatures = featureDetector.getUnavailableFeaturesList();

    // Features info
    const featuresSection = containerEl.createDiv({ cls: 'setting-item' });
    featuresSection.style.borderTop = '1px solid var(--background-modifier-border)';
    featuresSection.style.paddingTop = '1em';
    featuresSection.style.marginTop = '1em';

    featuresSection.createEl('div', {
      text: 'Detected API Features',
      cls: 'setting-item-name'
    });

    const desc = featuresSection.createEl('div', {
      cls: 'setting-item-description'
    });

    if (features.apiVersion) {
      desc.createEl('div', {
        text: `API Version: ${features.apiVersion}`
      });
    }

    if (features.lastDetection) {
      const lastDetection = new Date(features.lastDetection);
      desc.createEl('div', {
        text: `Last detected: ${lastDetection.toLocaleString()}`,
        cls: 'setting-item-description'
      });
    }

    // Available features list
    if (availableFeatures.length > 0) {
      const availableDiv = featuresSection.createDiv({ cls: 'detected-features' });
      availableDiv.style.marginTop = '0.5em';

      availableDiv.createEl('div', {
        text: '✓ Available Features:',
        cls: 'mod-success'
      });

      const listDiv = availableDiv.createDiv();
      listDiv.style.paddingLeft = '1.5em';
      listDiv.style.marginTop = '0.3em';

      availableFeatures.forEach(feature => {
        const featureEl = listDiv.createEl('div');
        featureEl.style.fontSize = '0.9em';
        featureEl.style.color = 'var(--text-muted)';
        featureEl.setText(`• ${FeatureDetector.getFeatureName(feature)}`);
      });
    }

    // Unavailable features list
    if (unavailableFeatures.length > 0) {
      const unavailableDiv = featuresSection.createDiv({ cls: 'detected-features' });
      unavailableDiv.style.marginTop = '0.5em';

      unavailableDiv.createEl('div', {
        text: '✗ Unavailable Features:',
        cls: 'mod-warning'
      });

      const listDiv = unavailableDiv.createDiv();
      listDiv.style.paddingLeft = '1.5em';
      listDiv.style.marginTop = '0.3em';

      unavailableFeatures.forEach(feature => {
        const featureEl = listDiv.createEl('div');
        featureEl.style.fontSize = '0.9em';
        featureEl.style.color = 'var(--text-muted)';
        featureEl.style.opacity = '0.6';
        featureEl.setText(`• ${FeatureDetector.getFeatureName(feature)}`);
      });
    }
  }

  private async loadAvailableModels(): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Loading available models...');

    try {
      const client = new OpenNotebookClient(
        this.plugin.settings.apiEndpoint,
        this.plugin.settings.apiPassword,
        this.plugin.settings.requestTimeout,
        this.plugin.settings.retryAttempts
      );

      const models = await client.getAvailableModels();
      NoticeHelper.hideNotice(loadingNotice);

      if (models.length === 0) {
        NoticeHelper.error('No models found. Your Open Notebook instance may not support model listing.');
        return;
      }

      // Create a modal to display available models
      const modalContent = models.map(model =>
        `**${model.name}** (${model.provider})\n` +
        `ID: \`${model.id}\`` +
        (model.context_length ? `\nContext: ${model.context_length} tokens` : '') +
        (model.supports_vision ? '\n✓ Supports vision' : '') +
        (model.supports_tools ? '\n✓ Supports tools' : '')
      ).join('\n\n');

      const modal = new class extends Modal {
        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.empty();
          contentEl.createEl('h2', { text: 'Available Models' });

          const container = contentEl.createDiv({ cls: 'markdown-rendered' });
          container.style.maxHeight = '400px';
          container.style.overflowY = 'auto';
          container.style.padding = '10px';

          const pre = container.createEl('pre');
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.fontFamily = 'monospace';
          pre.style.fontSize = '12px';
          pre.textContent = modalContent;

          const hint = contentEl.createEl('p', {
            text: 'Copy the model ID and paste it into the model settings above.',
            cls: 'setting-item-description'
          });
          hint.style.marginTop = '10px';
        }

        onClose() {
          const { contentEl } = this;
          contentEl.empty();
        }
      }(this.app);

      modal.open();

    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.error(`Failed to load models: ${error.message}`);
      logger.error('Failed to load models', error);
    }
  }

  private async testConnection(): Promise<void> {
    const loadingNotice = NoticeHelper.loading('Testing connection to Open Notebook...');

    try {
      const client = new OpenNotebookClient(
        this.plugin.settings.apiEndpoint,
        this.plugin.settings.apiPassword,
        this.plugin.settings.requestTimeout,
        this.plugin.settings.retryAttempts
      );

      const isConnected = await client.testConnection();

      if (isConnected) {
        // Test authentication
        const isAuthenticated = await client.authenticate();

        if (isAuthenticated) {
          // Get API version
          const version = await client.getApiVersion();
          this.plugin.settings.apiVersion = version;

          // Detect features
          NoticeHelper.hideNotice(loadingNotice);
          const detectingNotice = NoticeHelper.loading('Detecting API features...');

          const featureDetector = this.plugin.getFeatureDetector();
          const features = await featureDetector.detectFeatures();
          this.plugin.settings.detectedFeatures = features;
          await this.plugin.saveSettings();

          NoticeHelper.hideNotice(detectingNotice);

          const availableCount = featureDetector.getAvailableFeaturesList().length;
          NoticeHelper.success(`Connected! API v${version} - ${availableCount} features available`);
          this.plugin.setConnectionStatus('connected');
        } else {
          NoticeHelper.hideNotice(loadingNotice);
          NoticeHelper.error('Connection succeeded but authentication failed. Check your password.');
          this.plugin.setConnectionStatus('error');
        }
      } else {
        NoticeHelper.hideNotice(loadingNotice);
        NoticeHelper.error('Connection failed. Check your endpoint URL.');
        this.plugin.setConnectionStatus('error');
      }

      this.display(); // Refresh display to show updated status and detected features
    } catch (error) {
      NoticeHelper.hideNotice(loadingNotice);
      NoticeHelper.error(`Connection test failed: ${error.message}`);
      this.plugin.setConnectionStatus('error');
      logger.error('Connection test error', error);
      this.display();
    }
  }

  private addMappingSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Notebook Mapping' });

    // Info text
    const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
    infoEl.style.marginBottom = '1em';
    infoEl.style.opacity = '0.8';
    infoEl.setText('💡 Tip: Right-click any folder in your vault to create or link an Open Notebook.');

    new Setting(containerEl)
      .setName('Mapping Strategy')
      .setDesc('How to map Obsidian files to Open Notebook notebooks')
      .addDropdown(dropdown => dropdown
        .addOption(NotebookMappingStrategy.FOLDER, 'By Folder')
        .addOption(NotebookMappingStrategy.TAG, 'By Tag')
        .addOption(NotebookMappingStrategy.PROPERTY, 'By Property')
        .setValue(this.plugin.settings.mappingStrategy)
        .onChange(async (value) => {
          this.plugin.settings.mappingStrategy = value as NotebookMappingStrategy;
          await this.plugin.saveSettings();
        }));

    // Strategy-specific settings
    if (this.plugin.settings.mappingStrategy === NotebookMappingStrategy.TAG) {
      new Setting(containerEl)
        .setName('Notebook Tag Prefix')
        .setDesc('Prefix for notebook tags (e.g., "on-notebook/" for tags like #on-notebook/research)')
        .addText(text => text
          .setPlaceholder('on-notebook/')
          .setValue(this.plugin.settings.notebookTagPrefix)
          .onChange(async (value) => {
            this.plugin.settings.notebookTagPrefix = value;
            await this.plugin.saveSettings();
          }));
    }

    if (this.plugin.settings.mappingStrategy === NotebookMappingStrategy.PROPERTY) {
      new Setting(containerEl)
        .setName('Notebook Property Name')
        .setDesc('Frontmatter property name for notebook (e.g., "notebook")')
        .addText(text => text
          .setPlaceholder('notebook')
          .setValue(this.plugin.settings.notebookPropertyName)
          .onChange(async (value) => {
            this.plugin.settings.notebookPropertyName = value;
            await this.plugin.saveSettings();
          }));
    }
  }

  private addSyncSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Synchronization' });

    new Setting(containerEl)
      .setName('Sync Mode')
      .setDesc('When to synchronize notes with Open Notebook')
      .addDropdown(dropdown => dropdown
        .addOption(SyncMode.REALTIME, 'Real-time (on save)')
        .addOption(SyncMode.MANUAL, 'Manual only')
        .addOption(SyncMode.INTERVAL, 'Interval-based')
        .setValue(this.plugin.settings.syncMode)
        .onChange(async (value) => {
          this.plugin.settings.syncMode = value as SyncMode;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide related settings
        }));

    if (this.plugin.settings.syncMode === SyncMode.REALTIME) {
      new Setting(containerEl)
        .setName('Debounce Duration')
        .setDesc('Wait time (ms) after editing before syncing (prevents excessive API calls)')
        .addText(text => text
          .setPlaceholder('2000')
          .setValue(String(this.plugin.settings.syncDebounceMs))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.syncDebounceMs = num;
              await this.plugin.saveSettings();
            }
          }));
    }

    if (this.plugin.settings.syncMode === SyncMode.INTERVAL) {
      new Setting(containerEl)
        .setName('Sync Interval')
        .setDesc('Minutes between automatic syncs')
        .addText(text => text
          .setPlaceholder('5')
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.syncIntervalMinutes = num;
              await this.plugin.saveSettings();
            }
          }));
    }

    new Setting(containerEl)
      .setName('Conflict Resolution')
      .setDesc('What to do when both local and remote versions have changed')
      .addDropdown(dropdown => dropdown
        .addOption(ConflictResolution.OBSIDIAN_WINS, 'Obsidian Wins')
        .addOption(ConflictResolution.SERVER_WINS, 'Server Wins')
        .addOption(ConflictResolution.ASK_USER, 'Ask Me')
        .setValue(this.plugin.settings.conflictResolution)
        .onChange(async (value) => {
          this.plugin.settings.conflictResolution = value as ConflictResolution;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync on Startup')
      .setDesc('Verify and reconcile sync state when Obsidian starts (recommended)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }));

    // Sync Statistics
    const syncMappings = this.plugin.settings.sourceMappings || {};
    const syncedFileCount = Object.keys(syncMappings).length;

    if (syncedFileCount > 0) {
      new Setting(containerEl)
        .setName('Sync Statistics')
        .setDesc(`Currently tracking ${syncedFileCount} synced file${syncedFileCount === 1 ? '' : 's'}`);
    }
  }

  private addFeatureSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Features' });

    new Setting(containerEl)
      .setName('Enable Chat')
      .setDesc('Enable AI chat integration')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableChat)
        .onChange(async (value) => {
          this.plugin.settings.enableChat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Search')
      .setDesc('Enable semantic search integration')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableSearch)
        .onChange(async (value) => {
          this.plugin.settings.enableSearch = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Transformations')
      .setDesc('Enable text transformations (summarize, expand, etc.)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableTransformations)
        .onChange(async (value) => {
          this.plugin.settings.enableTransformations = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Podcasts')
      .setDesc('Enable podcast generation (experimental)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enablePodcasts)
        .onChange(async (value) => {
          this.plugin.settings.enablePodcasts = value;
          await this.plugin.saveSettings();
        }));
  }

  private addUISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'User Interface' });

    new Setting(containerEl)
      .setName('Chat Sidebar Position')
      .setDesc('Where to show the chat sidebar')
      .addDropdown(dropdown => dropdown
        .addOption('left', 'Left')
        .addOption('right', 'Right')
        .setValue(this.plugin.settings.chatSidebarPosition)
        .onChange(async (value: 'left' | 'right') => {
          this.plugin.settings.chatSidebarPosition = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default Search Mode')
      .setDesc('Default search type when opening search')
      .addDropdown(dropdown => dropdown
        .addOption('text', 'Text Search')
        .addOption('vector', 'Vector Search (Semantic)')
        .setValue(this.plugin.settings.defaultSearchMode)
        .onChange(async (value: 'text' | 'vector') => {
          this.plugin.settings.defaultSearchMode = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show Sync Status')
      .setDesc('Show sync status in status bar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showSyncStatus)
        .onChange(async (value) => {
          this.plugin.settings.showSyncStatus = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show Notifications')
      .setDesc('Show notifications for sync and other operations')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showNotifications)
        .onChange(async (value) => {
          this.plugin.settings.showNotifications = value;
          await this.plugin.saveSettings();
        }));
  }

  private addAdvancedSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Advanced' });

    // Model Selection Section
    const modelSection = containerEl.createDiv({ cls: 'setting-item-heading' });
    modelSection.createEl('h4', { text: 'Model Selection' });
    modelSection.createEl('p', {
      text: 'Override default models for different operations. Leave empty to use API defaults.',
      cls: 'setting-item-description'
    });

    // Default Chat Model
    new Setting(containerEl)
      .setName('Default Chat Model')
      .setDesc('Model to use for chat conversations. Leave empty to use API default.')
      .addText(text => text
        .setPlaceholder('e.g., gpt-4, claude-3-opus-20240229')
        .setValue(this.plugin.settings.defaultChatModel || '')
        .onChange(async (value) => {
          this.plugin.settings.defaultChatModel = value || undefined;
          await this.plugin.saveSettings();
        }));

    // Default Transformation Model
    new Setting(containerEl)
      .setName('Default Transformation Model')
      .setDesc('Model to use for text transformations. Leave empty to use API default.')
      .addText(text => text
        .setPlaceholder('e.g., gpt-4-turbo, claude-3-sonnet-20240229')
        .setValue(this.plugin.settings.defaultTransformationModel || '')
        .onChange(async (value) => {
          this.plugin.settings.defaultTransformationModel = value || undefined;
          await this.plugin.saveSettings();
        }));

    // Large Context Model
    new Setting(containerEl)
      .setName('Large Context Model')
      .setDesc('Model to use for operations requiring large context windows. Leave empty to use API default.')
      .addText(text => text
        .setPlaceholder('e.g., gpt-4-32k, claude-3-opus-20240229')
        .setValue(this.plugin.settings.largeContextModel || '')
        .onChange(async (value) => {
          this.plugin.settings.largeContextModel = value || undefined;
          await this.plugin.saveSettings();
        }));

    // Load Available Models button
    new Setting(containerEl)
      .setName('Available Models')
      .setDesc('Fetch and display models available from your Open Notebook instance')
      .addButton(button => button
        .setButtonText('Load Models')
        .onClick(async () => {
          await this.loadAvailableModels();
        }));

    // Processing Options Section
    const processingSection = containerEl.createDiv({ cls: 'setting-item-heading' });
    processingSection.createEl('h4', { text: 'Processing Options' });

    // Auto-delete Files
    new Setting(containerEl)
      .setName('Auto-delete Source Files')
      .setDesc('Automatically delete uploaded files after processing (PDF, videos, etc.)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoDeleteFiles)
        .onChange(async (value) => {
          this.plugin.settings.autoDeleteFiles = value;
          await this.plugin.saveSettings();
        }));

    // Preferred Language
    new Setting(containerEl)
      .setName('Preferred Language')
      .setDesc('Language preference for AI responses and transformations')
      .addDropdown(dropdown => dropdown
        .addOption('en', 'English')
        .addOption('es', 'Spanish')
        .addOption('fr', 'French')
        .addOption('de', 'German')
        .addOption('it', 'Italian')
        .addOption('pt', 'Portuguese')
        .addOption('ja', 'Japanese')
        .addOption('ko', 'Korean')
        .addOption('zh', 'Chinese')
        .setValue(this.plugin.settings.preferredLanguage)
        .onChange(async (value) => {
          this.plugin.settings.preferredLanguage = value;
          await this.plugin.saveSettings();
        }));

    // Mobile Settings Section
    const mobileSection = containerEl.createDiv({ cls: 'setting-item-heading' });
    mobileSection.createEl('h4', { text: 'Mobile Optimization' });
    mobileSection.createEl('p', {
      text: 'Settings to optimize plugin performance and usability on mobile devices.',
      cls: 'setting-item-description'
    });

    new Setting(containerEl)
      .setName('Mobile Optimizations')
      .setDesc('Enable automatic mobile-specific optimizations (longer cache, reduced animations)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.mobileOptimized)
        .onChange(async (value) => {
          this.plugin.settings.mobileOptimized = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Disable Heavy Features on Mobile')
      .setDesc('Automatically disable resource-intensive features when running on mobile devices')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.disableHeavyFeaturesOnMobile)
        .onChange(async (value) => {
          this.plugin.settings.disableHeavyFeaturesOnMobile = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Increased Touch Targets')
      .setDesc('Make buttons and interactive elements larger for easier touch interaction')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.increasedTouchTargets)
        .onChange(async (value) => {
          this.plugin.settings.increasedTouchTargets = value;
          await this.plugin.saveSettings();
        }));

    // System Settings Section
    const systemSection = containerEl.createDiv({ cls: 'setting-item-heading' });
    systemSection.createEl('h4', { text: 'System' });

    new Setting(containerEl)
      .setName('Enable Debug Logging')
      .setDesc('Show detailed debug logs in console (for troubleshooting)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableDebugLogging)
        .onChange(async (value) => {
          this.plugin.settings.enableDebugLogging = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Request Timeout')
      .setDesc('API request timeout in milliseconds')
      .addText(text => text
        .setPlaceholder('30000')
        .setValue(String(this.plugin.settings.requestTimeout))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.requestTimeout = num;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Retry Attempts')
      .setDesc('Number of times to retry failed API requests')
      .addText(text => text
        .setPlaceholder('3')
        .setValue(String(this.plugin.settings.retryAttempts))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 0) {
            this.plugin.settings.retryAttempts = num;
            await this.plugin.saveSettings();
          }
        }));

    // Excluded Folders
    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc('Folders that should not be synced to Open Notebook (one per line). "Generated Podcasts" is excluded by default.')
      .addTextArea(text => {
        text
          .setPlaceholder('Generated Podcasts\nArchive\nTemplates')
          .setValue((this.plugin.settings.excludedFolders || []).join('\n'))
          .onChange(async (value) => {
            // Split by newlines and filter out empty lines
            this.plugin.settings.excludedFolders = value
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 40;
      });

    // Show API version if available
    if (this.plugin.settings.apiVersion) {
      new Setting(containerEl)
        .setName('API Version')
        .setDesc(`Connected to Open Notebook API version: ${this.plugin.settings.apiVersion}`);
    }
  }
}
