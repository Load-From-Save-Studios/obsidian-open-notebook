# Open Notebook for Obsidian

Integrate [Open Notebook](https://github.com/lfnovo/open-notebook)'s AI-powered research capabilities directly into Obsidian. Chat with your notes, generate insights, create podcasts, and transform your content with advanced AI tools.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/obsidian-open-notebook)
[![Obsidian](https://img.shields.io/badge/obsidian-0.15.0+-purple.svg)](https://obsidian.md)

## ✨ Features

### 🔗 Seamless Synchronization
- **Automatic Sync**: Keep your Obsidian notes synchronized with Open Notebook
- **Smart Conflict Resolution**: Handle conflicts gracefully with multiple resolution strategies
- **Offline Queue**: Continue working offline; operations sync when you reconnect
- **Folder Mapping**: Link Obsidian folders to Open Notebook notebooks
- **Visual Indicators**: See sync status directly in the file tree

### 💬 AI Chat
- **Contextual Chat**: Chat about your notes with full notebook context
- **Multiple Sessions**: Create and switch between chat sessions
- **Smart Context**: Chat automatically updates based on the current file
- **Streaming Responses**: See AI responses appear in real-time

### 🔍 Search & Discovery
- **Semantic Search**: Find information across all your notebooks
- **Ask Questions**: Get AI-powered answers from your knowledge base
- **Insert Results**: Quickly insert search results and answers into your notes

### ✨ AI Transformations
- **Transform Notes**: Apply AI transformations to entire notes
- **Transform Selections**: Process selected text with AI
- **Quick Actions**: One-click summaries, insights, and more
- **Context Menu Integration**: Transform via right-click on files and selections

### 🎙️ Podcasts & Insights
- **Browse Podcasts**: Access AI-generated podcasts from your notebooks
- **Generate Insights**: Create AI insights for your notes
- **Browse Insights**: View all insights for any synced file

### 📊 Visual Feedback
- **Sync Indicators**: See sync status in the file tree
- **Enhanced Status Bar**: Monitor connection, queue size, and last sync time
- **Real-time Updates**: Visual feedback for all operations

---

## 📋 Prerequisites

You need a running Open Notebook instance. The easiest way is using Docker:

```bash
docker run -d \
  --name open-notebook \
  -p 8000:8000 \
  -e OPEN_NOTEBOOK_PASSWORD=your_password \
  -e OPENAI_API_KEY=your_openai_key \
  -v $(pwd)/data:/app/data \
  lfnovo/open-notebook:0.2.2
```

Or using Docker Compose:

```yaml
version: '3.8'
services:
  open-notebook:
    image: lfnovo/open-notebook:0.2.2
    ports:
      - "8000:8000"
    environment:
      - OPEN_NOTEBOOK_PASSWORD=${OPEN_NOTEBOOK_PASSWORD}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
```

For more setup options, see the [Open Notebook documentation](https://github.com/lfnovo/open-notebook).

---

## 🚀 Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Obsidian Settings
2. Go to **Community Plugins** and disable Safe Mode
3. Click **Browse** and search for "Open Notebook"
4. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/yourusername/obsidian-open-notebook/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/obsidian-open-notebook/` directory
3. Reload Obsidian
4. Enable the plugin in Settings > Community Plugins

---

## ⚡ Quick Start

### 1. Connect to Open Notebook

1. Open **Settings > Open Notebook**
2. Enter your **API Endpoint** (e.g., `http://localhost:8000`)
3. Enter your **API Password**
4. Click **Test Connection**
5. Verify the connection succeeds and features are detected

### 2. Link a Folder to a Notebook

**Create New Notebook:**
```
Right-click folder → Create Open Notebook → Enter name
```

**Link to Existing Notebook:**
```
Right-click folder → Link to Open Notebook → Select notebook
```

### 3. Sync Your Notes

**Sync Individual File:**
```
Ctrl/Cmd+P → "Sync Current File to Open Notebook"
```

**Sync Entire Folder:**
```
Right-click folder → Sync Folder to Open Notebook
```

**Sync Everything:**
```
Ctrl/Cmd+P → "Full Sync (All Mapped Folders)"
```

### 4. Start Chatting

1. Click the **message icon** in the left ribbon
2. Type your message and press Enter
3. Chat context updates based on your current file's folder

---

## 📚 Core Features

### Folder & Notebook Management

#### Create Notebook from Folder
```
Right-click folder → Create Open Notebook
OR
Ctrl/Cmd+P → "Create Notebook from Folder"
```

#### Link to Existing Notebook
```
Right-click folder → Link to Open Notebook
OR
Ctrl/Cmd+P → "Link Folder to Notebook"
```

#### Unlink Folder
```
Right-click folder → Unlink from Open Notebook
OR
Ctrl/Cmd+P → "Unlink Folder from Notebook"
```

#### List All Notebooks
```
Ctrl/Cmd+P → "List Notebooks"
```

---

### Synchronization

#### Sync Modes

**Realtime** (Default): Files sync immediately on change with debouncing
```
Settings → Synchronization → Sync Mode: Realtime
```

**Manual**: Files only sync when you explicitly trigger sync
```
Settings → Synchronization → Sync Mode: Manual
```

**Interval**: Files sync at regular intervals
```
Settings → Synchronization → Sync Mode: Interval
```

#### Sync Commands

| Command | Description |
|---------|-------------|
| Sync Current File | Sync the active file |
| Sync Folder | Sync current file's folder |
| Full Sync (All Mapped Folders) | Sync all linked folders |
| Verify Sync State | Reconcile with Open Notebook |
| Check for Conflicts | Check active file for conflicts |
| Refresh Sync Indicators | Update file tree indicators |

#### Conflict Resolution

When conflicts are detected:
- **Keep Local**: Use your Obsidian version
- **Keep Remote**: Use the Open Notebook version
- **Cancel**: Don't resolve now

Configure automatic resolution in Settings → Synchronization → Conflict Resolution Strategy

---

### AI Chat

#### Open Chat
```
Click ribbon icon (message-circle)
OR
Ctrl/Cmd+P → "Open Chat"
```

#### Context Switching
The chat automatically updates based on:
- Your current file's folder
- The notebook linked to that folder

Switch between files to change chat context.

#### New Session
```
Click "+ New" in chat header
OR
Ctrl/Cmd+P → "New Chat Session"
```

**Tips:**
- `Enter` to send, `Shift+Enter` for new line
- Chat sessions are preserved in Open Notebook
- Context shows as "📚 Notebook Name"

---

### AI Transformations

#### Transform Entire Notes

**From File Explorer:**
```
Right-click file → Transform Note (opens picker)
Right-click file → Quick Summary (instant)
Right-click file → Quick Insights (instant)
```

#### Transform Selected Text

**Select text, then:**
```
Right-click → Transform Selection
Right-click → Quick Summary
Right-click → Quick Insights
OR
Ctrl/Cmd+P → "Transform Selection"
```

#### Result Modal
After transformation:
- **Accept**: Replace original text
- **Copy**: Copy to clipboard
- **Retry**: Run again
- **Close**: Discard

---

### Search & Ask

#### Search
```
Ctrl/Cmd+P → "Search Open Notebook"
```
1. Enter query
2. Browse results
3. Click to insert or copy

#### Ask Questions
```
Ctrl/Cmd+P → "Ask Open Notebook"
```
1. Enter question
2. AI generates answer
3. Answer inserted into note

---

### Insights & Podcasts

#### Generate Insight
```
Right-click synced file → Generate AI Insight
```

#### Browse Insights
```
Right-click synced file → Browse Insights
OR
Ctrl/Cmd+P → "Browse AI Insights"
```

#### Browse Podcasts
```
Right-click linked folder → Browse Podcasts
OR
Ctrl/Cmd+P → "Browse Podcasts"
```

---

### Offline Mode

#### Automatic Queueing
When offline:
- Sync operations are queued automatically
- Status bar shows count: `Open Notebook (3)`
- Operations process when reconnected

#### Queue Management
```
Ctrl/Cmd+P → "Retry Offline Operations"
Ctrl/Cmd+P → "Clear Offline Queue"
```

---

## ⚙️ Settings

### Connection Settings
- API Endpoint
- API Password
- Test Connection button
- Connection status indicator

### Synchronization
- **Sync Mode**: Realtime / Manual / Interval
- **Sync on Save**: Auto-sync when saving files
- **Sync Debounce**: Delay before syncing (ms)
- **Sync Interval**: Minutes between syncs (Interval mode)
- **Conflict Resolution**: How to handle conflicts
- **Sync Attachments**: Sync images and files
- **Sync on Startup**: Verify sync state on launch

### Features
- Enable Chat
- Enable Search
- Enable Transformations
- Enable Podcasts

### UI Preferences
- Chat Sidebar Position (Left/Right)
- Default Search Mode (Text/Vector)
- Show Sync Status
- Show Notifications

### Advanced Settings

**Model Selection:**
- Default Chat Model
- Default Transformation Model
- Large Context Model
- View Models button

**Mobile Optimization:**
- Mobile Optimized UI
- Disable Heavy Features on Mobile
- Increased Touch Targets

**System:**
- Enable Debug Logging
- Request Timeout (seconds)
- Retry Attempts
- Excluded Folders

---

## 📊 Status Bar

The status bar (bottom-right) shows:

| Indicator | Meaning |
|-----------|---------|
| 🟢 | Connected to API |
| 🔴 | Connection error |
| ⚪ | Disconnected |
| `(3)` | 3 operations queued |
| `• 5m ago` | Last sync 5 minutes ago |

**Click status bar** to open settings
**Hover** for detailed tooltip

---

## ⌨️ Keyboard Shortcuts

Assign custom shortcuts in **Settings > Hotkeys**

Search for "Open Notebook" to see all commands.

**Suggested shortcuts:**
- Open Chat: `Ctrl/Cmd+Shift+O`
- Search: `Ctrl/Cmd+Shift+F`
- Sync Current File: `Ctrl/Cmd+Shift+S`
- Transform Selection: `Ctrl/Cmd+Shift+T`

---

## 🔧 Troubleshooting

### Connection Issues

**"Connection test failed"**
- Verify API endpoint URL
- Check API server is running
- Verify password
- Check firewall/network

**"Connection timeout"**
- Increase request timeout in settings
- Check network connection
- Verify API server responsiveness

### Sync Issues

**"File not syncing"**
- Check folder is linked
- Verify file is markdown (.md)
- Check not in excluded folders
- Run "Refresh Sync Indicators"

**"Sync conflict detected"**
- Run "Check for Conflicts"
- Choose resolution strategy
- Or run "Verify Sync State"

**Queue growing**
- Check internet connection
- Run "Retry Offline Operations"
- If stuck: "Clear Offline Queue" (loses pending ops)

### Chat Issues

**"Not linked to Open Notebook"**
- Open file in linked folder
- Or link current folder

**Chat not responding**
- Check API connection
- Verify chat model available
- Check API server logs

### Performance Issues

**Plugin slow to load**
- Disable "Sync on Startup"
- Exclude large folders
- Reduce mapped folders

**Sync taking too long**
- Check network speed
- Reduce debounce duration
- Exclude unnecessary files

### Debug Logging

1. Settings → Open Notebook → Advanced
2. Enable "Debug Logging"
3. Open Developer Console (`Ctrl/Cmd+Shift+I`)
4. Look for `[Open Notebook]` logs

---

## 💡 Tips & Best Practices

### Folder Organization
- Create separate folders for different projects
- Link each folder to its own notebook
- Use consistent naming conventions

### Sync Strategy
- **Realtime** for active projects
- **Interval** for reference folders
- **Manual** for experimental notes

### Conflict Prevention
- Sync before major edits
- Don't edit same note simultaneously
- Run "Verify Sync State" periodically

### Performance
- Exclude large binary files
- Use sync debouncing
- Disable heavy features on mobile

---

## 🛠️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build
```

### Project Structure

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

### Testing

See [TESTING.md](./TESTING.md) for comprehensive testing procedures.

### Implementation Status

This plugin implements all features from Phases 1-7:

- ✅ Phase 1: Foundation (API client, settings)
- ✅ Phase 2: Notebook & Source Management
- ✅ Phase 3: AI Chat Integration
- ✅ Phase 4: Search & Discovery
- ✅ Phase 5: Transformations & AI Tools
- ✅ Phase 6: Sync & Conflict Resolution
- ✅ Phase 7: Advanced Features (Podcasts, Insights)
- 🚧 Phase 8: Testing & Documentation (in progress)

See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for detailed technical documentation.

---

## 📝 FAQ

**Q: Do I need Open Notebook running?**
A: Yes, you need an Open Notebook API server instance.

**Q: Can I use with multiple vaults?**
A: Yes, each vault has its own settings.

**Q: Are notes sent to external servers?**
A: Only to your configured API endpoint. If local, data stays local.

**Q: What if I delete a linked folder?**
A: Mapping removed automatically. Open Notebook data remains.

**Q: Can I link one folder to multiple notebooks?**
A: No, one folder = one notebook.

**Q: Does this work on mobile?**
A: Yes! Enable "Mobile Optimized" in settings.

**Q: What file types are supported?**
A: Markdown (.md) files. Attachments optional.

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- [Open Notebook](https://github.com/lfnovo/open-notebook)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins)
- [Issue Tracker](https://github.com/yourusername/obsidian-open-notebook/issues)
- [Discussions](https://github.com/yourusername/obsidian-open-notebook/discussions)

---

## 🙏 Acknowledgments

This plugin integrates with [Open Notebook](https://github.com/lfnovo/open-notebook) by [@lfnovo](https://github.com/lfnovo).

Made with ❤️ for the Obsidian community.

---

**Version 1.0.0** | Last Updated: 2025-11-13
