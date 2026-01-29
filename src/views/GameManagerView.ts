/**
 * Game Manager 主视图
 * 主编辑区视图，包含4个标签页：主界面、Skills、Equipment、Dungeon
 */

import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component } from 'obsidian';
import { VIEW_TYPE_GAME_MANAGER, TreeNode, GameSet, TreeItem } from '../types';
import { DataManager } from '../services/DataManager';
import { showInputModal } from '../ui/InputModal';
import type GameManagerPlugin from '../main';

type TabType = 'home' | 'skills' | 'equipment' | 'dungeon' | 'sets';

// 浏览状态：记录当前路径
interface BrowseState {
  type: 'skills' | 'equipment' | 'dungeon';
  path: string[];
}

export class GameManagerView extends ItemView {
  private plugin: GameManagerPlugin;
  private dataManager: DataManager;
  private activeTab: TabType = 'home';
  private mainContentEl: HTMLElement;
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
      { id: 'sets', label: '👑 套装', icon: 'crown' },
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
      case 'sets':
        this.renderSetsTab();
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

    // 知识关系网络
    this.renderKnowledgeNetwork();

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

    // 统计数量
    const totalDungeons = set.linkedDungeons?.length || 0;
    const totalSkills = set.linkedSkills?.length || 0;
    const totalEquipment = set.linkedEquipment?.length || 0;
    const totalItems = totalDungeons + totalSkills + totalEquipment;

    // 徽章
    if (totalItems > 0) {
      folder.createDiv({ cls: 'gm-folder-badge', text: String(totalItems) });
    }

    // 预览网格（优先显示副本来源）
    const preview = folder.createDiv({ cls: 'gm-folder-preview' });
    let previewSlots = 0;
    const maxSlots = 4;

    // 先显示副本
    if (set.linkedDungeons) {
      for (const item of set.linkedDungeons.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: 'gm-mini-card' });
        miniCard.createDiv({ cls: 'gm-mini-card-icon', text: '🏰' });
        miniCard.createDiv({ cls: 'gm-mini-card-name', text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }

    // 再显示技能
    if (previewSlots < maxSlots && set.linkedSkills) {
      for (const item of set.linkedSkills.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: 'gm-mini-card' });
        miniCard.createDiv({ cls: 'gm-mini-card-icon', text: '⚔️' });
        miniCard.createDiv({ cls: 'gm-mini-card-name', text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }

    // 最后显示装备
    if (previewSlots < maxSlots && set.linkedEquipment) {
      for (const item of set.linkedEquipment.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: 'gm-mini-card' });
        miniCard.createDiv({ cls: 'gm-mini-card-icon', text: '🛡️' });
        miniCard.createDiv({ cls: 'gm-mini-card-name', text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }

    // 如果有更多
    const remaining = totalItems - previewSlots;
    if (remaining > 0 && previewSlots < maxSlots) {
      const moreCard = preview.createDiv({ cls: 'gm-mini-card gm-mini-card-more' });
      moreCard.createDiv({ cls: 'gm-mini-card-name', text: `+${remaining}` });
      previewSlots++;
    }

    // 填充空位
    for (let i = previewSlots; i < maxSlots; i++) {
      const emptyCard = preview.createDiv({ cls: 'gm-mini-card' });
      emptyCard.style.visibility = 'hidden';
    }

    // 标题
    folder.createDiv({ cls: 'gm-folder-title', text: set.name });

    // 描述或统计
    if (set.description) {
      const desc = folder.createDiv({ cls: 'gm-folder-desc' });
      desc.textContent = set.description.length > 30 ? set.description.substring(0, 30) + '...' : set.description;
    } else {
      const stats = folder.createDiv({ cls: 'gm-folder-stats' });
      if (totalDungeons > 0) stats.createSpan({ text: `🏰${totalDungeons}` });
      if (totalSkills > 0) stats.createSpan({ text: `⚔️${totalSkills}` });
      if (totalEquipment > 0) stats.createSpan({ text: `🛡️${totalEquipment}` });
    }

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
    const result = await showInputModal(this.app, {
      title: '创建新套装',
      namePlaceholder: '输入套装名称',
      showDescription: true,
    });

    if (result && result.name) {
      const file = await this.dataManager.createSet(result.name, result.description);
      this.app.workspace.openLinkText(file.path, '', false);
      this.renderTab();
    }
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

    // 快捷键指南
    const shortcuts = help.createDiv({ cls: 'gm-shortcuts' });
    shortcuts.createEl('h5', { text: '⌨️ 快捷键' });
    const shortcutList = [
      { key: 'Alt+X', desc: '摘录选中文本到子副本' },
      { key: 'Alt+S', desc: '提炼选中内容为技能' },
      { key: 'Alt+E', desc: '提炼选中内容为装备' },
    ];
    shortcutList.forEach(s => {
      const item = shortcuts.createDiv({ cls: 'gm-shortcut-item' });
      item.createSpan({ cls: 'gm-shortcut-key', text: s.key });
      item.createSpan({ cls: 'gm-shortcut-desc', text: s.desc });
    });
  }

  /**
   * 渲染套装标签页
   */
  private renderSetsTab(): void {
    // 标题
    this.mainContentEl.createEl('h3', { text: '👑 套装' });
    this.mainContentEl.createEl('p', { text: '项目索引 - 组合技能、装备和副本', cls: 'gm-panel-desc' });

    const sets = this.dataManager.getSets();

    if (sets.length === 0) {
      const empty = this.mainContentEl.createDiv({ cls: 'gm-empty' });
      empty.createSpan({ text: '暂无套装，' });
      const createLink = empty.createEl('a', { text: '创建第一个套装' });
      createLink.addEventListener('click', () => this.createNewSet());
    } else {
      // 套装卡片网格
      const cardsContainer = this.mainContentEl.createDiv({ cls: 'gm-cards-container gm-sets-grid' });
      sets.forEach(set => {
        this.renderSetFolderCard(cardsContainer, set);
      });
    }

    // 新建按钮
    const actionsContainer = this.mainContentEl.createDiv({ cls: 'gm-actions' });
    const addBtn = actionsContainer.createEl('button', {
      cls: 'gm-btn gm-btn-primary',
      text: '+ 新建套装',
    });
    addBtn.addEventListener('click', () => this.createNewSet());
  }

  /**
   * 渲染知识关系网络（简单列表形式）
   */
  private renderKnowledgeNetwork(): void {
    const section = this.mainContentEl.createDiv({ cls: 'gm-section gm-network-section' });
    section.createEl('h4', { text: '🔗 知识关系网络' });

    // 收集关系
    const relations: { from: string; fromType: string; to: string; toType: string; relation: string }[] = [];

    // 从 frontmatter 中解析来源关系（需要 DataManager 支持）
    // 目前先显示套装中的关联关系
    const sets = this.dataManager.getSets();

    sets.forEach(set => {
      // 套装 → 副本
      set.linkedDungeons?.forEach(d => {
        relations.push({
          from: set.name,
          fromType: 'set',
          to: d.linkText,
          toType: 'dungeon',
          relation: '来源于',
        });
      });

      // 套装 → 技能
      set.linkedSkills?.forEach(s => {
        relations.push({
          from: set.name,
          fromType: 'set',
          to: s.linkText,
          toType: 'skill',
          relation: '包含',
        });
      });

      // 套装 → 装备
      set.linkedEquipment?.forEach(e => {
        relations.push({
          from: set.name,
          fromType: 'set',
          to: e.linkText,
          toType: 'equip',
          relation: '包含',
        });
      });
    });

    if (relations.length === 0) {
      section.createDiv({ cls: 'gm-empty', text: '暂无关联关系，创建套装后将在此显示' });
      return;
    }

    // 渲染关系列表
    const list = section.createDiv({ cls: 'gm-relation-list' });

    const typeIcons: Record<string, string> = {
      set: '👑',
      skill: '⚔️',
      equip: '🛡️',
      dungeon: '🏰',
    };

    // 只显示前 10 条
    const displayRelations = relations.slice(0, 10);
    displayRelations.forEach(rel => {
      const item = list.createDiv({ cls: 'gm-relation-item' });
      item.innerHTML = `
        <span class="gm-rel-from">${typeIcons[rel.fromType]} ${rel.from}</span>
        <span class="gm-rel-arrow">→</span>
        <span class="gm-rel-label">${rel.relation}</span>
        <span class="gm-rel-arrow">→</span>
        <span class="gm-rel-to">${typeIcons[rel.toType]} ${rel.to}</span>
      `;
    });

    if (relations.length > 10) {
      list.createDiv({ cls: 'gm-relation-more', text: `还有 ${relations.length - 10} 条关系...` });
    }
  }

  /**
   * 渲染卡片式标签页（技能/装备/副本）- 三层嵌套卡片系统
   */
  private renderCardTab(type: 'skills' | 'equipment' | 'dungeon', tree: TreeNode, title: string, desc: string, icon: string): void {
    // 初始化或恢复浏览状态
    if (!this.browseState || this.browseState.type !== type) {
      this.browseState = { type, path: [] };
    }

    // 获取当前路径对应的节点
    const currentNode = this.getNodeAtPath(tree, this.browseState.path);

    // 标题
    this.mainContentEl.createEl('h3', { text: `${icon} ${title}` });
    this.mainContentEl.createEl('p', { text: desc, cls: 'gm-panel-desc' });

    // 面包屑导航（如果有路径）
    if (this.browseState.path.length > 0) {
      this.renderBreadcrumb(type, title, icon);
    }

    // 判断当前节点状态
    if (!currentNode || (currentNode.children.length === 0 && currentNode.items.length === 0)) {
      const empty = this.mainContentEl.createDiv({ cls: 'gm-empty' });
      if (this.browseState.path.length === 0) {
        empty.textContent = `暂无${title}数据，在笔记中使用 #${type === 'skills' ? 'skill' : type === 'equipment' ? 'equip' : 'dungeon'}-分类-内容 添加`;
      } else {
        empty.textContent = '此分类下暂无内容';
      }
      return;
    }

    // 渲染三层嵌套卡片
    this.renderThreeLevelCards(currentNode, type);
  }

  /**
   * 渲染面包屑导航
   */
  private renderBreadcrumb(type: 'skills' | 'equipment' | 'dungeon', title: string, icon: string): void {
    const breadcrumb = this.mainContentEl.createDiv({ cls: 'gm-breadcrumb' });

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
          // 当前节点（不可点击）
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
   * 渲染三层嵌套卡片结构
   */
  private renderThreeLevelCards(node: TreeNode, type: 'skills' | 'equipment' | 'dungeon'): void {
    const grid = this.mainContentEl.createDiv({ cls: 'gm-cards-lg-grid' });

    // 渲染子目录作为大卡片
    node.children.forEach(child => {
      this.renderLargeCard(grid, child, type);
    });

    // 渲染根级内容项作为内容卡片
    node.items.forEach(item => {
      this.renderContentCard(grid, item, 'lg');
    });
  }

  /**
   * 渲染大卡片（第一层）
   */
  private renderLargeCard(container: HTMLElement, node: TreeNode, type: 'skills' | 'equipment' | 'dungeon'): void {
    const card = container.createDiv({ cls: 'gm-card gm-card-lg' });
    const totalItems = this.countAllItems(node);

    // 头部
    const header = card.createDiv({ cls: 'gm-card-header' });
    header.createDiv({ cls: 'gm-card-title', text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: 'gm-card-badge', text: String(totalItems) });
    }

    // 内容区
    const body = card.createDiv({ cls: 'gm-card-body' });

    if (node.children.length === 0 && node.items.length > 0) {
      // 叶子节点：显示内容
      this.renderCardBodyContent(body, node.items, 4);
    } else if (node.children.length > 0) {
      // 有子目录：显示中卡片网格
      const mdGrid = body.createDiv({ cls: 'gm-cards-md-grid' });
      const maxMd = 4;
      const showChildren = node.children.slice(0, maxMd);
      const remainingChildren = node.children.length - maxMd;

      showChildren.forEach(child => {
        this.renderMediumCard(mdGrid, child, type);
      });

      // 显示此级别的内容项（如果有）
      const remainingSlots = maxMd - showChildren.length;
      const showItems = node.items.slice(0, remainingSlots);
      showItems.forEach(item => {
        this.renderContentCard(mdGrid, item, 'md');
      });

      // "+N 更多" 指示器
      const totalRemaining = remainingChildren + Math.max(0, node.items.length - remainingSlots);
      if (totalRemaining > 0) {
        const more = mdGrid.createDiv({ cls: 'gm-more-card' });
        more.createSpan({ text: `+${totalRemaining} 更多` });
        more.addEventListener('click', (e) => {
          e.stopPropagation();
          this.navigateToNode(node.name);
        });
      }
    }

    // 点击卡片进入内部
    card.addEventListener('click', () => {
      this.navigateToNode(node.name);
    });
  }

  /**
   * 渲染中卡片（第二层）
   */
  private renderMediumCard(container: HTMLElement, node: TreeNode, type: 'skills' | 'equipment' | 'dungeon'): void {
    const card = container.createDiv({ cls: 'gm-card gm-card-md' });
    const totalItems = this.countAllItems(node);

    // 头部
    const header = card.createDiv({ cls: 'gm-card-header' });
    header.createDiv({ cls: 'gm-card-title', text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: 'gm-card-badge', text: String(totalItems) });
    }

    // 内容区
    const body = card.createDiv({ cls: 'gm-card-body' });

    if (node.children.length === 0 && node.items.length > 0) {
      // 叶子节点：显示内容预览
      this.renderCardBodyContent(body, node.items, 2);
    } else if (node.children.length > 0) {
      // 有子目录：显示小卡片网格
      const smGrid = body.createDiv({ cls: 'gm-cards-sm-grid' });
      const maxSm = 4;
      const showChildren = node.children.slice(0, maxSm);
      const remainingChildren = node.children.length - maxSm;

      showChildren.forEach(child => {
        this.renderSmallCard(smGrid, child);
      });

      // "+N 更多" 指示器
      const totalRemaining = remainingChildren + node.items.length;
      if (totalRemaining > 0) {
        const more = smGrid.createDiv({ cls: 'gm-more-card' });
        more.createSpan({ text: `+${totalRemaining}` });
      }
    }

    // 阻止事件冒泡，避免触发大卡片的点击
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToNode(node.name);
    });
  }

  /**
   * 渲染小卡片（第三层）
   */
  private renderSmallCard(container: HTMLElement, node: TreeNode): void {
    const card = container.createDiv({ cls: 'gm-card gm-card-sm' });
    const totalItems = this.countAllItems(node);

    // 头部
    const header = card.createDiv({ cls: 'gm-card-header' });
    header.createDiv({ cls: 'gm-card-title', text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: 'gm-card-badge', text: String(totalItems) });
    }

    // 内容区
    const body = card.createDiv({ cls: 'gm-card-body' });

    // 显示预览：子项名称或内容预览
    const previewText = this.getNodePreviewText(node);
    if (previewText) {
      body.createDiv({ cls: 'gm-card-preview', text: previewText });
    }

    // 阻止事件冒泡
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.navigateToNode(node.name);
    });
  }

  /**
   * 渲染内容卡片（叶子节点，显示具体文本）
   */
  private renderContentCard(container: HTMLElement, item: TreeItem, size: 'lg' | 'md' | 'sm'): void {
    const card = container.createDiv({ cls: `gm-card gm-card-${size} gm-card-content` });

    // 头部
    const header = card.createDiv({ cls: 'gm-card-header' });
    header.createDiv({ cls: 'gm-card-title', text: item.content });

    // 内容区
    const body = card.createDiv({ cls: 'gm-card-body' });

    if (item.textContent) {
      const contentEl = body.createDiv({ cls: 'gm-content-text gm-markdown-content' });
      // 使用 Markdown 渲染器渲染内容
      this.renderMarkdown(item.textContent, contentEl, item.sourceFile);
    }

    // 来源
    const source = body.createDiv({ cls: 'gm-content-source' });
    const link = source.createEl('a', { text: this.getFileName(item.sourceFile) });
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.workspace.openLinkText(item.sourceFile, '', false);
    });

    // 点击打开文件
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.workspace.openLinkText(item.sourceFile, '', false);
    });
  }

  /**
   * 在卡片 body 中渲染内容项列表
   */
  private renderCardBodyContent(body: HTMLElement, items: TreeItem[], maxItems: number): void {
    const showItems = items.slice(0, maxItems);
    const remaining = items.length - maxItems;

    showItems.forEach(item => {
      const itemEl = body.createDiv({ cls: 'gm-content-text gm-markdown-content' });
      itemEl.style.marginBottom = '6px';
      itemEl.style.cursor = 'pointer';
      
      // 使用 Markdown 渲染器渲染内容
      const content = item.textContent || item.content;
      this.renderMarkdown(content, itemEl, item.sourceFile);
      
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(item.sourceFile, '', false);
      });
    });

    if (remaining > 0) {
      const more = body.createDiv({ cls: 'gm-content-source' });
      more.textContent = `+${remaining} 更多内容`;
    }
  }

  /**
   * 使用 Obsidian 的 MarkdownRenderer 渲染 Markdown 内容
   */
  private renderMarkdown(content: string, container: HTMLElement, sourcePath: string): void {
    // 创建一个组件用于管理渲染生命周期
    const component = new Component();
    component.load();
    
    // 渲染 Markdown
    MarkdownRenderer.render(
      this.app,
      content,
      container,
      sourcePath,
      component
    );
    
    // 注册清理
    this.register(() => component.unload());
  }

  /**
   * 获取节点预览文本
   */
  private getNodePreviewText(node: TreeNode): string {
    const parts: string[] = [];

    // 子目录名
    node.children.slice(0, 2).forEach(child => {
      parts.push(child.name);
    });

    // 内容项
    node.items.slice(0, 2).forEach(item => {
      parts.push(item.content);
    });

    const remaining = node.children.length + node.items.length - parts.length;
    if (remaining > 0) {
      parts.push(`+${remaining}`);
    }

    return parts.join(', ');
  }

  /**
   * 导航到指定节点
   */
  private navigateToNode(nodeName: string): void {
    if (this.browseState) {
      this.browseState.path.push(nodeName);
      this.renderTab();
    }
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
