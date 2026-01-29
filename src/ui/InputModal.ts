/**
 * 输入对话框 - 用于套装创建等需要用户输入的场景
 */

import { App, Modal, Setting } from 'obsidian';

export interface InputModalResult {
  name: string;
  description?: string;
}

export class InputModal extends Modal {
  private result: InputModalResult | null = null;
  private onSubmit: (result: InputModalResult | null) => void;
  private title: string;
  private namePlaceholder: string;
  private showDescription: boolean;

  constructor(
    app: App,
    options: {
      title: string;
      namePlaceholder?: string;
      showDescription?: boolean;
    },
    onSubmit: (result: InputModalResult | null) => void
  ) {
    super(app);
    this.title = options.title;
    this.namePlaceholder = options.namePlaceholder || '输入名称';
    this.showDescription = options.showDescription ?? true;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('gm-input-modal');

    contentEl.createEl('h2', { text: this.title });

    let nameValue = '';
    let descValue = '';

    // 名称输入
    new Setting(contentEl)
      .setName('名称')
      .setDesc('套装名称（将作为文件名）')
      .addText((text) =>
        text
          .setPlaceholder(this.namePlaceholder)
          .onChange((value) => {
            nameValue = value;
          })
      );

    // 描述输入（可选）
    if (this.showDescription) {
      new Setting(contentEl)
        .setName('描述')
        .setDesc('简短描述（可选）')
        .addTextArea((textarea) =>
          textarea
            .setPlaceholder('输入套装描述...')
            .onChange((value) => {
              descValue = value;
            })
        );
    }

    // 按钮区域
    const buttonContainer = contentEl.createDiv({ cls: 'gm-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: '取消',
      cls: 'gm-btn',
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const submitBtn = buttonContainer.createEl('button', {
      text: '创建',
      cls: 'gm-btn gm-btn-primary',
    });
    submitBtn.addEventListener('click', () => {
      if (nameValue.trim()) {
        this.result = {
          name: nameValue.trim(),
          description: descValue.trim() || undefined,
        };
        this.close();
      }
    });

    // 支持回车提交
    contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (nameValue.trim()) {
          this.result = {
            name: nameValue.trim(),
            description: descValue.trim() || undefined,
          };
          this.close();
        }
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.onSubmit(this.result);
  }
}

/**
 * 便捷函数：显示输入对话框并返回 Promise
 */
export function showInputModal(
  app: App,
  options: {
    title: string;
    namePlaceholder?: string;
    showDescription?: boolean;
  }
): Promise<InputModalResult | null> {
  return new Promise((resolve) => {
    const modal = new InputModal(app, options, (result) => {
      resolve(result);
    });
    modal.open();
  });
}
