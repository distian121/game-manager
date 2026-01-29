/**
 * 数据管理服务
 * 负责缓存数据、增量更新、树结构管理
 */

import { App, TFile, Vault } from 'obsidian';
import {
  GameManagerData,
  TreeNode,
  TreeItem,
  ParsedTag,
  GameSet,
  LinkedItem,
  DEFAULT_DATA,
  GameManagerSettings,
} from '../types';
import { parseTagsFromContent, buildPathFromTag } from './TagParser';

export class DataManager {
  private app: App;
  private data: GameManagerData;
  private settings: GameManagerSettings;

  constructor(app: App, settings: GameManagerSettings) {
    this.app = app;
    this.settings = settings;
    this.data = { ...DEFAULT_DATA };
  }

  /**
   * 加载缓存数据
   */
  loadData(savedData: GameManagerData | null): void {
    if (savedData && savedData.version) {
      this.data = savedData;
    } else {
      this.data = { ...DEFAULT_DATA };
    }
  }

  /**
   * 获取当前数据（用于保存）
   */
  getData(): GameManagerData {
    return this.data;
  }

  /**
   * 全量扫描 Vault 并构建数据
   */
  async fullScan(): Promise<void> {
    // 重置数据
    this.data = { ...DEFAULT_DATA };

    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      // 跳过隐藏文件夹中的非套装文件
      if (this.isInHiddenFolder(file.path) && !this.isSetFile(file.path)) {
        continue;
      }

      await this.processFile(file);
    }

    // 扫描套装
    await this.scanSets();

    this.data.lastUpdated = Date.now();
  }

  /**
   * 增量更新单个文件
   */
  async updateFile(file: TFile): Promise<void> {
    // 先移除该文件的旧数据
    this.removeFileFromIndex(file.path);

    // 重新处理文件
    await this.processFile(file);

    // 如果是套装文件，更新套装
    if (this.isSetFile(file.path)) {
      await this.updateSet(file);
    }

    this.data.lastUpdated = Date.now();
  }

  /**
   * 文件删除时移除数据
   */
  removeFile(filePath: string): void {
    this.removeFileFromIndex(filePath);

    // 如果是套装文件，移除套装
    if (this.isSetFile(filePath)) {
      this.data.sets = this.data.sets.filter(s => s.filePath !== filePath);
    }

    this.data.lastUpdated = Date.now();
  }

  /**
   * 处理单个文件
   */
  private async processFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const tags = parseTagsFromContent(content, file.path);

      // 存入文件索引
      this.data.fileIndex[file.path] = tags;

      // 将标签添加到对应的树结构
      for (const tag of tags) {
        this.addTagToTree(tag);
      }
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
    }
  }

  /**
   * 将标签添加到对应的树结构
   */
  private addTagToTree(tag: ParsedTag): void {
    let tree: TreeNode;
    switch (tag.type) {
      case 'skill':
        tree = this.data.skills;
        break;
      case 'equip':
        tree = this.data.equipment;
        break;
      case 'dungeon':
        tree = this.data.dungeon;
        break;
      default:
        return; // set 类型另外处理
    }

    const path = buildPathFromTag(tag);
    this.insertIntoTree(tree, path, tag);
  }

  /**
   * 将内容插入树结构
   */
  private insertIntoTree(tree: TreeNode, path: string[], tag: ParsedTag): void {
    let current = tree;

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      const isLast = i === path.length - 1;

      // 查找或创建子节点
      let child = current.children.find(c => c.name === segment);

      if (!child) {
        child = {
          name: segment,
          path: path.slice(0, i + 1),
          children: [],
          items: [],
          isLeaf: isLast,
        };
        current.children.push(child);
        // 按名称排序
        current.children.sort((a, b) => a.name.localeCompare(b.name));
      }

      if (isLast) {
        // 叶子节点，添加具体内容项
        child.isLeaf = true;
        child.items.push({
          content: tag.content,
          sourceFile: tag.sourceFile,
          lineNumber: tag.lineNumber,
          fullTag: tag.fullTag,
          textContent: tag.textContent,
          isFullFile: tag.isFullFile,
        });
      }

      current = child;
    }
  }

  /**
   * 从索引中移除文件数据
   */
  private removeFileFromIndex(filePath: string): void {
    const tags = this.data.fileIndex[filePath];
    if (!tags) return;

    // 从树中移除对应的项
    for (const tag of tags) {
      this.removeTagFromTree(tag);
    }

    delete this.data.fileIndex[filePath];
  }

  /**
   * 从树中移除标签
   */
  private removeTagFromTree(tag: ParsedTag): void {
    let tree: TreeNode;
    switch (tag.type) {
      case 'skill':
        tree = this.data.skills;
        break;
      case 'equip':
        tree = this.data.equipment;
        break;
      case 'dungeon':
        tree = this.data.dungeon;
        break;
      default:
        return;
    }

    const path = buildPathFromTag(tag);
    this.removeFromTree(tree, path, tag.sourceFile, tag.lineNumber);
  }

  /**
   * 从树结构中移除指定路径的项
   */
  private removeFromTree(tree: TreeNode, path: string[], sourceFile: string, lineNumber: number): void {
    if (path.length === 0) return;

    const segment = path[0];
    const childIndex = tree.children.findIndex(c => c.name === segment);

    if (childIndex === -1) return;

    const child = tree.children[childIndex];

    if (path.length === 1) {
      // 到达目标节点，移除匹配的项
      child.items = child.items.filter(
        item => !(item.sourceFile === sourceFile && item.lineNumber === lineNumber)
      );

      // 如果节点变空，移除整个节点
      if (child.items.length === 0 && child.children.length === 0) {
        tree.children.splice(childIndex, 1);
      }
    } else {
      // 递归处理
      this.removeFromTree(child, path.slice(1), sourceFile, lineNumber);

      // 检查子节点是否变空
      if (child.items.length === 0 && child.children.length === 0) {
        tree.children.splice(childIndex, 1);
      }
    }
  }

  /**
   * 扫描套装文件夹
   */
  async scanSets(): Promise<void> {
    this.data.sets = [];

    const setsFolder = this.settings.setsFolder;
    const folder = this.app.vault.getAbstractFileByPath(setsFolder);

    if (!folder) {
      // 文件夹不存在，创建它
      await this.ensureSetsFolder();
      return;
    }

    const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(setsFolder));

    for (const file of files) {
      await this.updateSet(file);
    }
  }

  /**
   * 更新单个套装
   */
  private async updateSet(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const name = file.basename;

      // 按章节解析链接
      const linkedDungeons: LinkedItem[] = [];
      const linkedSkills: LinkedItem[] = [];
      const linkedEquipment: LinkedItem[] = [];
      let description: string | undefined;

      // 分割内容为行
      const lines = content.split('\n');
      let currentSection = '';

      for (const line of lines) {
        // 检测章节标题
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].trim();
          continue;
        }

        // 提取描述（第一段非空文本）
        if (!description && currentSection === '描述' && line.trim()) {
          description = line.trim();
          continue;
        }

        // 解析 [[]] 链接
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        let match: RegExpExecArray | null;

        while ((match = linkRegex.exec(line)) !== null) {
          const linkText = match[1];

          // 根据章节确定类型
          if (currentSection.includes('副本') || currentSection.includes('来源') || currentSection.includes('灵感')) {
            linkedDungeons.push({ type: 'dungeon', linkText, section: currentSection });
          } else if (currentSection.includes('技能')) {
            linkedSkills.push({ type: 'skill', linkText, section: currentSection });
          } else if (currentSection.includes('装备')) {
            linkedEquipment.push({ type: 'equip', linkText, section: currentSection });
          } else {
            // 默认归类为技能
            linkedSkills.push({ type: 'skill', linkText, section: currentSection });
          }
        }
      }

      // 更新或添加套装
      const existingIndex = this.data.sets.findIndex(s => s.filePath === file.path);
      const set: GameSet = {
        name,
        filePath: file.path,
        linkedDungeons,
        linkedSkills,
        linkedEquipment,
        description,
      };

      if (existingIndex >= 0) {
        this.data.sets[existingIndex] = set;
      } else {
        this.data.sets.push(set);
      }
    } catch (error) {
      console.error(`Error processing set file ${file.path}:`, error);
    }
  }

  /**
   * 确保套装文件夹存在
   */
  async ensureSetsFolder(): Promise<void> {
    const setsFolder = this.settings.setsFolder;
    const exists = this.app.vault.getAbstractFileByPath(setsFolder);

    if (!exists) {
      await this.app.vault.createFolder(setsFolder);
    }
  }

  /**
   * 判断路径是否在隐藏文件夹中
   */
  private isInHiddenFolder(path: string): boolean {
    return path.startsWith('.');
  }

  /**
   * 判断是否为套装文件
   */
  private isSetFile(path: string): boolean {
    return path.startsWith(this.settings.setsFolder);
  }

  /**
   * 获取技能树
   */
  getSkillsTree(): TreeNode {
    return this.data.skills;
  }

  /**
   * 获取装备树
   */
  getEquipmentTree(): TreeNode {
    return this.data.equipment;
  }

  /**
   * 获取副本树
   */
  getDungeonTree(): TreeNode {
    return this.data.dungeon;
  }

  /**
   * 获取所有套装
   */
  getSets(): GameSet[] {
    return this.data.sets;
  }

  /**
   * 获取统计信息
   */
  getStats(): { skills: number; equipment: number; dungeon: number; sets: number } {
    return {
      skills: this.countItems(this.data.skills),
      equipment: this.countItems(this.data.equipment),
      dungeon: this.countItems(this.data.dungeon),
      sets: this.data.sets.length,
    };
  }

  /**
   * 统计树中的项数
   */
  private countItems(tree: TreeNode): number {
    let count = tree.items.length;
    for (const child of tree.children) {
      count += this.countItems(child);
    }
    return count;
  }

  /**
   * 创建新套装
   */
  async createSet(name: string, description?: string): Promise<TFile> {
    await this.ensureSetsFolder();
    const path = `${this.settings.setsFolder}/${name}.md`;
    const descText = description ? `${description}` : '';
    const content = `# ${name}

## 描述

${descText}

## 灵感来源（副本）


## 关联技能


## 关联装备

`;
    const file = await this.app.vault.create(path, content);
    await this.updateSet(file);
    return file;
  }

  /**
   * 向套装添加关联项
   */
  async addItemToSet(setFilePath: string, linkText: string, type: 'skill' | 'equip' | 'dungeon'): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(setFilePath);
    if (!(file instanceof TFile)) return;

    let content = await this.app.vault.read(file);

    // 确定要添加到的章节
    let sectionHeader: string;
    if (type === 'dungeon') {
      sectionHeader = '## 灵感来源（副本）';
    } else if (type === 'skill') {
      sectionHeader = '## 关联技能';
    } else {
      sectionHeader = '## 关联装备';
    }

    // 找到章节位置并插入链接
    const sectionIndex = content.indexOf(sectionHeader);
    if (sectionIndex === -1) {
      // 章节不存在，添加到末尾
      content += `\n${sectionHeader}\n\n- [[${linkText}]]\n`;
    } else {
      // 在章节后插入
      const insertPos = sectionIndex + sectionHeader.length;
      const restContent = content.substring(insertPos);
      // 找到下一个章节或文件末尾
      const nextSectionMatch = restContent.match(/\n## /);
      const insertPoint = nextSectionMatch ? insertPos + (nextSectionMatch.index ?? 0) : content.length;

      // 检查是否已存在该链接
      const sectionContent = content.substring(sectionIndex, insertPoint);
      if (sectionContent.includes(`[[${linkText}]]`)) {
        return; // 已存在，不重复添加
      }

      content = content.substring(0, insertPoint) + `- [[${linkText}]]\n` + content.substring(insertPoint);
    }

    await this.app.vault.modify(file, content);
    await this.updateSet(file);
  }

  /**
   * 从套装移除关联项
   */
  async removeItemFromSet(setFilePath: string, linkText: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(setFilePath);
    if (!(file instanceof TFile)) return;

    let content = await this.app.vault.read(file);

    // 移除包含该链接的行
    const lines = content.split('\n');
    const filtered = lines.filter(line => !line.includes(`[[${linkText}]]`));
    content = filtered.join('\n');

    await this.app.vault.modify(file, content);
    await this.updateSet(file);
  }
}
