/**
 * Game Manager 类型定义
 */

// 标签类型
export type TagType = 'skill' | 'equip' | 'dungeon' | 'set';

// 树节点
export interface TreeNode {
  name: string;           // 节点名称（分类名或内容）
  path: string[];         // 完整路径
  children: TreeNode[];   // 子节点
  items: TreeItem[];      // 叶子节点的具体内容项
  isLeaf: boolean;        // 是否为叶子节点（内容层）
}

// 树中的具体内容项
export interface TreeItem {
  content: string;        // 内容文本
  sourceFile: string;     // 来源文件路径
  lineNumber: number;     // 所在行号
  fullTag: string;        // 完整标签字符串
  textContent?: string;   // 标签关联的文本内容（文件开头=全文，文中=到空行）
  isFullFile?: boolean;   // 是否代表整个文件
}

// 解析后的标签
export interface ParsedTag {
  type: TagType;          // 标签类型：skill/equip/dungeon/set
  categories: string[];   // 分类路径（不含类型和内容）
  content: string;        // 最后一项：具体内容
  sourceFile: string;     // 来源文件
  lineNumber: number;     // 行号
  fullTag: string;        // 完整原始标签
  textContent?: string;   // 标签关联的文本内容
  isFullFile?: boolean;   // 是否代表整个文件（标签在文件开头）
}

// 套装定义
export interface GameSet {
  name: string;           // 套装名称
  filePath: string;       // 索引文件路径
  linkedItems: LinkedItem[]; // 关联的技能/装备
  description?: string;   // 描述
}

// 套装中的关联项
export interface LinkedItem {
  type: 'skill' | 'equip';
  linkText: string;       // [[链接文本]]
  targetFile?: string;    // 目标文件路径（如果存在）
}

// 插件缓存数据结构
export interface GameManagerData {
  version: string;
  lastUpdated: number;
  skills: TreeNode;
  equipment: TreeNode;
  dungeon: TreeNode;
  sets: GameSet[];
  // 文件索引：记录每个文件包含的标签，用于增量更新
  fileIndex: Record<string, ParsedTag[]>;
}

// 插件设置
export interface GameManagerSettings {
  setsFolder: string;     // 套装文件夹路径，默认 .game-manager/sets
  enableRealTimeUpdate: boolean; // 是否启用实时更新
}

// 默认设置
export const DEFAULT_SETTINGS: GameManagerSettings = {
  setsFolder: '.game-manager/sets',
  enableRealTimeUpdate: true,
};

// 默认数据
export const DEFAULT_DATA: GameManagerData = {
  version: '1.0.0',
  lastUpdated: Date.now(),
  skills: { name: 'root', path: [], children: [], items: [], isLeaf: false },
  equipment: { name: 'root', path: [], children: [], items: [], isLeaf: false },
  dungeon: { name: 'root', path: [], children: [], items: [], isLeaf: false },
  sets: [],
  fileIndex: {},
};

// 视图类型常量
export const VIEW_TYPE_GAME_MANAGER = 'game-manager-view';
