var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GameManagerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  setsFolder: ".game-manager/sets",
  enableRealTimeUpdate: true
};
var DEFAULT_DATA = {
  version: "1.0.0",
  lastUpdated: Date.now(),
  skills: { name: "root", path: [], children: [], items: [], isLeaf: false },
  equipment: { name: "root", path: [], children: [], items: [], isLeaf: false },
  dungeon: { name: "root", path: [], children: [], items: [], isLeaf: false },
  sets: [],
  fileIndex: {}
};
var VIEW_TYPE_GAME_MANAGER = "game-manager-view";

// src/services/TagParser.ts
var TAG_PREFIXES = {
  "skill": "skill",
  "equip": "equip",
  "dungeon": "dungeon",
  "set": "set"
};
var TAG_REGEX = /#(skill|equip|dungeon|set)(-[a-zA-Z0-9\u4e00-\u9fa5_]+)+/g;
function isAtFileStart(lines, lineIndex) {
  let nonEmptyCount = 0;
  for (let i = 0; i <= lineIndex && i < lines.length; i++) {
    if (lines[i].trim() !== "") {
      nonEmptyCount++;
    }
  }
  return nonEmptyCount <= 3;
}
function getAssociatedContent(lines, tagLineIndex, isFullFile) {
  if (isFullFile) {
    const contentLines = lines.slice(tagLineIndex + 1).filter((line) => {
      return !line.trim().match(/^#(skill|equip|dungeon|set)-/);
    });
    return contentLines.join("\n").trim().substring(0, 500);
  } else {
    const contentLines = [];
    for (let i = tagLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        break;
      }
      if (line.match(/#(skill|equip|dungeon|set)-/)) {
        break;
      }
      contentLines.push(line);
    }
    return contentLines.join("\n").trim().substring(0, 300);
  }
}
function parseTagsFromContent(content, sourceFile) {
  const tags = [];
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let match;
    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(line)) !== null) {
      const fullTag = match[0];
      const isFullFile = isAtFileStart(lines, index);
      const textContent = getAssociatedContent(lines, index, isFullFile);
      const parsed = parseTag(fullTag, sourceFile, lineNumber, textContent, isFullFile);
      if (parsed) {
        tags.push(parsed);
      }
    }
  });
  return tags;
}
function parseTag(tag, sourceFile, lineNumber, textContent, isFullFile) {
  const withoutHash = tag.startsWith("#") ? tag.slice(1) : tag;
  const parts = withoutHash.split("-");
  if (parts.length < 2) {
    return null;
  }
  const typeStr = parts[0].toLowerCase();
  const type = TAG_PREFIXES[typeStr];
  if (!type) {
    return null;
  }
  const content = parts[parts.length - 1];
  const categories = parts.slice(1, -1);
  return {
    type,
    categories,
    content,
    sourceFile,
    lineNumber,
    fullTag: tag,
    textContent,
    isFullFile
  };
}
function buildPathFromTag(tag) {
  return [...tag.categories, tag.content];
}

// src/services/DataManager.ts
var DataManager = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.data = { ...DEFAULT_DATA };
  }
  /**
   * 加载缓存数据
   */
  loadData(savedData) {
    if (savedData && savedData.version) {
      this.data = savedData;
    } else {
      this.data = { ...DEFAULT_DATA };
    }
  }
  /**
   * 获取当前数据（用于保存）
   */
  getData() {
    return this.data;
  }
  /**
   * 全量扫描 Vault 并构建数据
   */
  async fullScan() {
    this.data = { ...DEFAULT_DATA };
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (this.isInHiddenFolder(file.path) && !this.isSetFile(file.path)) {
        continue;
      }
      await this.processFile(file);
    }
    await this.scanSets();
    this.data.lastUpdated = Date.now();
  }
  /**
   * 增量更新单个文件
   */
  async updateFile(file) {
    this.removeFileFromIndex(file.path);
    await this.processFile(file);
    if (this.isSetFile(file.path)) {
      await this.updateSet(file);
    }
    this.data.lastUpdated = Date.now();
  }
  /**
   * 文件删除时移除数据
   */
  removeFile(filePath) {
    this.removeFileFromIndex(filePath);
    if (this.isSetFile(filePath)) {
      this.data.sets = this.data.sets.filter((s) => s.filePath !== filePath);
    }
    this.data.lastUpdated = Date.now();
  }
  /**
   * 处理单个文件
   */
  async processFile(file) {
    try {
      const content = await this.app.vault.read(file);
      const tags = parseTagsFromContent(content, file.path);
      this.data.fileIndex[file.path] = tags;
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
  addTagToTree(tag) {
    let tree;
    switch (tag.type) {
      case "skill":
        tree = this.data.skills;
        break;
      case "equip":
        tree = this.data.equipment;
        break;
      case "dungeon":
        tree = this.data.dungeon;
        break;
      default:
        return;
    }
    const path = buildPathFromTag(tag);
    this.insertIntoTree(tree, path, tag);
  }
  /**
   * 将内容插入树结构
   */
  insertIntoTree(tree, path, tag) {
    let current = tree;
    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      const isLast = i === path.length - 1;
      let child = current.children.find((c) => c.name === segment);
      if (!child) {
        child = {
          name: segment,
          path: path.slice(0, i + 1),
          children: [],
          items: [],
          isLeaf: isLast
        };
        current.children.push(child);
        current.children.sort((a, b) => a.name.localeCompare(b.name));
      }
      if (isLast) {
        child.isLeaf = true;
        child.items.push({
          content: tag.content,
          sourceFile: tag.sourceFile,
          lineNumber: tag.lineNumber,
          fullTag: tag.fullTag,
          textContent: tag.textContent,
          isFullFile: tag.isFullFile
        });
      }
      current = child;
    }
  }
  /**
   * 从索引中移除文件数据
   */
  removeFileFromIndex(filePath) {
    const tags = this.data.fileIndex[filePath];
    if (!tags)
      return;
    for (const tag of tags) {
      this.removeTagFromTree(tag);
    }
    delete this.data.fileIndex[filePath];
  }
  /**
   * 从树中移除标签
   */
  removeTagFromTree(tag) {
    let tree;
    switch (tag.type) {
      case "skill":
        tree = this.data.skills;
        break;
      case "equip":
        tree = this.data.equipment;
        break;
      case "dungeon":
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
  removeFromTree(tree, path, sourceFile, lineNumber) {
    if (path.length === 0)
      return;
    const segment = path[0];
    const childIndex = tree.children.findIndex((c) => c.name === segment);
    if (childIndex === -1)
      return;
    const child = tree.children[childIndex];
    if (path.length === 1) {
      child.items = child.items.filter(
        (item) => !(item.sourceFile === sourceFile && item.lineNumber === lineNumber)
      );
      if (child.items.length === 0 && child.children.length === 0) {
        tree.children.splice(childIndex, 1);
      }
    } else {
      this.removeFromTree(child, path.slice(1), sourceFile, lineNumber);
      if (child.items.length === 0 && child.children.length === 0) {
        tree.children.splice(childIndex, 1);
      }
    }
  }
  /**
   * 扫描套装文件夹
   */
  async scanSets() {
    this.data.sets = [];
    const setsFolder = this.settings.setsFolder;
    const folder = this.app.vault.getAbstractFileByPath(setsFolder);
    if (!folder) {
      await this.ensureSetsFolder();
      return;
    }
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(setsFolder));
    for (const file of files) {
      await this.updateSet(file);
    }
  }
  /**
   * 更新单个套装
   */
  async updateSet(file) {
    try {
      const content = await this.app.vault.read(file);
      const name = file.basename;
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      const linkedItems = [];
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        const linkText = match[1];
        const item = {
          type: "skill",
          // 默认，可根据链接目标文件中的标签判断
          linkText
        };
        linkedItems.push(item);
      }
      const existingIndex = this.data.sets.findIndex((s) => s.filePath === file.path);
      const set = {
        name,
        filePath: file.path,
        linkedItems
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
  async ensureSetsFolder() {
    const setsFolder = this.settings.setsFolder;
    const exists = this.app.vault.getAbstractFileByPath(setsFolder);
    if (!exists) {
      await this.app.vault.createFolder(setsFolder);
    }
  }
  /**
   * 判断路径是否在隐藏文件夹中
   */
  isInHiddenFolder(path) {
    return path.startsWith(".");
  }
  /**
   * 判断是否为套装文件
   */
  isSetFile(path) {
    return path.startsWith(this.settings.setsFolder);
  }
  /**
   * 获取技能树
   */
  getSkillsTree() {
    return this.data.skills;
  }
  /**
   * 获取装备树
   */
  getEquipmentTree() {
    return this.data.equipment;
  }
  /**
   * 获取副本树
   */
  getDungeonTree() {
    return this.data.dungeon;
  }
  /**
   * 获取所有套装
   */
  getSets() {
    return this.data.sets;
  }
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      skills: this.countItems(this.data.skills),
      equipment: this.countItems(this.data.equipment),
      dungeon: this.countItems(this.data.dungeon),
      sets: this.data.sets.length
    };
  }
  /**
   * 统计树中的项数
   */
  countItems(tree) {
    let count = tree.items.length;
    for (const child of tree.children) {
      count += this.countItems(child);
    }
    return count;
  }
  /**
   * 创建新套装
   */
  async createSet(name) {
    await this.ensureSetsFolder();
    const path = `${this.settings.setsFolder}/${name}.md`;
    const content = `# ${name}

## \u5173\u8054\u6280\u80FD

## \u5173\u8054\u88C5\u5907
`;
    const file = await this.app.vault.create(path, content);
    await this.updateSet(file);
    return file;
  }
};

// src/views/GameManagerView.ts
var import_obsidian = require("obsidian");
var GameManagerView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin, dataManager) {
    super(leaf);
    this.activeTab = "home";
    this.plugin = plugin;
    this.dataManager = dataManager;
  }
  getViewType() {
    return VIEW_TYPE_GAME_MANAGER;
  }
  getDisplayText() {
    return "Game Manager";
  }
  getIcon() {
    return "gamepad-2";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("game-manager-view");
    this.createTabs(container);
    this.mainContentEl = container.createDiv({ cls: "gm-content" });
    this.renderTab();
  }
  async onClose() {
  }
  /**
   * 刷新视图
   */
  refresh() {
    this.renderTab();
  }
  /**
   * 创建标签页导航
   */
  createTabs(container) {
    const tabsContainer = container.createDiv({ cls: "gm-main-tabs" });
    const tabs = [
      { id: "home", label: "\u{1F3E0} \u4E3B\u9875", icon: "home" },
      { id: "skills", label: "\u2694\uFE0F \u6280\u80FD", icon: "zap" },
      { id: "equipment", label: "\u{1F6E1}\uFE0F \u88C5\u5907", icon: "shield" },
      { id: "dungeon", label: "\u{1F3F0} \u526F\u672C", icon: "castle" }
    ];
    tabs.forEach((tab) => {
      const btn = tabsContainer.createEl("button", {
        cls: "gm-tab-btn",
        text: tab.label
      });
      if (tab.id === this.activeTab) {
        btn.addClass("is-active");
      }
      btn.addEventListener("click", () => {
        tabsContainer.querySelectorAll(".gm-tab-btn").forEach((b) => b.removeClass("is-active"));
        btn.addClass("is-active");
        this.activeTab = tab.id;
        this.renderTab();
      });
    });
  }
  /**
   * 渲染当前标签页内容
   */
  renderTab() {
    this.mainContentEl.empty();
    switch (this.activeTab) {
      case "home":
        this.renderHomeTab();
        break;
      case "skills":
        this.renderCardTab("skills", this.dataManager.getSkillsTree(), "\u6280\u80FD", "\u6982\u5FF5\u578B\u6C38\u4E45\u7B14\u8BB0", "\u2694\uFE0F");
        break;
      case "equipment":
        this.renderCardTab("equipment", this.dataManager.getEquipmentTree(), "\u88C5\u5907", "\u65B9\u6CD5\u578B\u6C38\u4E45\u7B14\u8BB0", "\u{1F6E1}\uFE0F");
        break;
      case "dungeon":
        this.renderCardTab("dungeon", this.dataManager.getDungeonTree(), "\u526F\u672C", "\u95EA\u5FF5\u7B14\u8BB0", "\u{1F3F0}");
        break;
    }
  }
  /**
   * 渲染主页标签页
   */
  renderHomeTab() {
    this.mainContentEl.createEl("h3", { text: "\u{1F4CA} \u77E5\u8BC6\u4EEA\u8868\u76D8" });
    this.mainContentEl.createEl("p", { text: "\u4F60\u7684\u77E5\u8BC6\u7BA1\u7406\u6982\u89C8", cls: "gm-panel-desc" });
    const stats = this.dataManager.getStats();
    const statsContainer = this.mainContentEl.createDiv({ cls: "gm-stats" });
    const statCards = [
      { label: "\u6280\u80FD", value: stats.skills, icon: "\u2694\uFE0F", desc: "\u6982\u5FF5\u77E5\u8BC6", tab: "skills" },
      { label: "\u88C5\u5907", value: stats.equipment, icon: "\u{1F6E1}\uFE0F", desc: "\u65B9\u6CD5\u6280\u5DE7", tab: "equipment" },
      { label: "\u526F\u672C", value: stats.dungeon, icon: "\u{1F3F0}", desc: "\u5F85\u6574\u7406", tab: "dungeon", warning: stats.dungeon > 10 },
      { label: "\u5957\u88C5", value: stats.sets, icon: "\u{1F451}", desc: "\u9879\u76EE\u7D22\u5F15", tab: "home" }
    ];
    statCards.forEach((stat) => {
      const card = statsContainer.createDiv({ cls: "gm-stat-card" });
      if (stat.warning) {
        card.addClass("gm-stat-card-warning");
      }
      card.createDiv({ cls: "gm-stat-icon", text: stat.icon });
      card.createDiv({ cls: "gm-stat-number", text: String(stat.value) });
      card.createDiv({ cls: "gm-stat-label", text: stat.label });
      card.createDiv({ cls: "gm-stat-desc", text: stat.desc });
      card.addEventListener("click", () => {
        if (stat.tab !== "home") {
          this.activeTab = stat.tab;
          const tabs = this.containerEl.querySelectorAll(".gm-tab-btn");
          tabs.forEach((btn, i) => {
            btn.removeClass("is-active");
            if (i === 1 && stat.tab === "skills" || i === 2 && stat.tab === "equipment" || i === 3 && stat.tab === "dungeon") {
              btn.addClass("is-active");
            }
          });
          this.renderTab();
        }
      });
    });
    this.renderSetsSection();
    const actionsContainer = this.mainContentEl.createDiv({ cls: "gm-actions" });
    const scanBtn = actionsContainer.createEl("button", {
      cls: "gm-btn gm-btn-primary",
      text: "\u{1F504} \u91CD\u65B0\u626B\u63CF"
    });
    scanBtn.addEventListener("click", async () => {
      scanBtn.textContent = "\u23F3 \u626B\u63CF\u4E2D...";
      scanBtn.setAttribute("disabled", "true");
      await this.plugin.rescan();
      scanBtn.textContent = "\u{1F504} \u91CD\u65B0\u626B\u63CF";
      scanBtn.removeAttribute("disabled");
      this.renderTab();
    });
    this.renderHelpSection();
  }
  /**
   * 渲染套装区域
   */
  renderSetsSection() {
    const section = this.mainContentEl.createDiv({ cls: "gm-section" });
    section.createEl("h4", { text: "\u{1F451} \u5957\u88C5\uFF08\u9879\u76EE\u7D22\u5F15\uFF09" });
    const sets = this.dataManager.getSets();
    if (sets.length === 0) {
      const empty = section.createDiv({ cls: "gm-empty" });
      empty.createSpan({ text: "\u6682\u65E0\u5957\u88C5\uFF0C" });
      const createLink = empty.createEl("a", { text: "\u521B\u5EFA\u7B2C\u4E00\u4E2A\u5957\u88C5" });
      createLink.addEventListener("click", () => this.createNewSet());
    } else {
      const cardsContainer = section.createDiv({ cls: "gm-cards-container" });
      sets.forEach((set) => {
        this.renderSetFolderCard(cardsContainer, set);
      });
      const addBtn = section.createEl("button", {
        cls: "gm-btn",
        text: "+ \u65B0\u5EFA\u5957\u88C5"
      });
      addBtn.style.marginTop = "12px";
      addBtn.addEventListener("click", () => this.createNewSet());
    }
  }
  /**
   * 渲染单个套装卡片（文件夹预览风格）
   */
  renderSetFolderCard(container, set) {
    const folder = container.createDiv({ cls: "gm-folder-card" });
    if (set.linkedItems.length > 0) {
      folder.createDiv({ cls: "gm-folder-badge", text: String(set.linkedItems.length) });
    }
    const preview = folder.createDiv({ cls: "gm-folder-preview" });
    const previewCount = Math.min(set.linkedItems.length, 3);
    for (let i = 0; i < previewCount; i++) {
      const item = set.linkedItems[i];
      const miniCard = preview.createDiv({ cls: "gm-mini-card" });
      miniCard.createDiv({ cls: "gm-mini-card-icon", text: item.type === "skill" ? "\u2694\uFE0F" : "\u{1F6E1}\uFE0F" });
      miniCard.createDiv({ cls: "gm-mini-card-name", text: item.linkText.substring(0, 6) });
    }
    if (set.linkedItems.length > 3) {
      const moreCard = preview.createDiv({ cls: "gm-mini-card gm-mini-card-more" });
      moreCard.createDiv({ cls: "gm-mini-card-name", text: `+${set.linkedItems.length - 3}` });
    }
    const filledSlots = previewCount + (set.linkedItems.length > 3 ? 1 : 0);
    for (let i = filledSlots; i < 4; i++) {
      const emptyCard = preview.createDiv({ cls: "gm-mini-card" });
      emptyCard.style.visibility = "hidden";
    }
    folder.createDiv({ cls: "gm-folder-title", text: set.name });
    folder.addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(set.filePath);
      if (file) {
        this.app.workspace.openLinkText(set.filePath, "", false);
      }
    });
  }
  /**
   * 创建新套装
   */
  async createNewSet() {
    const name = await this.promptForName("\u8F93\u5165\u5957\u88C5\u540D\u79F0");
    if (name) {
      const file = await this.dataManager.createSet(name);
      this.app.workspace.openLinkText(file.path, "", false);
      this.renderTab();
    }
  }
  /**
   * 简单的输入提示
   */
  promptForName(message) {
    return new Promise((resolve) => {
      const name = prompt(message);
      resolve(name);
    });
  }
  /**
   * 渲染帮助区域
   */
  renderHelpSection() {
    const help = this.mainContentEl.createDiv({ cls: "gm-help" });
    help.createEl("h4", { text: "\u{1F4D6} \u4F7F\u7528\u6307\u5357" });
    const examples = help.createDiv({ cls: "gm-examples" });
    const exampleData = [
      { tag: "#skill-\u7F16\u7A0B-python-\u88C5\u9970\u5668", desc: "\u6280\u80FD \u2192 \u7F16\u7A0B \u2192 python \u2192 \u88C5\u9970\u5668" },
      { tag: "#equip-\u5199\u4F5C-\u5361\u7247\u7B14\u8BB0\u6CD5", desc: "\u88C5\u5907 \u2192 \u5199\u4F5C \u2192 \u5361\u7247\u7B14\u8BB0\u6CD5" },
      { tag: "#dungeon-\u4ECA\u65E5\u7075\u611F", desc: "\u526F\u672C \u2192 \u4ECA\u65E5\u7075\u611F" }
    ];
    exampleData.forEach((ex) => {
      const example = examples.createDiv({ cls: "gm-example" });
      example.createSpan({ cls: "gm-tag", text: ex.tag });
      example.createSpan({ cls: "gm-desc", text: ex.desc });
    });
    help.createEl("p", {
      cls: "gm-tip",
      text: "\u{1F4A1} \u6807\u7B7E\u683C\u5F0F\uFF1A#\u7C7B\u578B-\u5206\u7C7B1-\u5206\u7C7B2-...-\u5185\u5BB9\uFF0C\u6700\u540E\u4E00\u9879\u4E3A\u5177\u4F53\u5185\u5BB9\uFF0C\u524D\u9762\u4E3A\u5C42\u7EA7\u76EE\u5F55"
    });
  }
  /**
   * 渲染卡片式标签页（技能/装备/副本）- 真正的嵌套透明容器
   */
  renderCardTab(type, tree, title, desc, icon) {
    this.mainContentEl.createEl("h3", { text: `${icon} ${title}` });
    this.mainContentEl.createEl("p", { text: desc, cls: "gm-panel-desc" });
    if (tree.children.length === 0 && tree.items.length === 0) {
      const empty = this.mainContentEl.createDiv({ cls: "gm-empty" });
      empty.textContent = `\u6682\u65E0${title}\u6570\u636E\uFF0C\u5728\u7B14\u8BB0\u4E2D\u4F7F\u7528 #${type === "skills" ? "skill" : type === "equipment" ? "equip" : "dungeon"}-\u5206\u7C7B-\u5185\u5BB9 \u6DFB\u52A0`;
      return;
    }
    const nestedList = this.mainContentEl.createDiv({ cls: "gm-nested-list" });
    this.renderNestedContainers(nestedList, tree.children, tree.items, type);
  }
  /**
   * 递归渲染嵌套透明容器
   */
  renderNestedContainers(parent, children, items, type) {
    const typeIcon = type === "skills" ? "\u2694\uFE0F" : type === "equipment" ? "\u{1F6E1}\uFE0F" : "\u{1F3F0}";
    children.forEach((node) => {
      const totalItems = this.countAllItems(node);
      const isLeaf = node.children.length === 0;
      const container = parent.createDiv({ cls: "gm-nested-container" });
      const header = container.createDiv({ cls: "gm-container-header" });
      header.createDiv({ cls: "gm-container-icon", text: isLeaf ? "\u{1F4C4}" : "\u{1F4C1}" });
      header.createDiv({ cls: "gm-container-title", text: node.name });
      if (totalItems > 0) {
        header.createDiv({ cls: "gm-container-badge", text: String(totalItems) });
      }
      const toggle = header.createDiv({ cls: "gm-container-toggle", text: "\u25B6" });
      const content = container.createDiv({ cls: "gm-container-content" });
      if (isLeaf) {
        this.renderLeafItems(content, node.items, typeIcon);
      } else {
        const grid = content.createDiv({ cls: "gm-nested-grid" });
        this.renderNestedChildren(grid, node.children, node.items, type, typeIcon);
      }
      header.addEventListener("click", () => {
        const isExpanded = content.hasClass("is-visible");
        if (isExpanded) {
          content.removeClass("is-visible");
          toggle.removeClass("is-expanded");
        } else {
          content.addClass("is-visible");
          toggle.addClass("is-expanded");
        }
      });
    });
    if (items.length > 0) {
      const itemsContainer = parent.createDiv({ cls: "gm-nested-container" });
      const header = itemsContainer.createDiv({ cls: "gm-container-header" });
      header.createDiv({ cls: "gm-container-icon", text: "\u{1F4DD}" });
      header.createDiv({ cls: "gm-container-title", text: "\u672A\u5206\u7C7B\u5185\u5BB9" });
      header.createDiv({ cls: "gm-container-badge", text: String(items.length) });
      const toggle = header.createDiv({ cls: "gm-container-toggle", text: "\u25B6" });
      const content = itemsContainer.createDiv({ cls: "gm-container-content" });
      this.renderLeafItems(content, items, typeIcon);
      header.addEventListener("click", () => {
        const isExpanded = content.hasClass("is-visible");
        if (isExpanded) {
          content.removeClass("is-visible");
          toggle.removeClass("is-expanded");
        } else {
          content.addClass("is-visible");
          toggle.addClass("is-expanded");
        }
      });
    }
  }
  /**
   * 渲染嵌套子容器（第二层及更深层）
   */
  renderNestedChildren(grid, children, items, type, typeIcon) {
    children.forEach((node) => {
      const isLeaf = node.children.length === 0;
      const totalItems = this.countAllItems(node);
      const child = grid.createDiv({ cls: "gm-nested-child" });
      const header = child.createDiv({ cls: "gm-nested-child-header" });
      header.createDiv({ cls: "gm-nested-child-icon", text: isLeaf ? "\u{1F4C4}" : "\u{1F4C1}" });
      header.createDiv({ cls: "gm-nested-child-title", text: node.name });
      if (totalItems > 0) {
        header.createDiv({ cls: "gm-nested-child-badge", text: String(totalItems) });
      }
      const preview = child.createDiv({ cls: "gm-nested-child-preview" });
      this.renderPreviewDots(preview, node);
      child.addEventListener("click", () => {
        this.expandNodeDetails(node, type, typeIcon);
      });
    });
    items.forEach((item) => {
      const leaf = grid.createDiv({ cls: "gm-leaf-item" });
      const header = leaf.createDiv({ cls: "gm-leaf-header" });
      header.createDiv({ cls: "gm-leaf-icon", text: item.isFullFile ? "\u{1F4C4}" : "\u{1F4DD}" });
      header.createDiv({ cls: "gm-leaf-title", text: item.content });
      header.createDiv({ cls: "gm-leaf-source", text: this.getFileName(item.sourceFile) });
      if (item.textContent) {
        const contentEl = leaf.createDiv({ cls: "gm-leaf-content" });
        contentEl.textContent = item.textContent.substring(0, 150) + (item.textContent.length > 150 ? "..." : "");
      }
      leaf.addEventListener("click", () => {
        this.app.workspace.openLinkText(item.sourceFile, "", false);
      });
    });
  }
  /**
   * 渲染预览小方块
   */
  renderPreviewDots(preview, node) {
    const allItems = [];
    node.children.forEach((child) => {
      allItems.push({ name: child.name, isFolder: child.children.length > 0 });
    });
    node.items.forEach((item) => {
      allItems.push({ name: item.content, isFolder: false });
    });
    const maxShow = 5;
    const showItems = allItems.slice(0, maxShow);
    const remaining = allItems.length - maxShow;
    showItems.forEach((item) => {
      const dot = preview.createDiv({ cls: "gm-preview-dot" });
      dot.textContent = item.name.substring(0, 4);
    });
    if (remaining > 0) {
      const moreDot = preview.createDiv({ cls: "gm-preview-dot gm-preview-dot-more" });
      moreDot.textContent = `+${remaining}`;
    }
  }
  /**
   * 展开节点详情（在当前视图下方显示）
   */
  expandNodeDetails(node, type, typeIcon) {
    const existing = this.mainContentEl.querySelector(".gm-expanded-details");
    if (existing) {
      existing.remove();
    }
    const details = this.mainContentEl.createDiv({ cls: "gm-expanded-details gm-nested-container" });
    details.style.marginTop = "24px";
    const header = details.createDiv({ cls: "gm-container-header" });
    header.createDiv({ cls: "gm-container-icon", text: "\u{1F4C2}" });
    header.createDiv({ cls: "gm-container-title", text: `\u5C55\u5F00: ${node.name}` });
    const closeBtn = header.createDiv({ cls: "gm-container-toggle", text: "\u2715" });
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      details.remove();
    });
    const content = details.createDiv({ cls: "gm-container-content is-visible" });
    if (node.children.length === 0) {
      this.renderLeafItems(content, node.items, typeIcon);
    } else {
      const grid = content.createDiv({ cls: "gm-nested-grid" });
      this.renderNestedChildren(grid, node.children, node.items, type, typeIcon);
    }
  }
  /**
   * 渲染叶子节点内容项
   */
  renderLeafItems(container, items, typeIcon) {
    if (items.length === 0) {
      container.createDiv({ cls: "gm-empty", text: "\u6682\u65E0\u5185\u5BB9" });
      return;
    }
    const grid = container.createDiv({ cls: "gm-nested-grid" });
    items.forEach((item) => {
      const leaf = grid.createDiv({ cls: "gm-leaf-item" });
      const header = leaf.createDiv({ cls: "gm-leaf-header" });
      header.createDiv({ cls: "gm-leaf-icon", text: item.isFullFile ? "\u{1F4C4}" : typeIcon });
      header.createDiv({ cls: "gm-leaf-title", text: item.content });
      header.createDiv({ cls: "gm-leaf-source", text: this.getFileName(item.sourceFile) });
      if (item.textContent) {
        const contentEl = leaf.createDiv({ cls: "gm-leaf-content" });
        contentEl.textContent = item.textContent;
      }
      leaf.addEventListener("click", () => {
        this.app.workspace.openLinkText(item.sourceFile, "", false);
      });
    });
  }
  /**
   * 根据路径获取节点（保留用于未来可能的功能）
   */
  getNodeAtPath(tree, path) {
    let current = tree;
    for (const segment of path) {
      const child = current.children.find((c) => c.name === segment);
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
  countAllItems(node) {
    let count = node.items.length;
    for (const child of node.children) {
      count += this.countAllItems(child);
    }
    return count;
  }
  /**
   * 从路径获取文件名
   */
  getFileName(path) {
    const parts = path.split("/");
    return parts[parts.length - 1].replace(".md", "");
  }
};

// src/main.ts
var GameManagerPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.view = null;
  }
  async onload() {
    console.log("Loading Game Manager plugin");
    await this.loadSettings();
    this.dataManager = new DataManager(this.app, this.settings);
    const savedData = await this.loadData();
    this.dataManager.loadData(savedData);
    this.registerView(VIEW_TYPE_GAME_MANAGER, (leaf) => {
      this.view = new GameManagerView(leaf, this, this.dataManager);
      return this.view;
    });
    this.addRibbonIcon("gamepad-2", "Game Manager", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-game-manager",
      name: "\u6253\u5F00 Game Manager",
      callback: () => {
        this.activateView();
      }
    });
    this.addCommand({
      id: "rescan-vault",
      name: "\u91CD\u65B0\u626B\u63CF Vault",
      callback: async () => {
        await this.rescan();
      }
    });
    if (this.settings.enableRealTimeUpdate) {
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof import_obsidian2.TFile && file.extension === "md") {
            this.onFileModify(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (file instanceof import_obsidian2.TFile && file.extension === "md") {
            this.onFileDelete(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("rename", (file, oldPath) => {
          if (file instanceof import_obsidian2.TFile && file.extension === "md") {
            this.onFileRename(file, oldPath);
          }
        })
      );
    }
    this.app.workspace.onLayoutReady(async () => {
      const data = this.dataManager.getData();
      if (!data.lastUpdated || Date.now() - data.lastUpdated > 24 * 60 * 60 * 1e3) {
        await this.rescan();
      }
    });
  }
  async onunload() {
    console.log("Unloading Game Manager plugin");
    await this.savePluginData();
  }
  /**
   * 激活视图（在主编辑区打开）
   */
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_GAME_MANAGER);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf("tab");
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_GAME_MANAGER,
          active: true
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
  async rescan() {
    await this.dataManager.fullScan();
    await this.savePluginData();
    this.refreshView();
  }
  /**
   * 文件修改时的处理
   */
  async onFileModify(file) {
    await this.dataManager.updateFile(file);
    await this.savePluginData();
    this.refreshView();
  }
  /**
   * 文件删除时的处理
   */
  onFileDelete(file) {
    this.dataManager.removeFile(file.path);
    this.savePluginData();
    this.refreshView();
  }
  /**
   * 文件重命名时的处理
   */
  async onFileRename(file, oldPath) {
    this.dataManager.removeFile(oldPath);
    await this.dataManager.updateFile(file);
    await this.savePluginData();
    this.refreshView();
  }
  /**
   * 刷新视图
   */
  refreshView() {
    if (this.view) {
      this.view.refresh();
    }
  }
  /**
   * 加载设置
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData({ ...this.settings, ...this.dataManager.getData() });
  }
  /**
   * 保存插件数据
   */
  async savePluginData() {
    await this.saveData(this.dataManager.getData());
  }
};
