# Changelog

All notable changes to the Open Notebook plugin for Obsidian will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-11-13

### 🎉 Initial Stable Release

This is the first stable release of the Open Notebook plugin for Obsidian, integrating [Open Notebook](https://github.com/lfnovo/open-notebook)'s AI-powered research capabilities directly into Obsidian.

### ✨ Features

#### Phase 1: Foundation & Connection
- **API Client**: Robust API client with retry logic, exponential backoff, and timeout handling
- **Connection Management**: Connect to Open Notebook API with endpoint and password
- **Connection Testing**: Test and verify API connection with automatic feature detection
- **Settings Interface**: Comprehensive settings panel with all configuration options
- **Status Bar**: Real-time connection status indicator (connected/disconnected/error)
- **Debug Logging**: Configurable debug logging for troubleshooting
- **Error Handling**: Clear error messages with specific details for all operations

#### Phase 2: Notebook & Folder Management
- **Create Notebooks**: Create new Open Notebook notebooks from Obsidian folders
- **Link Folders**: Link existing Obsidian folders to Open Notebook notebooks
- **Unlink Folders**: Remove folder-to-notebook mappings with confirmation
- **List Notebooks**: View all notebooks with their folder mappings
- **Folder Context Menus**: Right-click folder actions for all notebook operations
- **Notebook Manager**: Service for managing folder-to-notebook mappings

#### Phase 3: AI Chat Integration
- **Chat View**: Dedicated sidebar view for AI conversations with notebook context
- **Contextual Chat**: Chat automatically updates based on current file's notebook
- **Chat Sessions**: Create and manage multiple chat sessions per notebook
- **Streaming Responses**: Real-time letter-by-letter streaming of AI responses
- **Chat History**: Persistent chat history stored in Open Notebook
- **Not Linked State**: Helpful guidance when no notebook context available
- **Ribbon Icon**: Quick access to chat via message-circle ribbon icon
- **New Chat Session Command**: Create new chat sessions with one command

#### Phase 4: Search & Discovery
- **Search Modal**: Advanced search across all notebooks with dual-pane interface
- **Text Search**: Traditional keyword-based search
- **Vector Search**: Semantic AI-powered search
- **Ask Questions**: Get AI-generated answers from your knowledge base
- **Search Results**: Browse results with titles, excerpts, and relevance scores
- **Result Preview**: Full markdown preview of selected results
- **Result Insertion**: Insert search results directly into notes
- **Search Scope**: Search specific notebooks or all notebooks

#### Phase 5: AI Transformations
- **Transform Notes**: Apply AI transformations to entire notes
- **Transform Selections**: Transform selected text with AI
- **Quick Actions**: One-click "Quick Summary" and "Quick Insights"
- **Transformation Picker**: Browse and select from available transformations
- **Result Modal**: Side-by-side comparison of original and transformed text
- **Transformation Preview**: Preview transformation details and prompts
- **Accept/Copy/Retry**: Flexible result management options
- **File Context Menu**: Transform notes via right-click
- **Editor Context Menu**: Transform selections via right-click
- **Search Filter**: Search for specific transformations

#### Phase 6: Synchronization & Conflict Resolution
- **Manual Sync**: Sync individual files or entire folders on command
- **Realtime Sync**: Automatic synchronization as you edit (with debouncing)
- **Interval Sync**: Scheduled synchronization at regular intervals
- **Sync on Save**: Option to sync files automatically when saving
- **Sync on Startup**: Verify and reconcile sync state when Obsidian launches
- **Full Sync Command**: Sync all mapped folders with one command
- **Offline Queue**: Queue sync operations when offline, process when reconnected
- **Conflict Detection**: Detect sync conflicts based on content hash
- **Conflict Resolution**: Choose local or remote version, or cancel
- **Conflict Modal**: Visual diff showing both versions with metadata
- **Sync Verification**: Verify and reconcile sync state with Open Notebook
- **Sync Indicators**: Visual indicators in file tree showing sync status
- **Last Sync Time**: Status bar shows relative time since last sync (e.g., "5m ago")
- **Queue Count**: Status bar shows pending operations count
- **Retry Operations**: Manually retry queued offline operations
- **Clear Queue**: Clear all pending operations
- **Debouncing**: Configurable debounce delay (0-5000ms) to prevent excessive syncing
- **Excluded Folders**: Configure folders to exclude from sync

#### Phase 7: Advanced Features
- **AI Insights**: Generate AI insights for synced files
- **Browse Insights**: View all insights for a file with preview
- **Insights Modal**: Dedicated modal for browsing and viewing insights
- **Podcasts**: Browse AI-generated podcasts from notebooks
- **Podcasts Modal**: Dedicated modal for browsing podcasts
- **Generate Insight**: Right-click synced files to generate insights
- **Feature Detection**: Automatic detection of available API features

### 🎨 UI/UX Polish (Phase 8.3)
- **Consistent Modal Styling**: All modals use CSS classes instead of inline styles
- **Escape Key Support**: Press Escape to close all modals
- **Keyboard Navigation**: Full keyboard support for modals and pickers
- **Hover Effects**: Visual feedback on interactive elements
- **Loading Indicators**: Visual feedback for all async operations
- **Error Messages**: Clear, descriptive error messages with specific details
- **Touch Optimization**: Increased touch targets on mobile (44px minimum)
- **Responsive Design**: Mobile-optimized layouts with stacked columns
- **Loading Spinners**: Animated spinners for long-running operations
- **Status Indicators**: Color-coded status (green=connected, red=error, gray=disconnected)

### ⚙️ Settings

**Connection Settings:**
- API Endpoint configuration
- API Password (secure input)
- Connection status display
- Test Connection button
- Last connection check timestamp
- Detected features display

**Notebook Mapping:**
- Mapping strategy (folder/tag/property)
- Folder-to-notebook mappings display
- Notebook tag prefix
- Notebook property name

**Synchronization:**
- Sync Mode (Realtime/Manual/Interval)
- Sync on Save toggle
- Sync Debounce Duration (0-5000ms slider)
- Sync Interval Minutes (1-60)
- Conflict Resolution Strategy (Ask/Keep Local/Keep Remote)
- Sync Attachments toggle
- Sync on Startup toggle

**Feature Toggles:**
- Enable Chat
- Enable Search
- Enable Transformations
- Enable Podcasts

**UI Preferences:**
- Chat Sidebar Position (Left/Right)
- Default Search Mode (Text/Vector)
- Show Sync Status
- Show Notifications

**Advanced Settings:**
- Default Chat Model selection (dropdown with available models)
- Default Transformation Model selection
- Large Context Model selection
- View Models button to see all available models
- Auto-Delete Files toggle
- Preferred Language
- Mobile Optimized toggle
- Disable Heavy Features on Mobile
- Increased Touch Targets
- Debug Logging toggle
- Request Timeout (10-120 seconds)
- Retry Attempts (1-5)
- Excluded Folders (comma-separated)

### 🎯 Commands

All commands support custom keyboard shortcuts configuration in Settings > Hotkeys.

**Connection & Setup:**
- Test API Connection
- Open Settings

**Chat:**
- Open Chat
- New Chat Session

**Sync:**
- Sync Current File to Open Notebook
- Sync Folder to Open Notebook
- Full Sync (All Mapped Folders)
- Verify Sync State (Reconcile with Open Notebook)
- Check for Sync Conflicts
- Refresh Sync Indicators

**Offline Queue:**
- Retry Offline Operations
- Clear Offline Queue

**Search & Discovery:**
- Search Open Notebook
- Ask Open Notebook

**AI Tools:**
- Browse AI Insights
- Transform Selection

**Podcasts:**
- Browse Podcasts

**Notebook Management:**
- Create Notebook from Folder
- Link Folder to Notebook
- Unlink Folder from Notebook
- List Notebooks

### 🖱️ Context Menus

**File Context Menu (Markdown Files):**
- Generate AI Insight (synced files only)
- Browse Insights (synced files only)
- Transform Note (opens transformation picker)
- Quick Summary (instant transformation)
- Quick Insights (instant transformation)

**Folder Context Menu:**
- **Mapped Folders:**
  - Sync Folder to Open Notebook
  - Browse Podcasts
  - Unlink from Open Notebook
- **Unmapped Folders:**
  - Create Open Notebook
  - Link to Open Notebook

**Editor Context Menu (Text Selection):**
- Transform Selection (opens transformation picker)
- Quick Summary (instant transformation)
- Quick Insights (instant transformation)

### 📚 Documentation (Phase 8.1-8.2)
- **README.md**: Comprehensive user-facing documentation
  - Features overview with emojis for visual appeal
  - Prerequisites and Docker setup instructions
  - Installation instructions (community plugins + manual)
  - Quick start guide (4-step setup)
  - Core features documentation with examples
  - Settings reference (all categories)
  - Status bar documentation
  - Keyboard shortcuts recommendations
  - Troubleshooting guide
  - Tips & best practices
  - FAQ (8 common questions)
  - Development and contributing sections
- **TESTING.md**: Comprehensive testing guide
  - 16 testing phases covering all features
  - 200+ individual test cases
  - Setup, connection, notebook, sync, chat, search, transformation testing
  - Offline queue, conflict resolution, insights, podcasts testing
  - Settings, status bar, error handling, edge cases
  - Performance and accessibility testing
  - Test results template
- **VERIFICATION_CHECKLIST.md**: Feature verification document
  - Complete list of all settings, commands, and context menu options
  - Implementation status for each feature
  - Comparison against TECHNICAL_SPEC.md requirements
  - Summary of completed features

### 🏗️ Technical Architecture

**Project Structure:**
```
src/
├── api/           # API client and adapters
├── services/      # Business logic services
├── managers/      # Sync and state management
├── views/         # UI views (chat, search, etc.)
├── modals/        # Modal dialogs
├── commands/      # Command definitions
├── settings/      # Settings tab
├── utils/         # Utility functions
├── types/         # TypeScript definitions
└── main.ts        # Plugin entry point
```

**Key Components:**
- **OpenNotebookClient**: API communication with retry and timeout handling
- **NotebookManager**: Manages folder-to-notebook mappings
- **ContentSyncManager**: Handles file synchronization and conflict detection
- **SyncIndicatorManager**: Updates file tree with sync indicators
- **OfflineQueue**: Queues operations when offline with persistence
- **FeatureDetector**: Detects available API features
- **ChatView**: Sidebar view for AI chat
- **SearchModal**: Advanced search interface
- **InsightsModal**: Browse and view AI insights
- **TransformModalWithResult**: Transformation picker and result display
- **ConflictModal**: Visual conflict resolution interface
- **PodcastModal**: Browse and manage podcasts

**Dependencies:**
- Obsidian API 0.15.0+
- Requires Open Notebook API server 0.2.2+
- No external runtime dependencies
- TypeScript 4.7.4+
- esbuild for bundling

**Platform Support:**
- Desktop (Windows, macOS, Linux)
- Mobile (iOS, Android) with optimizations
- Offline support with queue persistence

### 🔒 Security & Privacy
- No data sent to external servers (only to configured Open Notebook instance)
- Local-first architecture
- Secure password input in settings
- No telemetry or tracking
- All data stays on your devices and your Open Notebook instance

### ⚡ Performance
- Efficient sync with debouncing (configurable)
- Lazy loading of heavy features
- Optimized mobile performance with optional feature disabling
- Minimal plugin load time (<2 seconds target)
- Efficient file tree updates with sync indicators
- Request queuing for offline operations
- Connection pooling and retry logic
- Reduced animations on mobile for better performance

### 🎯 Mobile Optimizations
- Touch-friendly button sizes (44px minimum when enabled)
- Responsive layouts (stacked columns on mobile)
- Mobile-optimized modals (95% viewport width)
- Reduced font sizes on mobile
- Disabled animations option for performance
- Landscape orientation support
- Touch feedback on interactive elements

### 📋 Prerequisites
- Obsidian 0.15.0 or higher
- Open Notebook API server instance (local or remote)
  - Recommended: Open Notebook 0.2.2 or higher
  - Can be run via Docker for easy setup
- Network access to Open Notebook API endpoint

### Known Limitations
- Folder mapping is one-to-one (one folder per notebook)
- Only markdown (.md) files are synced
- Attachments sync is optional and separate
- Mobile features may be limited based on settings
- Some transformations may require large context models

---

## Version History

### [Unreleased]
- None

### [1.0.0] - 2025-11-13
- Initial stable release with complete feature set (Phases 1-8)

---

## Links
- [GitHub Repository](https://github.com/Load-From-Save-Studios/obsidian-open-notebook)
- [Open Notebook](https://github.com/lfnovo/open-notebook)
- [Issue Tracker](https://github.com/Load-From-Save-Studios/obsidian-open-notebook/issues)
- [Discussions](https://github.com/Load-From-Save-Studios/obsidian-open-notebook/discussions)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

See [LICENSE](LICENSE) for license information.

---

Made with ❤️ for the Obsidian community.
