/**
 * Game Manager 主视图
 * 侧边栏视图，包含4个标签页：主界面、Skills、Equipment、Dungeon
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
        this.renderTreeTab('skills', this.dataManager.getSkillsTree(), '技能', '概念型永久笔记');
        break;
      case 'equipment':
        this.renderTreeTab('equipment', this.dataManager.getEquipmentTree(), '装备', '方法型永久笔记');
        break;
      case 'dungeon':
        this.renderTreeTab('dungeon', this.dataManager.getDungeonTree(), '副本', '闪念笔记');
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
      const treeContainer = section.createDiv({ cls: 'gm-tree-container' });
      sets.forEach(set => {
        this.renderSetItem(treeContainer, set);
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
   * 渲染单个套装项
   */
  private renderSetItem(container: HTMLElement, set: GameSet): void {
    const node = container.createDiv({ cls: 'gm-tree-node' });
    const header = node.createDiv({ cls: 'gm-tree-header' });

    header.createSpan({ cls: 'gm-tree-toggle-placeholder', text: '📁' });
    header.createSpan({ cls: 'gm-tree-label', text: set.name });
    header.createSpan({ cls: 'gm-tree-badge', text: String(set.linkedItems.length) });

    header.addEventListener('click', () => {
      // 打开套装文件
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
   * 渲染树形标签页（技能/装备/副本）
   */
  private renderTreeTab(type: string, tree: TreeNode, title: string, desc: string): void {
    this.mainContentEl.createEl('h3', { text: `📂 ${title}` });
    this.mainContentEl.createEl('p', { text: desc, cls: 'gm-panel-desc' });

    if (tree.children.length === 0) {
      const empty = this.mainContentEl.createDiv({ cls: 'gm-empty' });
      empty.textContent = `暂无${title}数据，在笔记中使用 #${type}-分类-内容 添加`;
      return;
    }

    // 渲染树结构
    const treeContainer = this.mainContentEl.createDiv({ cls: 'gm-tree-container' });
    this.renderTreeNodes(treeContainer, tree.children);
  }

  /**
   * 渲染树节点列表
   */
  private renderTreeNodes(container: HTMLElement, nodes: TreeNode[]): void {
    nodes.forEach(node => {
      this.renderTreeNode(container, node);
    });
  }

  /**
   * 渲染单个树节点
   */
  private renderTreeNode(container: HTMLElement, node: TreeNode): void {
    const nodeEl = container.createDiv({ cls: 'gm-tree-node' });
    const header = nodeEl.createDiv({ cls: 'gm-tree-header' });

    const hasChildren = node.children.length > 0;
    const hasItems = node.items.length > 0;
    let isExpanded = false;

    // 展开/折叠按钮
    const toggle = header.createSpan({
      cls: hasChildren ? 'gm-tree-toggle' : 'gm-tree-toggle-placeholder',
      text: hasChildren ? '▶' : '•',
    });

    // 节点标签
    header.createSpan({ cls: 'gm-tree-label', text: node.name });

    // 徽章（项数）
    const totalItems = this.countAllItems(node);
    if (totalItems > 0) {
      header.createSpan({ cls: 'gm-tree-badge', text: String(totalItems) });
    }

    // 子节点数量
    if (hasChildren) {
      header.createSpan({ cls: 'gm-tree-child-count', text: `(${node.children.length} 个分类)` });
    }

    // 子节点容器
    let childrenContainer: HTMLElement | null = null;
    let sourcesContainer: HTMLElement | null = null;

    if (hasChildren || hasItems) {
      childrenContainer = nodeEl.createDiv({ cls: 'gm-tree-children' });
      childrenContainer.style.display = 'none';

      // 渲染来源（叶子节点的项）
      if (hasItems) {
        sourcesContainer = childrenContainer.createDiv({ cls: 'gm-tree-sources' });
        node.items.forEach(item => {
          const sourceItem = sourcesContainer!.createDiv({ cls: 'gm-source-item' });
          
          const link = sourceItem.createEl('a', {
            cls: 'gm-source-link',
            text: this.getFileName(item.sourceFile),
          });
          link.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.workspace.openLinkText(item.sourceFile, '', false);
          });

          sourceItem.createSpan({ cls: 'gm-source-line', text: `L${item.lineNumber}` });
        });
      }

      // 渲染子节点
      if (hasChildren) {
        this.renderTreeNodes(childrenContainer, node.children);
      }
    }

    // 点击展开/折叠
    header.addEventListener('click', () => {
      if (!childrenContainer) return;

      isExpanded = !isExpanded;
      childrenContainer.style.display = isExpanded ? 'block' : 'none';

      if (hasChildren) {
        toggle.textContent = isExpanded ? '▼' : '▶';
        toggle.toggleClass('is-expanded', isExpanded);
      }
    });
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
