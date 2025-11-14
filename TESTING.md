# Open Notebook Plugin - Testing Guide

This document provides comprehensive testing procedures for the Open Notebook plugin.

## Prerequisites

Before testing, ensure you have:
- [ ] Obsidian installed (version 0.15.0 or higher)
- [ ] An Open Notebook API instance running
- [ ] API endpoint URL and password
- [ ] Test vault with sample markdown files

---

## Phase 1: Initial Setup Testing

### Test 1.1: Plugin Installation
- [ ] Plugin loads without errors
- [ ] Plugin appears in Settings > Community Plugins
- [ ] Plugin can be enabled/disabled
- [ ] Status bar item appears when enabled

### Test 1.2: Settings Tab Access
- [ ] Open Settings > Open Notebook
- [ ] All settings sections are visible
- [ ] Settings UI renders correctly on desktop
- [ ] Settings UI renders correctly on mobile (if applicable)

---

## Phase 2: Connection Testing

### Test 2.1: API Connection
- [ ] Enter valid API endpoint and password
- [ ] Click "Test Connection" button
- [ ] Success notice appears with API version
- [ ] Connection status shows "Connected" (green dot)
- [ ] Detected features are displayed

### Test 2.2: Invalid Connection
- [ ] Enter invalid endpoint
- [ ] Connection test fails with clear error message
- [ ] Status shows "Connection Error" (red dot)
- [ ] Try invalid password - appropriate error shown

### Test 2.3: Connection Status Persistence
- [ ] Reload Obsidian
- [ ] Connection status persists from previous session
- [ ] Last connection check timestamp is displayed

---

## Phase 3: Notebook Management Testing

### Test 3.1: Create Notebook from Folder
**Via Context Menu:**
- [ ] Right-click unmapped folder in file explorer
- [ ] Select "Create Open Notebook"
- [ ] Enter notebook name in modal
- [ ] Notebook created successfully
- [ ] Folder now shows as mapped in settings

**Via Command Palette:**
- [ ] Open command palette (Ctrl/Cmd+P)
- [ ] Search for "Create Notebook from Folder"
- [ ] Select folder from list
- [ ] Notebook created successfully

### Test 3.2: Link Folder to Existing Notebook
**Via Context Menu:**
- [ ] Right-click unmapped folder
- [ ] Select "Link to Open Notebook"
- [ ] Choose notebook from list
- [ ] Folder is linked successfully

**Via Command Palette:**
- [ ] Use "Link Folder to Notebook" command
- [ ] Select folder and notebook
- [ ] Linking successful

### Test 3.3: Unlink Folder
**Via Context Menu:**
- [ ] Right-click mapped folder
- [ ] Select "Unlink from Open Notebook"
- [ ] Confirm unlink
- [ ] Folder unmapped successfully

**Via Command Palette:**
- [ ] Use "Unlink Folder from Notebook" command
- [ ] Select folder
- [ ] Unlink successful

### Test 3.4: List Notebooks
- [ ] Run "List Notebooks" command
- [ ] Modal shows all notebooks
- [ ] Each notebook shows mapped folder (if any)
- [ ] "(not mapped)" shown for unmapped notebooks
- [ ] Can close modal with button or click outside

---

## Phase 4: File Synchronization Testing

### Test 4.1: Sync Single File
- [ ] Open markdown file in mapped folder
- [ ] Run "Sync Current File" command
- [ ] Success notice appears
- [ ] File appears in Open Notebook
- [ ] Status bar shows updated "last sync" time
- [ ] Sync indicator appears in file tree

### Test 4.2: Sync Folder
**Via Context Menu:**
- [ ] Right-click mapped folder
- [ ] Select "Sync Folder to Open Notebook"
- [ ] All markdown files sync successfully
- [ ] Success notice shows count

**Via Command Palette:**
- [ ] Use "Sync Folder" command
- [ ] Folder syncs successfully

### Test 4.3: Full Sync
- [ ] Create multiple mapped folders with files
- [ ] Run "Full Sync (All Mapped Folders)" command
- [ ] All folders sync successfully
- [ ] Total count shown in notice
- [ ] Last sync time updates in status bar

### Test 4.4: Auto-Sync on Save
- [ ] Enable "Sync on Save" in settings
- [ ] Edit file in mapped folder
- [ ] Save file (Ctrl/Cmd+S)
- [ ] File auto-syncs to Open Notebook
- [ ] Success notice appears

### Test 4.5: Sync on Startup
- [ ] Enable "Sync on Startup" in settings
- [ ] Reload Obsidian
- [ ] Sync verification runs automatically
- [ ] Notice shows verification results

---

## Phase 5: Offline Queue Testing

### Test 5.1: Offline Operation Queueing
- [ ] Disconnect from network/Stop API server
- [ ] Try to sync files
- [ ] Operations added to offline queue
- [ ] Status bar shows queue count (e.g., "Open Notebook (3)")
- [ ] Tooltip shows queue size

### Test 5.2: Retry Offline Operations
- [ ] Reconnect to network/Start API server
- [ ] Run "Retry Offline Operations" command
- [ ] Queued operations process
- [ ] Queue count decreases
- [ ] Success notice when queue cleared

### Test 5.3: Clear Offline Queue
- [ ] Add operations to queue (go offline and sync)
- [ ] Run "Clear Offline Queue" command
- [ ] Queue cleared successfully
- [ ] Status bar queue count removed

---

## Phase 6: Sync State Verification

### Test 6.1: Verify Sync State
- [ ] Run "Verify Sync State" command
- [ ] All synced files verified
- [ ] Notice shows verification results
- [ ] Counts for verified/resynced/removed/failed

### Test 6.2: Check for Conflicts
- [ ] Modify same file in Obsidian and Open Notebook
- [ ] Run "Check for Sync Conflicts" command
- [ ] Conflict detected and modal shown
- [ ] Can choose local or remote version
- [ ] Conflict resolved successfully

### Test 6.3: Refresh Sync Indicators
- [ ] Run "Refresh Sync Indicators" command
- [ ] File tree sync indicators update
- [ ] Success notice appears

---

## Phase 7: Chat Feature Testing

### Test 7.1: Open Chat View
**Via Ribbon Icon:**
- [ ] Click message-circle icon in ribbon
- [ ] Chat view opens in right sidebar
- [ ] View shows "Not linked" if no folder context

**Via Command Palette:**
- [ ] Use "Open Chat" command
- [ ] Chat view opens successfully

### Test 7.2: Chat with Context
- [ ] Open file in mapped folder
- [ ] Open chat view
- [ ] Chat shows notebook context (📚 Notebook Name)
- [ ] Can type and send messages
- [ ] AI responses appear
- [ ] Responses animate letter-by-letter

### Test 7.3: New Chat Session
- [ ] In chat view, click "+ New" button
- [ ] New session created
- [ ] Previous messages cleared
- [ ] Can send messages in new session

**Via Command Palette:**
- [ ] Use "New Chat Session" command
- [ ] New session created successfully

### Test 7.4: Chat Context Switching
- [ ] Open file in Folder A (mapped)
- [ ] Chat shows Folder A's notebook
- [ ] Switch to file in Folder B (mapped)
- [ ] Chat context updates to Folder B's notebook
- [ ] Messages cleared for new context

---

## Phase 8: Search & Ask Testing

### Test 8.1: Search Open Notebook
- [ ] Run "Search Open Notebook" command
- [ ] Search modal appears
- [ ] Enter search query
- [ ] Results appear
- [ ] Can click result to insert into note
- [ ] Can copy result to clipboard

### Test 8.2: Ask Open Notebook
- [ ] Run "Ask Open Notebook" command
- [ ] Enter question
- [ ] AI generates answer
- [ ] Answer inserted into active file (if editor open)
- [ ] Or new note created with answer (if no editor)

---

## Phase 9: AI Transformations Testing

### Test 9.1: Transform Note (File Context Menu)
- [ ] Right-click markdown file
- [ ] Select "Transform Note"
- [ ] Transformation picker appears
- [ ] Select transformation
- [ ] Result modal shows original and transformed text
- [ ] Can accept, copy, or retry
- [ ] Accept replaces file content

### Test 9.2: Quick Summary (File Context Menu)
- [ ] Right-click markdown file
- [ ] Select "Quick Summary"
- [ ] Summary generated automatically
- [ ] Result modal shows summary
- [ ] Can accept/copy/retry

### Test 9.3: Quick Insights (File Context Menu)
- [ ] Right-click markdown file
- [ ] Select "Quick Insights"
- [ ] Insights generated
- [ ] Can accept/copy/retry

### Test 9.4: Transform Selection (Command)
- [ ] Select text in editor
- [ ] Run "Transform Selection" command
- [ ] Transformation picker appears
- [ ] Select transformation
- [ ] Result shown in modal
- [ ] Accept replaces selection
- [ ] Copy copies to clipboard

### Test 9.5: Transform Selection (Editor Context Menu)
- [ ] Select text in editor
- [ ] Right-click selection
- [ ] Select "Transform Selection"
- [ ] Works same as command

### Test 9.6: Quick Summary (Selection)
- [ ] Select text in editor
- [ ] Right-click selection
- [ ] Select "Quick Summary"
- [ ] Summary generated
- [ ] Can replace selection or copy

### Test 9.7: Quick Insights (Selection)
- [ ] Select text in editor
- [ ] Right-click selection
- [ ] Select "Quick Insights"
- [ ] Insights generated
- [ ] Can replace selection or copy

---

## Phase 10: AI Insights Testing

### Test 10.1: Generate AI Insight
- [ ] Right-click synced file
- [ ] Select "Generate AI Insight"
- [ ] Insight generated successfully
- [ ] Success notice appears

### Test 10.2: Browse Insights
**Via Context Menu:**
- [ ] Right-click synced file
- [ ] Select "Browse Insights"
- [ ] Modal shows all insights for file
- [ ] Can view insight content

**Via Command Palette:**
- [ ] Open synced file
- [ ] Run "Browse AI Insights" command
- [ ] Modal appears with insights

---

## Phase 11: Podcast Testing

### Test 11.1: Browse Podcasts
**Via Context Menu:**
- [ ] Right-click mapped folder
- [ ] Select "Browse Podcasts"
- [ ] Modal shows podcasts for notebook
- [ ] Can view podcast details

**Via Command Palette:**
- [ ] Open file in mapped folder
- [ ] Run "Browse Podcasts" command
- [ ] Modal appears with podcasts

---

## Phase 12: Settings Testing

### Test 12.1: Sync Mode Settings
- [ ] Change sync mode to "Realtime"
- [ ] Files sync immediately on change
- [ ] Change to "Manual"
- [ ] Files only sync when commanded
- [ ] Change to "Interval"
- [ ] Files sync at specified interval

### Test 12.2: Conflict Resolution
- [ ] Change conflict resolution strategy
- [ ] Setting persists after reload
- [ ] Strategy applies during conflict resolution

### Test 12.3: Model Selection
- [ ] Click "View Models" button
- [ ] Models list appears
- [ ] Select different chat model
- [ ] New chats use selected model

### Test 12.4: Mobile Optimization
- [ ] Enable "Mobile Optimized"
- [ ] UI adapts for mobile
- [ ] Touch targets increased (if enabled)
- [ ] Heavy features disabled on mobile (if enabled)

### Test 12.5: Debug Logging
- [ ] Enable "Enable Debug Logging"
- [ ] Open developer console
- [ ] Debug logs appear
- [ ] Disable logging
- [ ] Debug logs stop

---

## Phase 13: Status Bar Testing

### Test 13.1: Connection Status
- [ ] Connected: Green dot shown
- [ ] Disconnected: Red/gray dot shown
- [ ] Error: Red dot shown
- [ ] Tooltip shows status text

### Test 13.2: Queue Count
- [ ] Add operations to queue (go offline)
- [ ] Status bar shows count: "Open Notebook (3)"
- [ ] Tooltip shows "3 operations in queue"
- [ ] Process queue
- [ ] Count decreases/disappears

### Test 13.3: Last Sync Time
- [ ] Sync a file
- [ ] Status bar shows "• just now"
- [ ] Wait a minute
- [ ] Shows "• 1m ago"
- [ ] Tooltip shows full timestamp
- [ ] Time updates correctly (minutes, hours, days)

### Test 13.4: Click to Settings
- [ ] Click status bar item
- [ ] Settings open to Open Notebook tab

---

## Phase 14: Error Handling Testing

### Test 14.1: Network Errors
- [ ] Disconnect network
- [ ] Try to sync
- [ ] Clear error message shown
- [ ] Operation added to queue

### Test 14.2: Invalid File
- [ ] Try to sync empty file
- [ ] Appropriate warning shown

### Test 14.3: Missing Notebook
- [ ] Delete notebook mapping from settings
- [ ] Try to sync file
- [ ] Clear error about unmapped folder

### Test 14.4: API Errors
- [ ] Cause API error (invalid request)
- [ ] Error message shown to user
- [ ] Error logged (if debug enabled)

---

## Phase 15: Edge Cases & Stress Testing

### Test 15.1: Large Files
- [ ] Sync file with 10,000+ lines
- [ ] Sync completes successfully
- [ ] No performance issues

### Test 15.2: Many Files
- [ ] Sync folder with 100+ files
- [ ] All files sync
- [ ] Progress shown appropriately

### Test 15.3: Special Characters
- [ ] File with special characters in name
- [ ] Syncs successfully
- [ ] Content with Unicode/emoji
- [ ] Syncs correctly

### Test 15.4: Rapid Operations
- [ ] Rapidly sync multiple files
- [ ] Debouncing works correctly
- [ ] No duplicate operations

---

## Phase 16: Keyboard Shortcuts Testing

### Test 16.1: Configure Shortcuts
- [ ] Go to Settings > Hotkeys
- [ ] Search for "Open Notebook"
- [ ] All commands appear
- [ ] Can assign custom hotkeys

### Test 16.2: Use Shortcuts
- [ ] Assign hotkey to "Open Chat"
- [ ] Press hotkey
- [ ] Chat opens
- [ ] Test other assigned hotkeys

---

## Regression Testing Checklist

After any code changes, verify:
- [ ] Plugin loads without errors
- [ ] Settings persist after reload
- [ ] Sync operations work
- [ ] Chat view works
- [ ] Context menus appear
- [ ] Status bar updates
- [ ] No console errors

---

## Performance Testing

### Metrics to Monitor:
- [ ] Plugin load time < 2 seconds
- [ ] Settings UI responsive
- [ ] Chat messages appear promptly
- [ ] Sync operations complete in reasonable time
- [ ] No memory leaks (check dev tools)
- [ ] File tree renders quickly

---

## Accessibility Testing

- [ ] All buttons have aria-labels
- [ ] Modals can be closed with Escape
- [ ] Keyboard navigation works
- [ ] Screen reader friendly (if possible)
- [ ] Color contrast sufficient
- [ ] Focus indicators visible

---

## Test Results Template

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Plugin Version:** [Version]
**Obsidian Version:** [Version]
**Platform:** [Windows/Mac/Linux/iOS/Android]

**Tests Passed:** X/Y
**Critical Bugs:** [List]
**Minor Issues:** [List]
**Notes:** [Additional observations]

---

## Known Limitations

Document any features that are intentionally limited or not supported:
- Mobile limitations (if any)
- API version requirements
- Performance constraints
- Browser/platform specific issues

---

Last Updated: 2025-11-13
