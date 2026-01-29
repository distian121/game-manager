/**
 * 摘录命令模块 - 实现 SuperMemo 风格的增量阅读工作流
 *
 * 工作流：
 * 1. 从副本中选中文本，按 Alt+X 创建子副本
 * 2. 子副本继承父副本的标签路径，形成层级结构
 * 3. 对子副本内容进行提炼，按 Alt+S/E 生成技能或装备
 * 4. 所有知识自动记录来源，支持溯源
 */

import { Editor, MarkdownView, MarkdownFileInfo, TFile, Notice, normalizePath } from 'obsidian';
import type GameManagerPlugin from '../main';
import { showInputModal } from '../ui/InputModal';

export class ExtractCommands {
  private plugin: GameManagerPlugin;
  // 防止重复执行的锁
  private isProcessing = false;

  constructor(plugin: GameManagerPlugin) {
    this.plugin = plugin;
  }

  /**
   * 从选中文本创建子副本
   * Alt+X 快捷键
   */
  async extractToSubDungeon(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
    // 防止重复执行
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      const selectedText = editor.getSelection();
      if (!selectedText) {
        new Notice('请先选中要摘录的文本');
        return;
      }

      const currentFile = view.file;
      if (!currentFile) {
        new Notice('无法获取当前文件');
        return;
      }

      // 获取当前文件的副本标签路径
      const parentPath = await this.getDungeonPath(currentFile);

      // 弹窗输入子副本名称
      const result = await showInputModal(this.plugin.app, {
        title: '创建子副本',
        namePlaceholder: '输入子副本名称',
        showDescription: false,
      });

      if (!result?.name) return;

      const subName = result.name;

      // 构建新标签
      const newTag = parentPath.length > 0
        ? `#dungeon-${parentPath.join('-')}-${subName}`
        : `#dungeon-${subName}`;

      // 确定文件位置（与父文件同目录）
      const parentDir = currentFile.parent?.path || '';
      const newFilePath = normalizePath(`${parentDir}/${subName}.md`);

      // 检查文件是否已存在
      const existingFile = this.plugin.app.vault.getAbstractFileByPath(newFilePath);
      if (existingFile) {
        new Notice(`文件已存在: ${subName}.md`);
        return;
      }

      // 创建文件内容
      const sourceLine = editor.getCursor('from').line + 1;
      const content = this.buildSubDungeonContent({
        tag: newTag,
        name: subName,
        extractedText: selectedText,
        sourceFile: currentFile.path,
        sourceLine,
      });

      // 创建文件
      const newFile = await this.plugin.app.vault.create(newFilePath, content);

      // 在原文处插入链接
      const linkText = `\n\n> 📝 摘录至 [[${subName}]]\n`;
      editor.replaceSelection(selectedText + linkText);

      // 打开新文件
      await this.plugin.app.workspace.openLinkText(newFile.path, '', true);

      new Notice(`已创建子副本: ${subName}`);
    } catch (error) {
      new Notice(`创建文件失败: ${error}`);
    } finally {
      // 延迟重置锁，防止快速连续触发
      setTimeout(() => {
        this.isProcessing = false;
      }, 500);
    }
  }

  /**
   * 从选中文本提炼为技能
   * Alt+S 快捷键
   */
  async extractToSkill(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
    await this.extractToType(editor, view, 'skill');
  }

  /**
   * 从选中文本提炼为装备
   * Alt+E 快捷键
   */
  async extractToEquipment(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
    await this.extractToType(editor, view, 'equip');
  }

  /**
   * 通用提炼方法
   */
  private async extractToType(
    editor: Editor,
    view: MarkdownView | MarkdownFileInfo,
    type: 'skill' | 'equip'
  ): Promise<void> {
    // 防止重复执行
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      const selectedText = editor.getSelection();
      const currentFile = view.file;
      if (!currentFile) {
        new Notice('无法获取当前文件');
        return;
      }

      const typeLabel = type === 'skill' ? '技能' : '装备';
      const typeIcon = type === 'skill' ? '⚔️' : '🛡️';

      // 弹窗输入信息
      const result = await showInputModal(this.plugin.app, {
        title: `提炼为${typeLabel}`,
        namePlaceholder: `输入${typeLabel}名称`,
        showDescription: true,
      });

      if (!result?.name) return;

      const name = result.name;
      const sourceLine = editor.getCursor('from').line + 1;

      // 构建标签（简单分类，用户可后续调整）
      const tag = `#${type}-${name}`;

      // 判断模式：短内容就地插入，长内容创建文件
      if (selectedText && selectedText.length < 300) {
        // 就地插入模式
        const content = `\n\n${tag}\n${selectedText}\n`;
        editor.replaceSelection(content);
        new Notice(`已添加${typeLabel}: ${name}`);
      } else {
        // 创建独立文件模式
        const parentDir = currentFile.parent?.path || '';
        const filePath = normalizePath(`${parentDir}/${name}.md`);

        // 检查文件是否已存在
        const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
          new Notice(`文件已存在: ${name}.md`);
          return;
        }

        const fileContent = this.buildKnowledgeContent({
          tag,
          name,
          type,
          description: result.description,
          extractedText: selectedText || '',
          sourceFile: currentFile.path,
          sourceLine,
        });

        try {
          await this.plugin.app.vault.create(filePath, fileContent);

          // 在原位置插入链接
          const replacement = selectedText
            ? `${selectedText}\n\n> ${typeIcon} 已提炼为${typeLabel} [[${name}]]\n`
            : `> ${typeIcon} 已创建${typeLabel} [[${name}]]\n`;
          editor.replaceSelection(replacement);

          new Notice(`已创建${typeLabel}: ${name}`);
        } catch (error) {
          new Notice(`创建文件失败: ${error}`);
        }
      }
    } finally {
      // 延迟重置锁，防止快速连续触发
      setTimeout(() => {
        this.isProcessing = false;
      }, 500);
    }
  }

  /**
   * 获取当前文件的副本标签路径
   */
  private async getDungeonPath(file: TFile): Promise<string[]> {
    try {
      const content = await this.plugin.app.vault.read(file);
      const match = content.match(/#dungeon(-[a-zA-Z0-9\u4e00-\u9fa5_]+)+/);
      if (!match) return [];

      // 解析标签获取路径
      const tagContent = match[0].substring(9); // 去掉 #dungeon-
      return tagContent.split('-').filter(p => p.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * 构建子副本文件内容
   */
  private buildSubDungeonContent(params: {
    tag: string;
    name: string;
    extractedText: string;
    sourceFile: string;
    sourceLine: number;
  }): string {
    const sourceFileName = params.sourceFile.replace('.md', '');
    return `---
source: "[[${sourceFileName}]]"
source-line: ${params.sourceLine}
created: ${new Date().toISOString()}
type: extract
---

${params.tag}

# ${params.name}

## 摘录内容

${params.extractedText}

## 我的理解

<!-- 在这里添加你的思考和总结 -->
<!-- 可以继续使用 Alt+X 摘录，或使用 Alt+S/E 提炼为技能/装备 -->

`;
  }

  /**
   * 构建技能/装备文件内容
   */
  private buildKnowledgeContent(params: {
    tag: string;
    name: string;
    type: 'skill' | 'equip';
    description?: string;
    extractedText: string;
    sourceFile: string;
    sourceLine: number;
  }): string {
    const sourceFileName = params.sourceFile.replace('.md', '');
    const typeLabel = params.type === 'skill' ? '技能' : '装备';

    return `---
source: "[[${sourceFileName}]]"
source-line: ${params.sourceLine}
created: ${new Date().toISOString()}
type: ${params.type}
---

${params.tag}

# ${params.name}

${params.description ? `## 描述\n\n${params.description}\n` : ''}
## 内容

${params.extractedText || `<!-- 在这里详细描述这个${typeLabel} -->`}

## 关联

<!-- 可以链接相关的技能、装备或副本 -->

`;
  }
}
