// Modal for linking a folder to an existing notebook
import { App, Modal, Setting } from 'obsidian';
import { Notebook } from '../types/notebook';

export class LinkNotebookModal extends Modal {
  private notebooks: Notebook[];
  private selectedNotebookId: string | null = null;
  private onSubmit: (notebookId: string) => void;
  private folderPath: string;

  constructor(
    app: App,
    folderPath: string,
    notebooks: Notebook[],
    onSubmit: (notebookId: string) => void
  ) {
    super(app);
    this.folderPath = folderPath;
    this.notebooks = notebooks;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Link Folder to Notebook' });

    contentEl.createEl('p', {
      text: `Select a notebook to link with folder: ${this.folderPath}`
    });

    // Notebook selection dropdown
    new Setting(contentEl)
      .setName('Notebook')
      .setDesc('Choose an existing notebook')
      .addDropdown(dropdown => {
        // Add empty option
        dropdown.addOption('', '-- Select Notebook --');

        // Add notebooks
        this.notebooks.forEach(notebook => {
          const displayName = notebook.localPath
            ? `${notebook.name} (already mapped to ${notebook.localPath})`
            : notebook.name;
          dropdown.addOption(notebook.id, displayName);
        });

        dropdown.onChange(value => {
          this.selectedNotebookId = value;
        });
      });

    // Show unmapped notebooks count
    const unmappedCount = this.notebooks.filter(nb => !nb.localPath).length;
    contentEl.createEl('p', {
      text: `${unmappedCount} unmapped notebook(s) available`,
      cls: 'setting-item-description'
    });

    // Buttons
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('Link')
        .setCta()
        .onClick(() => {
          if (!this.selectedNotebookId) {
            // TODO: Show error
            return;
          }
          this.onSubmit(this.selectedNotebookId);
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
