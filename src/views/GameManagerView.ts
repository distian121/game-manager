/**
 * Game Manager 主视图
 * 侧边栏视图，包含4个标签页：主界面、Skills、Equipment、Dungeon
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_GAME_MANAGER, TreeNode, GameSet } from '../types';
import { DataManager } from '../services/DataManager';
import type GameManagerPlugin from '../main';

type TabType = 'home' | 'skills' | 'equipment' | 'dungeon';

// 当前浏览路径状态
interface BrowseState {
  type: 'skills' | 'equipment' | 'dungeon';
  path: string[];  // 当前路径，如 ['编程', 'python']
}

export class GameManagerView extends ItemView {
  private plugin: GameManagerPlugin;
  private dataManager: DataManager;
  private activeTab: TabType = 'home';
  private mainContentEl: HTMLElement;
  
  // 卡片浏览状态
  private browseState: BrowseState | null = null;

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
        // 切换标签页时重置浏览状态
        this.browseState = null;
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
        this.renderSetCard(cardsContainer, set);
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
   * 渲染单个套装卡片
   */
  private renderSetCard(container: HTMLElement, set: GameSet): void {
    const card = container.createDiv({ cls: 'gm-card' });

    card.createDiv({ cls: 'gm-card-icon', text: '👑' });
    card.createDiv({ cls: 'gm-card-title', text: set.name });
    card.createDiv({ cls: 'gm-card-count', text: `${set.linkedItems.length} 个关联` });

    if (set.linkedItems.length > 0) {
      card.createDiv({ cls: 'gm-card-badge', text: String(set.linkedItems.length) });
    }

    card.addEventListener('click', () => {
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
   * 渲染卡片式标签页（技能/装备/副本）
   */
  private renderCardTab(type: 'skills' | 'equipment' | 'dungeon', tree: TreeNode, title: string, desc: string, icon: string): void {
    // 初始化浏览状态
    if (!this.browseState || this.browseState.type !== type) {
      this.browseState = { type, path: [] };
    }

    // 获取当前路径对应的节点
    const currentNode = this.getNodeAtPath(tree, this.browseState.path);

    // 标题
    this.mainContentEl.createEl('h3', { text: `${icon} ${title}` });
    this.mainContentEl.createEl('p', { text: desc, cls: 'gm-panel-desc' });

    // 面包屑导航
    if (this.browseState.path.length > 0) {
      this.renderBreadcrumb(type, title, icon);
    }

    // 判断当前节点状态
    if (!currentNode || (currentNode.children.length === 0 && currentNode.items.length === 0)) {
      // 空状态
      const empty = this.mainContentEl.createDiv({ cls: 'gm-empty' });
      if (this.browseState.path.length === 0) {
        empty.textContent = `暂无${title}数据，在笔记中使用 #${type === 'skills' ? 'skill' : type === 'equipment' ? 'equip' : 'dungeon'}-分类-内容 添加`;
      } else {
        empty.textContent = '此分类下暂无内容';
      }
      return;
    }

    // 如果有子目录，显示卡片
    if (currentNode.children.length > 0) {
      this.renderCards(currentNode.children, type);
    }

    // 如果有内容项，显示内容列表
    if (currentNode.items.length > 0) {
      this.renderContentItems(currentNode);
    }
  }

  /**
   * 渲染面包屑导航
   */
  private renderBreadcrumb(type: 'skills' | 'equipment' | 'dungeon', title: string, icon: string): void {
    const breadcrumb = this.mainContentEl.createDiv({ cls: 'gm-breadcrumb' });

    // 返回按钮
    const backBtn = breadcrumb.createEl('button', { cls: 'gm-back-btn' });
    backBtn.createSpan({ text: '← 返回' });
    backBtn.addEventListener('click', () => {
      if (this.browseState && this.browseState.path.length > 0) {
        this.browseState.path.pop();
        this.renderTab();
      }
    });

    // 根节点
    const rootItem = breadcrumb.createSpan({ cls: 'gm-breadcrumb-item', text: `${icon} ${title}` });
    rootItem.addEventListener('click', () => {
      if (this.browseState) {
        this.browseState.path = [];
        this.renderTab();
      }
    });

    // 路径节点
    if (this.browseState) {
      this.browseState.path.forEach((segment, index) => {
        breadcrumb.createSpan({ cls: 'gm-breadcrumb-sep', text: '›' });

        if (index === this.browseState!.path.length - 1) {
          // 当前节点
          breadcrumb.createSpan({ cls: 'gm-breadcrumb-current', text: segment });
        } else {
          // 可点击的父节点
          const item = breadcrumb.createSpan({ cls: 'gm-breadcrumb-item', text: segment });
          item.addEventListener('click', () => {
            if (this.browseState) {
              this.browseState.path = this.browseState.path.slice(0, index + 1);
              this.renderTab();
            }
          });
        }
      });
    }
  }

  /**
   * 渲染卡片列表
   */
  private renderCards(nodes: TreeNode[], type: 'skills' | 'equipment' | 'dungeon'): void {
    const cardsContainer = this.mainContentEl.createDiv({ cls: 'gm-cards-container' });

    // 根据类型选择图标
    const getIcon = (hasChildren: boolean): string => {
      if (hasChildren) {
        return '📁';
      }
      switch (type) {
        case 'skills': return '⚔️';
        case 'equipment': return '🛡️';
        case 'dungeon': return '🏰';
      }
    };

    nodes.forEach(node => {
      const card = cardsContainer.createDiv({ cls: 'gm-card' });

      const hasChildren = node.children.length > 0;
      const totalItems = this.countAllItems(node);

      // 图标
      card.createDiv({ cls: 'gm-card-icon', text: getIcon(hasChildren) });

      // 标题
      card.createDiv({ cls: 'gm-card-title', text: node.name });

      // 计数
      if (hasChildren) {
        card.createDiv({ cls: 'gm-card-count', text: `${node.children.length} 个分类` });
      } else if (node.items.length > 0) {
        card.createDiv({ cls: 'gm-card-count', text: `${node.items.length} 条内容` });
      }

      // 徽章
      if (totalItems > 0) {
        card.createDiv({ cls: 'gm-card-badge', text: String(totalItems) });
      }

      // 点击进入下一级
      card.addEventListener('click', () => {
        if (this.browseState) {
          this.browseState.path.push(node.name);
          this.renderTab();
        }
      });
    });
  }

  /**
   * 渲染内容项列表
   */
  private renderContentItems(node: TreeNode): void {
    if (node.items.length === 0) return;

    const section = this.mainContentEl.createDiv({ cls: 'gm-section' });
    section.createEl('h4', { text: `📝 内容 (${node.items.length})` });

    const contentList = section.createDiv({ cls: 'gm-content-list' });

    node.items.forEach(item => {
      const contentItem = contentList.createDiv({ cls: 'gm-content-item' });

      // 内容文本
      contentItem.createSpan({ cls: 'gm-content-text', text: item.content });

      // 来源信息
      const sourceEl = contentItem.createDiv({ cls: 'gm-content-source' });

      const link = sourceEl.createEl('a', {
        cls: 'gm-content-link',
        text: this.getFileName(item.sourceFile),
      });
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(item.sourceFile, '', false);
      });

      sourceEl.createSpan({ cls: 'gm-content-line', text: `L${item.lineNumber}` });
    });
  }

  /**
   * 根据路径获取节点
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
