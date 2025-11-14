// Modal for creating/editing notebooks
import { App, Modal, Setting } from 'obsidian';
import { NotebookCreate } from '../types/notebook';

export class NotebookModal extends Modal {
  private name: string = '';
  private description: string = '';
  private onSubmit: (data: NotebookCreate) => void;

  constructor(
    app: App,
    onSubmit: (data: NotebookCreate) => void,
    defaultName?: string
  ) {
    super(app);
    this.onSubmit = onSubmit;
    if (defaultName) {
      this.name = defaultName;
    }
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Create Notebook' });

    // Name input
    new Setting(contentEl)
      .setName('Notebook Name')
      .setDesc('Name for the new notebook')
      .addText(text => text
        .setPlaceholder('My Research Notebook')
        .setValue(this.name)
        .onChange(value => {
          this.name = value;
        }));

    // Description input
    new Setting(contentEl)
      .setName('Description')
      .setDesc('Optional description')
      .addTextArea(text => {
        text
          .setPlaceholder('A collection of research notes...')
          .setValue(this.description)
          .onChange(value => {
            this.description = value;
          });
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });

    // Buttons
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('Create')
        .setCta()
        .onClick(() => {
          if (!this.name.trim()) {
            // TODO: Show error
            return;
          }
          this.onSubmit({
            name: this.name.trim(),
            description: this.description.trim() || undefined
          });
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
