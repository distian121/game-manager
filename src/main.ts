/**
 * Game Manager 插件入口
 * 用游戏术语实现知识卡片管理的卡片盒笔记法 Obsidian 插件
 */

import { Plugin, WorkspaceLeaf, TFile, TAbstractFile } from 'obsidian';
import {
  VIEW_TYPE_GAME_MANAGER,
  GameManagerData,
  GameManagerSettings,
  DEFAULT_SETTINGS,
  DEFAULT_DATA,
} from './types';
import { DataManager } from './services/DataManager';
import { GameManagerView } from './views/GameManagerView';
import { ExtractCommands } from './commands/ExtractCommands';

export default class GameManagerPlugin extends Plugin {
  settings: GameManagerSettings;
  dataManager: DataManager;
  private view: GameManagerView | null = null;
  private extractCommands: ExtractCommands;

  async onload(): Promise<void> {
    console.log('Loading Game Manager plugin');

    // 加载设置
    await this.loadSettings();

    // 初始化数据管理器
    this.dataManager = new DataManager(this.app, this.settings);

    // 加载缓存数据
    const savedData = await this.loadData();
    this.dataManager.loadData(savedData as GameManagerData | null);

    // 注册视图
    this.registerView(VIEW_TYPE_GAME_MANAGER, (leaf) => {
      this.view = new GameManagerView(leaf, this, this.dataManager);
      return this.view;
    });

    // 添加侧边栏图标
    this.addRibbonIcon('gamepad-2', 'Game Manager', () => {
      this.activateView();
    });

    // 添加命令
    this.addCommand({
      id: 'open-game-manager',
      name: '打开 Game Manager',
      callback: () => {
        this.activateView();
      },
    });

    this.addCommand({
      id: 'rescan-vault',
      name: '重新扫描 Vault',
      callback: async () => {
        await this.rescan();
      },
    });

    // 初始化摘录命令
    this.extractCommands = new ExtractCommands(this);

    // 摘录到子副本 (Alt+X)
    this.addCommand({
      id: 'extract-to-sub-dungeon',
      name: '摘录到子副本 (Extract)',
      editorCallback: (editor, view) => {
        this.extractCommands.extractToSubDungeon(editor, view);
      },
    });

    // 提炼为技能 (Alt+S)
    this.addCommand({
      id: 'extract-to-skill',
      name: '提炼为技能 (Skill)',
      editorCallback: (editor, view) => {
        this.extractCommands.extractToSkill(editor, view);
      },
    });

    // 提炼为装备 (Alt+E)
    this.addCommand({
      id: 'extract-to-equipment',
      name: '提炼为装备 (Equip)',
      editorCallback: (editor, view) => {
        this.extractCommands.extractToEquipment(editor, view);
      },
    });

    // 监听文件变更（实时更新）
    if (this.settings.enableRealTimeUpdate) {
      this.registerEvent(
        this.app.vault.on('modify', (file) => {
          if (file instanceof TFile && file.extension === 'md') {
            this.onFileModify(file);
          }
        })
      );

      this.registerEvent(
        this.app.vault.on('delete', (file) => {
          if (file instanceof TFile && file.extension === 'md') {
            this.onFileDelete(file);
          }
        })
      );

      this.registerEvent(
        this.app.vault.on('rename', (file, oldPath) => {
          if (file instanceof TFile && file.extension === 'md') {
            this.onFileRename(file, oldPath);
          }
        })
      );
    }

    // 应用启动后进行初始扫描
    this.app.workspace.onLayoutReady(async () => {
      // 如果没有缓存数据或数据过旧，进行全量扫描
      const data = this.dataManager.getData();
      if (!data.lastUpdated || Date.now() - data.lastUpdated > 24 * 60 * 60 * 1000) {
        await this.rescan();
      }
    });
  }

  async onunload(): Promise<void> {
    console.log('Unloading Game Manager plugin');
    // 保存数据
    await this.savePluginData();
  }

  /**
   * 激活视图（在主编辑区打开）
   */
  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_GAME_MANAGER);

    if (leaves.length > 0) {
      // 视图已存在，激活它
      leaf = leaves[0];
    } else {
      // 在主编辑区创建新标签页
      leaf = workspace.getLeaf('tab');
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_GAME_MANAGER,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * 重新扫描 Vault
   */
  async rescan(): Promise<void> {
    await this.dataManager.fullScan();
    await this.savePluginData();
    this.refreshView();
  }

  /**
   * 文件修改时的处理
   */
  private async onFileModify(file: TFile): Promise<void> {
    await this.dataManager.updateFile(file);
    await this.savePluginData();
    this.refreshView();
  }

  /**
   * 文件删除时的处理
   */
  private onFileDelete(file: TFile): void {
    this.dataManager.removeFile(file.path);
    this.savePluginData();
    this.refreshView();
  }

  /**
   * 文件重命名时的处理
   */
  private async onFileRename(file: TFile, oldPath: string): Promise<void> {
    this.dataManager.removeFile(oldPath);
    await this.dataManager.updateFile(file);
    await this.savePluginData();
    this.refreshView();
  }

  /**
   * 刷新视图
   */
  private refreshView(): void {
    if (this.view) {
      this.view.refresh();
    }
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 保存设置
   */
  async saveSettings(): Promise<void> {
    await this.saveData({ ...this.settings, ...this.dataManager.getData() });
  }

  /**
   * 保存插件数据
   */
  async savePluginData(): Promise<void> {
    await this.saveData(this.dataManager.getData());
  }
}
