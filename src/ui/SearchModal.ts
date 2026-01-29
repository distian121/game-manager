/**
 * 搜索选择对话框 - 用于搜索和选择技能/装备/副本添加到套装
 */

import { App, Modal, Setting, TFile } from 'obsidian';
import { TreeNode, TreeItem } from '../types';

export type SearchItemType = 'skill' | 'equip' | 'dungeon';

export interface SearchItem {
  type: SearchItemType;
  name: string;
  path: string[];
  sourceFile?: string;
  content?: string;
}

export class SearchModal extends Modal {
  private selectedItems: SearchItem[] = [];
  private onSubmit: (items: SearchItem[]) => void;
  private searchResults: HTMLElement;
  private selectedContainer: HTMLElement;
  private searchInput: HTMLInputElement;
  private allItems: SearchItem[] = [];
  private allowedTypes: SearchItemType[];

  constructor(
    app: App,
    options: {
      skillsTree: TreeNode;
      equipmentTree: TreeNode;
      dungeonTree: TreeNode;
      allowedTypes?: SearchItemType[];
      existingItems?: SearchItem[];
    },
    onSubmit: (items: SearchItem[]) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.allowedTypes = options.allowedTypes || ['skill', 'equip', 'dungeon'];
    this.selectedItems = options.existingItems ? [...options.existingItems] : [];

    // 收集所有可选项目
    if (this.allowedTypes.includes('skill')) {
      this.collectItems(options.skillsTree, 'skill', []);
    }
    if (this.allowedTypes.includes('equip')) {
      this.collectItems(options.equipmentTree, 'equip', []);
    }
    if (this.allowedTypes.includes('dungeon')) {
      this.collectItems(options.dungeonTree, 'dungeon', []);
    }
  }

  /**
   * 递归收集树中的所有项目
   */
  private collectItems(node: TreeNode, type: SearchItemType, currentPath: string[]): void {
    // 添加叶子节点的内容项
    node.items.forEach((item) => {
      this.allItems.push({
        type,
        name: item.content,
        path: [...currentPath, item.content],
        sourceFile: item.sourceFile,
        content: item.textContent,
      });
    });

    // 递归处理子节点
    node.children.forEach((child) => {
      this.collectItems(child, type, [...currentPath, child.name]);
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('gm-search-modal');

    contentEl.createEl('h2', { text: '搜索并添加内容' });

    // 搜索输入
    const searchContainer = contentEl.createDiv({ cls: 'gm-search-container' });
    this.searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: '输入关键词搜索...',
      cls: 'gm-search-input',
    });
    this.searchInput.addEventListener('input', () => {
      this.updateSearchResults();
    });

    // 类型过滤器
    const filterContainer = contentEl.createDiv({ cls: 'gm-filter-container' });
    const typeLabels: Record<SearchItemType, string> = {
      skill: '⚔️ 技能',
      equip: '🛡️ 装备',
      dungeon: '🏰 副本',
    };
    
    this.allowedTypes.forEach((type) => {
      const chip = filterContainer.createEl('span', {
        cls: 'gm-filter-chip gm-filter-chip-active',
        text: typeLabels[type],
      });
      chip.dataset.type = type;
      chip.addEventListener('click', () => {
        chip.toggleClass('gm-filter-chip-active', !chip.hasClass('gm-filter-chip-active'));
        this.updateSearchResults();
      });
    });

    // 搜索结果区域
    this.searchResults = contentEl.createDiv({ cls: 'gm-search-results' });
    this.searchResults.createDiv({ cls: 'gm-search-hint', text: '输入关键词开始搜索' });

    // 已选择项目区域
    contentEl.createEl('h4', { text: '已选择' });
    this.selectedContainer = contentEl.createDiv({ cls: 'gm-selected-items' });
    this.updateSelectedDisplay();

    // 按钮区域
    const buttonContainer = contentEl.createDiv({ cls: 'gm-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: '取消',
      cls: 'gm-btn',
    });
    cancelBtn.addEventListener('click', () => {
      this.selectedItems = [];
      this.close();
    });

    const submitBtn = buttonContainer.createEl('button', {
      text: '确认添加',
      cls: 'gm-btn gm-btn-primary',
    });
    submitBtn.addEventListener('click', () => {
      this.close();
    });

    // 自动聚焦搜索框
    this.searchInput.focus();
  }

  /**
   * 更新搜索结果
   */
  private updateSearchResults(): void {
    const query = this.searchInput.value.toLowerCase().trim();
    this.searchResults.empty();

    if (!query) {
      this.searchResults.createDiv({ cls: 'gm-search-hint', text: '输入关键词开始搜索' });
      return;
    }

    // 获取激活的类型过滤器
    const activeTypes: SearchItemType[] = [];
    this.contentEl.querySelectorAll('.gm-filter-chip-active').forEach((chip) => {
      const type = (chip as HTMLElement).dataset.type as SearchItemType;
      if (type) activeTypes.push(type);
    });

    // 过滤并排序结果
    const filtered = this.allItems.filter((item) => {
      if (!activeTypes.includes(item.type)) return false;
      const searchText = [item.name, ...item.path, item.content || ''].join(' ').toLowerCase();
      return searchText.includes(query);
    });

    if (filtered.length === 0) {
      this.searchResults.createDiv({ cls: 'gm-search-hint', text: '没有找到匹配的结果' });
      return;
    }

    // 按类型分组显示
    const grouped: Record<SearchItemType, SearchItem[]> = {
      skill: [],
      equip: [],
      dungeon: [],
    };

    filtered.forEach((item) => {
      grouped[item.type].push(item);
    });

    const typeIcons: Record<SearchItemType, string> = {
      skill: '⚔️',
      equip: '🛡️',
      dungeon: '🏰',
    };

    const typeNames: Record<SearchItemType, string> = {
      skill: '技能',
      equip: '装备',
      dungeon: '副本',
    };

    // 渲染分组结果
    (['dungeon', 'skill', 'equip'] as SearchItemType[]).forEach((type) => {
      const items = grouped[type];
      if (items.length === 0) return;

      const group = this.searchResults.createDiv({ cls: 'gm-search-group' });
      group.createDiv({
        cls: 'gm-search-group-title',
        text: `${typeIcons[type]} ${typeNames[type]} (${items.length})`,
      });

      const list = group.createDiv({ cls: 'gm-search-list' });
      items.slice(0, 10).forEach((item) => {
        const isSelected = this.isItemSelected(item);
        const itemEl = list.createDiv({
          cls: `gm-search-item ${isSelected ? 'gm-search-item-selected' : ''}`,
        });

        itemEl.createSpan({ cls: 'gm-search-item-icon', text: typeIcons[item.type] });
        itemEl.createSpan({ cls: 'gm-search-item-name', text: item.name });
        if (item.path.length > 1) {
          itemEl.createSpan({
            cls: 'gm-search-item-path',
            text: item.path.slice(0, -1).join(' › '),
          });
        }

        itemEl.addEventListener('click', () => {
          this.toggleItem(item);
          itemEl.toggleClass('gm-search-item-selected', this.isItemSelected(item));
          this.updateSelectedDisplay();
        });
      });

      if (items.length > 10) {
        list.createDiv({
          cls: 'gm-search-more',
          text: `还有 ${items.length - 10} 个结果，请细化搜索条件`,
        });
      }
    });
  }

  /**
   * 检查项目是否已选择
   */
  private isItemSelected(item: SearchItem): boolean {
    return this.selectedItems.some(
      (s) => s.type === item.type && s.name === item.name && s.sourceFile === item.sourceFile
    );
  }

  /**
   * 切换项目选择状态
   */
  private toggleItem(item: SearchItem): void {
    const index = this.selectedItems.findIndex(
      (s) => s.type === item.type && s.name === item.name && s.sourceFile === item.sourceFile
    );

    if (index >= 0) {
      this.selectedItems.splice(index, 1);
    } else {
      this.selectedItems.push(item);
    }
  }

  /**
   * 更新已选择项目显示
   */
  private updateSelectedDisplay(): void {
    this.selectedContainer.empty();

    if (this.selectedItems.length === 0) {
      this.selectedContainer.createDiv({ cls: 'gm-selected-empty', text: '尚未选择任何内容' });
      return;
    }

    const typeIcons: Record<SearchItemType, string> = {
      skill: '⚔️',
      equip: '🛡️',
      dungeon: '🏰',
    };

    this.selectedItems.forEach((item) => {
      const chip = this.selectedContainer.createDiv({ cls: 'gm-selected-chip' });
      chip.createSpan({ text: `${typeIcons[item.type]} ${item.name}` });

      const removeBtn = chip.createSpan({ cls: 'gm-selected-remove', text: '×' });
      removeBtn.addEventListener('click', () => {
        this.toggleItem(item);
        this.updateSelectedDisplay();
        this.updateSearchResults();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.onSubmit(this.selectedItems);
  }
}

/**
 * 便捷函数：显示搜索对话框并返回 Promise
 */
export function showSearchModal(
  app: App,
  options: {
    skillsTree: TreeNode;
    equipmentTree: TreeNode;
    dungeonTree: TreeNode;
    allowedTypes?: SearchItemType[];
    existingItems?: SearchItem[];
  }
): Promise<SearchItem[]> {
  return new Promise((resolve) => {
    const modal = new SearchModal(app, options, (items) => {
      resolve(items);
    });
    modal.open();
  });
}
