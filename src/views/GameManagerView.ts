/**
 * Game Manager 主视图
 * 主编辑区视图，包含4个标签页：主界面、Skills、Equipment、Dungeon
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_GAME_MANAGER, TreeNode, GameSet } from '../types';
import { DataManager } from '../services/DataManager';
import type GameManagerPlugin from '../main';

type TabType = 'home' | 'skills' | 'equipment' | 'dungeon';

export class GameManagerView extends ItemView {
  private plugin: GameManagerPlugin;
  private dataManager: DataManager;
  private activeTab: TabType = 'home';
  private mainContentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: GameManagerPlugin, dataManager: DataManager) {
    super(leaf);
    this.plugin = plugin;
    this.dataManager = dataManager;
  }

  getViewType(): string {
    return VIEW_TYPE_GAME_MANAGER;
  }

  getDisplayText(): string {
    return 'Game Manager';
  }

  getIcon(): string {
    return 'gamepad-2';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('game-manager-view');

    // 创建标签页导航
    this.createTabs(container);

    // 创建内容容器
    this.mainContentEl = container.createDiv({ cls: 'gm-content' });

    // 渲染默认标签页
    this.renderTab();
  }

  async onClose(): Promise<void> {
    // 清理
  }

  /**
   * 刷新视图
   */
  refresh(): void {
    this.renderTab();
  }

  /**
   * 创建标签页导航
   */
  private createTabs(container: HTMLElement): void {
    const tabsContainer = container.createDiv({ cls: 'gm-main-tabs' });

    const tabs: { id: TabType; label: string; icon: string }[] = [
      { id: 'home', label: '🏠 主页', icon: 'home' },
      { id: 'skills', label: '⚔️ 技能', icon: 'zap' },
      { id: 'equipment', label: '🛡️ 装备', icon: 'shield' },
      { id: 'dungeon', label: '🏰 副本', icon: 'castle' },
    ];

    tabs.forEach(tab => {
      const btn = tabsContainer.createEl('button', {
        cls: 'gm-tab-btn',
        text: tab.label,
      });

      if (tab.id === this.activeTab) {
        btn.addClass('is-active');
      }

      btn.addEventListener('click', () => {
        // 更新激活状态
        tabsContainer.querySelectorAll('.gm-tab-btn').forEach(b => b.removeClass('is-active'));
        btn.addClass('is-active');
        this.activeTab = tab.id;
        this.renderTab();
      });
    });
  }

  /**
   * 渲染当前标签页内容
   */
  private renderTab(): void {
    this.mainContentEl.empty();

    switch (this.activeTab) {
      case 'home':
        this.renderHomeTab();
        break;
      case 'skills':
        this.renderCardTab('skills', this.dataManager.getSkillsTree(), '技能', '概念型永久笔记', '⚔️');
        break;
      case 'equipment':
        this.renderCardTab('equipment', this.dataManager.getEquipmentTree(), '装备', '方法型永久笔记', '🛡️');
        break;
      case 'dungeon':
        this.renderCardTab('dungeon', this.dataManager.getDungeonTree(), '副本', '闪念笔记', '🏰');
        break;
    }
  }

  /**
   * 渲染主页标签页
   */
  private renderHomeTab(): void {
    // 标题
    this.mainContentEl.createEl('h3', { text: '📊 知识仪表盘' });
    this.mainContentEl.createEl('p', { text: '你的知识管理概览', cls: 'gm-panel-desc' });

    // 统计卡片
    const stats = this.dataManager.getStats();
    const statsContainer = this.mainContentEl.createDiv({ cls: 'gm-stats' });

    const statCards = [
      { label: '技能', value: stats.skills, icon: '⚔️', desc: '概念知识', tab: 'skills' as TabType },
      { label: '装备', value: stats.equipment, icon: '🛡️', desc: '方法技巧', tab: 'equipment' as TabType },
      { label: '副本', value: stats.dungeon, icon: '🏰', desc: '待整理', tab: 'dungeon' as TabType, warning: stats.dungeon > 10 },
      { label: '套装', value: stats.sets, icon: '👑', desc: '项目索引', tab: 'home' as TabType },
    ];

    statCards.forEach(stat => {
      const card = statsContainer.createDiv({ cls: 'gm-stat-card' });
      if (stat.warning) {
        card.addClass('gm-stat-card-warning');
      }

      card.createDiv({ cls: 'gm-stat-icon', text: stat.icon });
      card.createDiv({ cls: 'gm-stat-number', text: String(stat.value) });
      card.createDiv({ cls: 'gm-stat-label', text: stat.label });
      card.createDiv({ cls: 'gm-stat-desc', text: stat.desc });

      card.addEventListener('click', () => {
        if (stat.tab !== 'home') {
          this.activeTab = stat.tab;
          // 更新标签按钮状态
          const tabs = this.containerEl.querySelectorAll('.gm-tab-btn');
          tabs.forEach((btn, i) => {
            btn.removeClass('is-active');
            if ((i === 1 && stat.tab === 'skills') ||
                (i === 2 && stat.tab === 'equipment') ||
                (i === 3 && stat.tab === 'dungeon')) {
              btn.addClass('is-active');
            }
          });
          this.renderTab();
        }
      });
    });

    // 套装区域
    this.renderSetsSection();

    // 操作按钮
    const actionsContainer = this.mainContentEl.createDiv({ cls: 'gm-actions' });
    const scanBtn = actionsContainer.createEl('button', {
      cls: 'gm-btn gm-btn-primary',
      text: '🔄 重新扫描',
    });
    scanBtn.addEventListener('click', async () => {
      scanBtn.textContent = '⏳ 扫描中...';
      scanBtn.setAttribute('disabled', 'true');
      await this.plugin.rescan();
      scanBtn.textContent = '🔄 重新扫描';
      scanBtn.removeAttribute('disabled');
      this.renderTab();
    });

    // 帮助区域
    this.renderHelpSection();
  }

  /**
   * 渲染套装区域
   */
  private renderSetsSection(): void {
    const section = this.mainContentEl.createDiv({ cls: 'gm-section' });
    section.createEl('h4', { text: '👑 套装（项目索引）' });

    const sets = this.dataManager.getSets();

    if (sets.length === 0) {
      const empty = section.createDiv({ cls: 'gm-empty' });
      empty.createSpan({ text: '暂无套装，' });
      const createLink = empty.createEl('a', { text: '创建第一个套装' });
      createLink.addEventListener('click', () => this.createNewSet());
    } else {
      const cardsContainer = section.createDiv({ cls: 'gm-cards-container' });
      sets.forEach(set => {
        this.renderSetFolderCard(cardsContainer, set);
      });

      // 添加新建按钮
      const addBtn = section.createEl('button', {
        cls: 'gm-btn',
        text: '+ 新建套装',
      });
      addBtn.style.marginTop = '12px';
      addBtn.addEventListener('click', () => this.createNewSet());
    }
  }

  /**
   * 渲染单个套装卡片（文件夹预览风格）
   */
  private renderSetFolderCard(container: HTMLElement, set: GameSet): void {
    const folder = container.createDiv({ cls: 'gm-folder-card' });

    // 徽章
    if (set.linkedItems.length > 0) {
      folder.createDiv({ cls: 'gm-folder-badge', text: String(set.linkedItems.length) });
    }

    // 预览网格（显示关联项）
    const preview = folder.createDiv({ cls: 'gm-folder-preview' });
    const previewCount = Math.min(set.linkedItems.length, 3);

    for (let i = 0; i < previewCount; i++) {
      const item = set.linkedItems[i];
      const miniCard = preview.createDiv({ cls: 'gm-mini-card' });
      miniCard.createDiv({ cls: 'gm-mini-card-icon', text: item.type === 'skill' ? '⚔️' : '🛡️' });
      miniCard.createDiv({ cls: 'gm-mini-card-name', text: item.linkText.substring(0, 6) });
    }

    // 如果有更多
    if (set.linkedItems.length > 3) {
      const moreCard = preview.createDiv({ cls: 'gm-mini-card gm-mini-card-more' });
      moreCard.createDiv({ cls: 'gm-mini-card-name', text: `+${set.linkedItems.length - 3}` });
    }

    // 填充空位
    const filledSlots = previewCount + (set.linkedItems.length > 3 ? 1 : 0);
    for (let i = filledSlots; i < 4; i++) {
      const emptyCard = preview.createDiv({ cls: 'gm-mini-card' });
      emptyCard.style.visibility = 'hidden';
    }

    // 标题
    folder.createDiv({ cls: 'gm-folder-title', text: set.name });

    // 点击打开文件
    folder.addEventListener('click', () => {
      const file = this.app.vault.getAbstractFileByPath(set.filePath);
      if (file) {
        this.app.workspace.openLinkText(set.filePath, '', false);
      }
    });
  }

  /**
   * 创建新套装
   */
  private async createNewSet(): Promise<void> {
    const name = await this.promptForName('输入套装名称');
    if (name) {
      const file = await this.dataManager.createSet(name);
      this.app.workspace.openLinkText(file.path, '', false);
      this.renderTab();
    }
  }

  /**
   * 简单的输入提示
   */
  private promptForName(message: string): Promise<string | null> {
    return new Promise(resolve => {
      const name = prompt(message);
      resolve(name);
    });
  }

  /**
   * 渲染帮助区域
   */
  private renderHelpSection(): void {
    const help = this.mainContentEl.createDiv({ cls: 'gm-help' });
    help.createEl('h4', { text: '📖 使用指南' });

    const examples = help.createDiv({ cls: 'gm-examples' });

    const exampleData = [
      { tag: '#skill-编程-python-装饰器', desc: '技能 → 编程 → python → 装饰器' },
      { tag: '#equip-写作-卡片笔记法', desc: '装备 → 写作 → 卡片笔记法' },
      { tag: '#dungeon-今日灵感', desc: '副本 → 今日灵感' },
    ];

    exampleData.forEach(ex => {
      const example = examples.createDiv({ cls: 'gm-example' });
      example.createSpan({ cls: 'gm-tag', text: ex.tag });
      example.createSpan({ cls: 'gm-desc', text: ex.desc });
    });

    help.createEl('p', {
      cls: 'gm-tip',
      text: '💡 标签格式：#类型-分类1-分类2-...-内容，最后一项为具体内容，前面为层级目录',
    });
  }

  /**
   * 渲染卡片式标签页（技能/装备/副本）- 真正的嵌套透明容器
   */
  private renderCardTab(type: 'skills' | 'equipment' | 'dungeon', tree: TreeNode, title: string, desc: string, icon: string): void {
    // 标题
    this.mainContentEl.createEl('h3', { text: `${icon} ${title}` });
    this.mainContentEl.createEl('p', { text: desc, cls: 'gm-panel-desc' });

    // 判断当前节点状态
    if (tree.children.length === 0 && tree.items.length === 0) {
      // 空状态
      const empty = this.mainContentEl.createDiv({ cls: 'gm-empty' });
      empty.textContent = `暂无${title}数据，在笔记中使用 #${type === 'skills' ? 'skill' : type === 'equipment' ? 'equip' : 'dungeon'}-分类-内容 添加`;
      return;
    }

    // 渲染嵌套容器结构
    const nestedList = this.mainContentEl.createDiv({ cls: 'gm-nested-list' });
    this.renderNestedContainers(nestedList, tree.children, tree.items, type);
  }

  /**
   * 递归渲染嵌套透明容器
   */
  private renderNestedContainers(parent: HTMLElement, children: TreeNode[], items: import('../types').TreeItem[], type: 'skills' | 'equipment' | 'dungeon'): void {
    const typeIcon = type === 'skills' ? '⚔️' : type === 'equipment' ? '🛡️' : '🏰';

    // 渲染所有子目录作为嵌套容器
    children.forEach(node => {
      const totalItems = this.countAllItems(node);
      const isLeaf = node.children.length === 0; // 没有子目录就是叶子

      // 创建外层透明容器
      const container = parent.createDiv({ cls: 'gm-nested-container' });

      // 容器标题栏（带分隔线）
      const header = container.createDiv({ cls: 'gm-container-header' });
      header.createDiv({ cls: 'gm-container-icon', text: isLeaf ? '📄' : '📁' });
      header.createDiv({ cls: 'gm-container-title', text: node.name });
      if (totalItems > 0) {
        header.createDiv({ cls: 'gm-container-badge', text: String(totalItems) });
      }
      const toggle = header.createDiv({ cls: 'gm-container-toggle', text: '▶' });

      // 容器内容区
      const content = container.createDiv({ cls: 'gm-container-content' });

      if (isLeaf) {
        // 叶子节点：显示具体内容项
        this.renderLeafItems(content, node.items, typeIcon);
      } else {
        // 非叶子：显示子容器网格
        const grid = content.createDiv({ cls: 'gm-nested-grid' });
        this.renderNestedChildren(grid, node.children, node.items, type, typeIcon);
      }

      // 点击标题栏展开/折叠
      header.addEventListener('click', () => {
        const isExpanded = content.hasClass('is-visible');
        if (isExpanded) {
          content.removeClass('is-visible');
          toggle.removeClass('is-expanded');
        } else {
          content.addClass('is-visible');
          toggle.addClass('is-expanded');
        }
      });
    });

    // 渲染根级别的内容项（如果有）
    if (items.length > 0) {
      const itemsContainer = parent.createDiv({ cls: 'gm-nested-container' });
      const header = itemsContainer.createDiv({ cls: 'gm-container-header' });
      header.createDiv({ cls: 'gm-container-icon', text: '📝' });
      header.createDiv({ cls: 'gm-container-title', text: '未分类内容' });
      header.createDiv({ cls: 'gm-container-badge', text: String(items.length) });
      const toggle = header.createDiv({ cls: 'gm-container-toggle', text: '▶' });

      const content = itemsContainer.createDiv({ cls: 'gm-container-content' });
      this.renderLeafItems(content, items, typeIcon);

      header.addEventListener('click', () => {
        const isExpanded = content.hasClass('is-visible');
        if (isExpanded) {
          content.removeClass('is-visible');
          toggle.removeClass('is-expanded');
        } else {
          content.addClass('is-visible');
          toggle.addClass('is-expanded');
        }
      });
    }
  }

  /**
   * 渲染嵌套子容器（第二层及更深层）
   */
  private renderNestedChildren(grid: HTMLElement, children: TreeNode[], items: import('../types').TreeItem[], type: 'skills' | 'equipment' | 'dungeon', typeIcon: string): void {
    // 渲染子目录作为嵌套子容器
    children.forEach(node => {
      const isLeaf = node.children.length === 0;
      const totalItems = this.countAllItems(node);

      // 子透明容器
      const child = grid.createDiv({ cls: 'gm-nested-child' });

      // 子容器标题栏
      const header = child.createDiv({ cls: 'gm-nested-child-header' });
      header.createDiv({ cls: 'gm-nested-child-icon', text: isLeaf ? '📄' : '📁' });
      header.createDiv({ cls: 'gm-nested-child-title', text: node.name });
      if (totalItems > 0) {
        header.createDiv({ cls: 'gm-nested-child-badge', text: String(totalItems) });
      }

      // 预览区：显示更深层的小方块
      const preview = child.createDiv({ cls: 'gm-nested-child-preview' });
      this.renderPreviewDots(preview, node);

      // 点击展开为独立的对话框或就地展开
      child.addEventListener('click', () => {
        // 在页面下方展开详情
        this.expandNodeDetails(node, type, typeIcon);
      });
    });

    // 渲染此级别的内容项
    items.forEach(item => {
      const leaf = grid.createDiv({ cls: 'gm-leaf-item' });

      const header = leaf.createDiv({ cls: 'gm-leaf-header' });
      header.createDiv({ cls: 'gm-leaf-icon', text: item.isFullFile ? '📄' : '📝' });
      header.createDiv({ cls: 'gm-leaf-title', text: item.content });
      header.createDiv({ cls: 'gm-leaf-source', text: this.getFileName(item.sourceFile) });

      if (item.textContent) {
        const contentEl = leaf.createDiv({ cls: 'gm-leaf-content' });
        contentEl.textContent = item.textContent.substring(0, 150) + (item.textContent.length > 150 ? '...' : '');
      }

      leaf.addEventListener('click', () => {
        this.app.workspace.openLinkText(item.sourceFile, '', false);
      });
    });
  }

  /**
   * 渲染预览小方块
   */
  private renderPreviewDots(preview: HTMLElement, node: TreeNode): void {
    const allItems: Array<{ name: string; isFolder: boolean }> = [];

    // 收集子目录
    node.children.forEach(child => {
      allItems.push({ name: child.name, isFolder: child.children.length > 0 });
    });

    // 收集内容项
    node.items.forEach(item => {
      allItems.push({ name: item.content, isFolder: false });
    });

    // 显示最多5个，第6个显示 +N
    const maxShow = 5;
    const showItems = allItems.slice(0, maxShow);
    const remaining = allItems.length - maxShow;

    showItems.forEach(item => {
      const dot = preview.createDiv({ cls: 'gm-preview-dot' });
      dot.textContent = item.name.substring(0, 4);
    });

    if (remaining > 0) {
      const moreDot = preview.createDiv({ cls: 'gm-preview-dot gm-preview-dot-more' });
      moreDot.textContent = `+${remaining}`;
    }
  }

  /**
   * 展开节点详情（在当前视图下方显示）
   */
  private expandNodeDetails(node: TreeNode, type: 'skills' | 'equipment' | 'dungeon', typeIcon: string): void {
    // 移除已有的展开详情
    const existing = this.mainContentEl.querySelector('.gm-expanded-details');
    if (existing) {
      existing.remove();
    }

    // 创建展开详情区域
    const details = this.mainContentEl.createDiv({ cls: 'gm-expanded-details gm-nested-container' });
    details.style.marginTop = '24px';

    // 标题
    const header = details.createDiv({ cls: 'gm-container-header' });
    header.createDiv({ cls: 'gm-container-icon', text: '📂' });
    header.createDiv({ cls: 'gm-container-title', text: `展开: ${node.name}` });
    const closeBtn = header.createDiv({ cls: 'gm-container-toggle', text: '✕' });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      details.remove();
    });

    // 内容区
    const content = details.createDiv({ cls: 'gm-container-content is-visible' });

    if (node.children.length === 0) {
      // 只有内容项
      this.renderLeafItems(content, node.items, typeIcon);
    } else {
      // 有子目录，继续渲染嵌套
      const grid = content.createDiv({ cls: 'gm-nested-grid' });
      this.renderNestedChildren(grid, node.children, node.items, type, typeIcon);
    }
  }

  /**
   * 渲染叶子节点内容项
   */
  private renderLeafItems(container: HTMLElement, items: import('../types').TreeItem[], typeIcon: string): void {
    if (items.length === 0) {
      container.createDiv({ cls: 'gm-empty', text: '暂无内容' });
      return;
    }

    const grid = container.createDiv({ cls: 'gm-nested-grid' });

    items.forEach(item => {
      const leaf = grid.createDiv({ cls: 'gm-leaf-item' });

      const header = leaf.createDiv({ cls: 'gm-leaf-header' });
      header.createDiv({ cls: 'gm-leaf-icon', text: item.isFullFile ? '📄' : typeIcon });
      header.createDiv({ cls: 'gm-leaf-title', text: item.content });
      header.createDiv({ cls: 'gm-leaf-source', text: this.getFileName(item.sourceFile) });

      if (item.textContent) {
        const contentEl = leaf.createDiv({ cls: 'gm-leaf-content' });
        contentEl.textContent = item.textContent;
      }

      leaf.addEventListener('click', () => {
        this.app.workspace.openLinkText(item.sourceFile, '', false);
      });
    });
  }

  /**
   * 根据路径获取节点（保留用于未来可能的功能）
   */
  private getNodeAtPath(tree: TreeNode, path: string[]): TreeNode | null {
    let current = tree;

    for (const segment of path) {
      const child = current.children.find(c => c.name === segment);
      if (!child) {
        return null;
      }
      current = child;
    }

    return current;
  }

  /**
   * 统计节点下所有项数
   */
  private countAllItems(node: TreeNode): number {
    let count = node.items.length;
    for (const child of node.children) {
      count += this.countAllItems(child);
    }
    return count;
  }

  /**
   * 从路径获取文件名
   */
  private getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1].replace('.md', '');
  }
}
