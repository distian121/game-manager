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
var import_obsidian5 = require("obsidian");

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

// src/services/DataManager.ts
var import_obsidian = require("obsidian");

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
      const linkedDungeons = [];
      const linkedSkills = [];
      const linkedEquipment = [];
      let description;
      const lines = content.split("\n");
      let currentSection = "";
      for (const line of lines) {
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
          currentSection = sectionMatch[1].trim();
          continue;
        }
        if (!description && currentSection === "\u63CF\u8FF0" && line.trim()) {
          description = line.trim();
          continue;
        }
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = linkRegex.exec(line)) !== null) {
          const linkText = match[1];
          if (currentSection.includes("\u526F\u672C") || currentSection.includes("\u6765\u6E90") || currentSection.includes("\u7075\u611F")) {
            linkedDungeons.push({ type: "dungeon", linkText, section: currentSection });
          } else if (currentSection.includes("\u6280\u80FD")) {
            linkedSkills.push({ type: "skill", linkText, section: currentSection });
          } else if (currentSection.includes("\u88C5\u5907")) {
            linkedEquipment.push({ type: "equip", linkText, section: currentSection });
          } else {
            linkedSkills.push({ type: "skill", linkText, section: currentSection });
          }
        }
      }
      const existingIndex = this.data.sets.findIndex((s) => s.filePath === file.path);
      const set = {
        name,
        filePath: file.path,
        linkedDungeons,
        linkedSkills,
        linkedEquipment,
        description
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
  async createSet(name, description) {
    await this.ensureSetsFolder();
    const path = `${this.settings.setsFolder}/${name}.md`;
    const descText = description ? `${description}` : "";
    const content = `# ${name}

## \u63CF\u8FF0

${descText}

## \u7075\u611F\u6765\u6E90\uFF08\u526F\u672C\uFF09


## \u5173\u8054\u6280\u80FD


## \u5173\u8054\u88C5\u5907

`;
    const file = await this.app.vault.create(path, content);
    await this.updateSet(file);
    return file;
  }
  /**
   * 向套装添加关联项
   */
  async addItemToSet(setFilePath, linkText, type) {
    var _a;
    const file = this.app.vault.getAbstractFileByPath(setFilePath);
    if (!(file instanceof import_obsidian.TFile))
      return;
    let content = await this.app.vault.read(file);
    let sectionHeader;
    if (type === "dungeon") {
      sectionHeader = "## \u7075\u611F\u6765\u6E90\uFF08\u526F\u672C\uFF09";
    } else if (type === "skill") {
      sectionHeader = "## \u5173\u8054\u6280\u80FD";
    } else {
      sectionHeader = "## \u5173\u8054\u88C5\u5907";
    }
    const sectionIndex = content.indexOf(sectionHeader);
    if (sectionIndex === -1) {
      content += `
${sectionHeader}

- [[${linkText}]]
`;
    } else {
      const insertPos = sectionIndex + sectionHeader.length;
      const restContent = content.substring(insertPos);
      const nextSectionMatch = restContent.match(/\n## /);
      const insertPoint = nextSectionMatch ? insertPos + ((_a = nextSectionMatch.index) != null ? _a : 0) : content.length;
      const sectionContent = content.substring(sectionIndex, insertPoint);
      if (sectionContent.includes(`[[${linkText}]]`)) {
        return;
      }
      content = content.substring(0, insertPoint) + `- [[${linkText}]]
` + content.substring(insertPoint);
    }
    await this.app.vault.modify(file, content);
    await this.updateSet(file);
  }
  /**
   * 从套装移除关联项
   */
  async removeItemFromSet(setFilePath, linkText) {
    const file = this.app.vault.getAbstractFileByPath(setFilePath);
    if (!(file instanceof import_obsidian.TFile))
      return;
    let content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const filtered = lines.filter((line) => !line.includes(`[[${linkText}]]`));
    content = filtered.join("\n");
    await this.app.vault.modify(file, content);
    await this.updateSet(file);
  }
};

// src/views/GameManagerView.ts
var import_obsidian3 = require("obsidian");

// src/ui/InputModal.ts
var import_obsidian2 = require("obsidian");
var InputModal = class extends import_obsidian2.Modal {
  constructor(app, options, onSubmit) {
    var _a;
    super(app);
    this.result = null;
    // 使用类成员变量解决闭包作用域问题
    this.nameValue = "";
    this.descValue = "";
    this.title = options.title;
    this.namePlaceholder = options.namePlaceholder || "\u8F93\u5165\u540D\u79F0";
    this.showDescription = (_a = options.showDescription) != null ? _a : true;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("gm-input-modal");
    contentEl.createEl("h2", { text: this.title });
    this.nameValue = "";
    this.descValue = "";
    new import_obsidian2.Setting(contentEl).setName("\u540D\u79F0").setDesc("\u540D\u79F0\uFF08\u5C06\u4F5C\u4E3A\u6587\u4EF6\u540D\uFF09").addText(
      (text) => text.setPlaceholder(this.namePlaceholder).onChange((value) => {
        this.nameValue = value;
      })
    );
    if (this.showDescription) {
      new import_obsidian2.Setting(contentEl).setName("\u63CF\u8FF0").setDesc("\u7B80\u77ED\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09").addTextArea(
        (textarea) => textarea.setPlaceholder("\u8F93\u5165\u63CF\u8FF0...").onChange((value) => {
          this.descValue = value;
        })
      );
    }
    const buttonContainer = contentEl.createDiv({ cls: "gm-modal-buttons" });
    const cancelBtn = buttonContainer.createEl("button", {
      text: "\u53D6\u6D88",
      cls: "gm-btn"
    });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });
    const submitBtn = buttonContainer.createEl("button", {
      text: "\u521B\u5EFA",
      cls: "gm-btn gm-btn-primary"
    });
    submitBtn.addEventListener("click", () => {
      if (this.nameValue.trim()) {
        this.result = {
          name: this.nameValue.trim(),
          description: this.descValue.trim() || void 0
        };
        this.close();
      }
    });
    contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (this.nameValue.trim()) {
          this.result = {
            name: this.nameValue.trim(),
            description: this.descValue.trim() || void 0
          };
          this.close();
        }
      }
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.onSubmit(this.result);
  }
};
function showInputModal(app, options) {
  return new Promise((resolve) => {
    const modal = new InputModal(app, options, (result) => {
      resolve(result);
    });
    modal.open();
  });
}

// src/views/GameManagerView.ts
var GameManagerView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin, dataManager) {
    super(leaf);
    this.activeTab = "home";
    this.browseState = null;
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
      { id: "dungeon", label: "\u{1F3F0} \u526F\u672C", icon: "castle" },
      { id: "sets", label: "\u{1F451} \u5957\u88C5", icon: "crown" }
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
        this.browseState = null;
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
      case "sets":
        this.renderSetsTab();
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
    this.renderKnowledgeNetwork();
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
    var _a, _b, _c;
    const folder = container.createDiv({ cls: "gm-folder-card" });
    const totalDungeons = ((_a = set.linkedDungeons) == null ? void 0 : _a.length) || 0;
    const totalSkills = ((_b = set.linkedSkills) == null ? void 0 : _b.length) || 0;
    const totalEquipment = ((_c = set.linkedEquipment) == null ? void 0 : _c.length) || 0;
    const totalItems = totalDungeons + totalSkills + totalEquipment;
    if (totalItems > 0) {
      folder.createDiv({ cls: "gm-folder-badge", text: String(totalItems) });
    }
    const preview = folder.createDiv({ cls: "gm-folder-preview" });
    let previewSlots = 0;
    const maxSlots = 4;
    if (set.linkedDungeons) {
      for (const item of set.linkedDungeons.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: "gm-mini-card" });
        miniCard.createDiv({ cls: "gm-mini-card-icon", text: "\u{1F3F0}" });
        miniCard.createDiv({ cls: "gm-mini-card-name", text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }
    if (previewSlots < maxSlots && set.linkedSkills) {
      for (const item of set.linkedSkills.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: "gm-mini-card" });
        miniCard.createDiv({ cls: "gm-mini-card-icon", text: "\u2694\uFE0F" });
        miniCard.createDiv({ cls: "gm-mini-card-name", text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }
    if (previewSlots < maxSlots && set.linkedEquipment) {
      for (const item of set.linkedEquipment.slice(0, maxSlots - previewSlots)) {
        const miniCard = preview.createDiv({ cls: "gm-mini-card" });
        miniCard.createDiv({ cls: "gm-mini-card-icon", text: "\u{1F6E1}\uFE0F" });
        miniCard.createDiv({ cls: "gm-mini-card-name", text: item.linkText.substring(0, 6) });
        previewSlots++;
      }
    }
    const remaining = totalItems - previewSlots;
    if (remaining > 0 && previewSlots < maxSlots) {
      const moreCard = preview.createDiv({ cls: "gm-mini-card gm-mini-card-more" });
      moreCard.createDiv({ cls: "gm-mini-card-name", text: `+${remaining}` });
      previewSlots++;
    }
    for (let i = previewSlots; i < maxSlots; i++) {
      const emptyCard = preview.createDiv({ cls: "gm-mini-card" });
      emptyCard.style.visibility = "hidden";
    }
    folder.createDiv({ cls: "gm-folder-title", text: set.name });
    if (set.description) {
      const desc = folder.createDiv({ cls: "gm-folder-desc" });
      desc.textContent = set.description.length > 30 ? set.description.substring(0, 30) + "..." : set.description;
    } else {
      const stats = folder.createDiv({ cls: "gm-folder-stats" });
      if (totalDungeons > 0)
        stats.createSpan({ text: `\u{1F3F0}${totalDungeons}` });
      if (totalSkills > 0)
        stats.createSpan({ text: `\u2694\uFE0F${totalSkills}` });
      if (totalEquipment > 0)
        stats.createSpan({ text: `\u{1F6E1}\uFE0F${totalEquipment}` });
    }
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
    const result = await showInputModal(this.app, {
      title: "\u521B\u5EFA\u65B0\u5957\u88C5",
      namePlaceholder: "\u8F93\u5165\u5957\u88C5\u540D\u79F0",
      showDescription: true
    });
    if (result && result.name) {
      const file = await this.dataManager.createSet(result.name, result.description);
      this.app.workspace.openLinkText(file.path, "", false);
      this.renderTab();
    }
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
    const shortcuts = help.createDiv({ cls: "gm-shortcuts" });
    shortcuts.createEl("h5", { text: "\u2328\uFE0F \u5FEB\u6377\u952E" });
    const shortcutList = [
      { key: "Alt+X", desc: "\u6458\u5F55\u9009\u4E2D\u6587\u672C\u5230\u5B50\u526F\u672C" },
      { key: "Alt+S", desc: "\u63D0\u70BC\u9009\u4E2D\u5185\u5BB9\u4E3A\u6280\u80FD" },
      { key: "Alt+E", desc: "\u63D0\u70BC\u9009\u4E2D\u5185\u5BB9\u4E3A\u88C5\u5907" }
    ];
    shortcutList.forEach((s) => {
      const item = shortcuts.createDiv({ cls: "gm-shortcut-item" });
      item.createSpan({ cls: "gm-shortcut-key", text: s.key });
      item.createSpan({ cls: "gm-shortcut-desc", text: s.desc });
    });
  }
  /**
   * 渲染套装标签页
   */
  renderSetsTab() {
    this.mainContentEl.createEl("h3", { text: "\u{1F451} \u5957\u88C5" });
    this.mainContentEl.createEl("p", { text: "\u9879\u76EE\u7D22\u5F15 - \u7EC4\u5408\u6280\u80FD\u3001\u88C5\u5907\u548C\u526F\u672C", cls: "gm-panel-desc" });
    const sets = this.dataManager.getSets();
    if (sets.length === 0) {
      const empty = this.mainContentEl.createDiv({ cls: "gm-empty" });
      empty.createSpan({ text: "\u6682\u65E0\u5957\u88C5\uFF0C" });
      const createLink = empty.createEl("a", { text: "\u521B\u5EFA\u7B2C\u4E00\u4E2A\u5957\u88C5" });
      createLink.addEventListener("click", () => this.createNewSet());
    } else {
      const cardsContainer = this.mainContentEl.createDiv({ cls: "gm-cards-container gm-sets-grid" });
      sets.forEach((set) => {
        this.renderSetFolderCard(cardsContainer, set);
      });
    }
    const actionsContainer = this.mainContentEl.createDiv({ cls: "gm-actions" });
    const addBtn = actionsContainer.createEl("button", {
      cls: "gm-btn gm-btn-primary",
      text: "+ \u65B0\u5EFA\u5957\u88C5"
    });
    addBtn.addEventListener("click", () => this.createNewSet());
  }
  /**
   * 渲染知识关系网络（简单列表形式）
   */
  renderKnowledgeNetwork() {
    const section = this.mainContentEl.createDiv({ cls: "gm-section gm-network-section" });
    section.createEl("h4", { text: "\u{1F517} \u77E5\u8BC6\u5173\u7CFB\u7F51\u7EDC" });
    const relations = [];
    const sets = this.dataManager.getSets();
    sets.forEach((set) => {
      var _a, _b, _c;
      (_a = set.linkedDungeons) == null ? void 0 : _a.forEach((d) => {
        relations.push({
          from: set.name,
          fromType: "set",
          to: d.linkText,
          toType: "dungeon",
          relation: "\u6765\u6E90\u4E8E"
        });
      });
      (_b = set.linkedSkills) == null ? void 0 : _b.forEach((s) => {
        relations.push({
          from: set.name,
          fromType: "set",
          to: s.linkText,
          toType: "skill",
          relation: "\u5305\u542B"
        });
      });
      (_c = set.linkedEquipment) == null ? void 0 : _c.forEach((e) => {
        relations.push({
          from: set.name,
          fromType: "set",
          to: e.linkText,
          toType: "equip",
          relation: "\u5305\u542B"
        });
      });
    });
    if (relations.length === 0) {
      section.createDiv({ cls: "gm-empty", text: "\u6682\u65E0\u5173\u8054\u5173\u7CFB\uFF0C\u521B\u5EFA\u5957\u88C5\u540E\u5C06\u5728\u6B64\u663E\u793A" });
      return;
    }
    const list = section.createDiv({ cls: "gm-relation-list" });
    const typeIcons = {
      set: "\u{1F451}",
      skill: "\u2694\uFE0F",
      equip: "\u{1F6E1}\uFE0F",
      dungeon: "\u{1F3F0}"
    };
    const displayRelations = relations.slice(0, 10);
    displayRelations.forEach((rel) => {
      const item = list.createDiv({ cls: "gm-relation-item" });
      item.innerHTML = `
        <span class="gm-rel-from">${typeIcons[rel.fromType]} ${rel.from}</span>
        <span class="gm-rel-arrow">\u2192</span>
        <span class="gm-rel-label">${rel.relation}</span>
        <span class="gm-rel-arrow">\u2192</span>
        <span class="gm-rel-to">${typeIcons[rel.toType]} ${rel.to}</span>
      `;
    });
    if (relations.length > 10) {
      list.createDiv({ cls: "gm-relation-more", text: `\u8FD8\u6709 ${relations.length - 10} \u6761\u5173\u7CFB...` });
    }
  }
  /**
   * 渲染卡片式标签页（技能/装备/副本）- 三层嵌套卡片系统
   */
  renderCardTab(type, tree, title, desc, icon) {
    if (!this.browseState || this.browseState.type !== type) {
      this.browseState = { type, path: [] };
    }
    const currentNode = this.getNodeAtPath(tree, this.browseState.path);
    this.mainContentEl.createEl("h3", { text: `${icon} ${title}` });
    this.mainContentEl.createEl("p", { text: desc, cls: "gm-panel-desc" });
    if (this.browseState.path.length > 0) {
      this.renderBreadcrumb(type, title, icon);
    }
    if (!currentNode || currentNode.children.length === 0 && currentNode.items.length === 0) {
      const empty = this.mainContentEl.createDiv({ cls: "gm-empty" });
      if (this.browseState.path.length === 0) {
        empty.textContent = `\u6682\u65E0${title}\u6570\u636E\uFF0C\u5728\u7B14\u8BB0\u4E2D\u4F7F\u7528 #${type === "skills" ? "skill" : type === "equipment" ? "equip" : "dungeon"}-\u5206\u7C7B-\u5185\u5BB9 \u6DFB\u52A0`;
      } else {
        empty.textContent = "\u6B64\u5206\u7C7B\u4E0B\u6682\u65E0\u5185\u5BB9";
      }
      return;
    }
    this.renderThreeLevelCards(currentNode, type);
  }
  /**
   * 渲染面包屑导航
   */
  renderBreadcrumb(type, title, icon) {
    const breadcrumb = this.mainContentEl.createDiv({ cls: "gm-breadcrumb" });
    const rootItem = breadcrumb.createSpan({ cls: "gm-breadcrumb-item", text: `${icon} ${title}` });
    rootItem.addEventListener("click", () => {
      if (this.browseState) {
        this.browseState.path = [];
        this.renderTab();
      }
    });
    if (this.browseState) {
      this.browseState.path.forEach((segment, index) => {
        breadcrumb.createSpan({ cls: "gm-breadcrumb-sep", text: "\u203A" });
        if (index === this.browseState.path.length - 1) {
          breadcrumb.createSpan({ cls: "gm-breadcrumb-current", text: segment });
        } else {
          const item = breadcrumb.createSpan({ cls: "gm-breadcrumb-item", text: segment });
          item.addEventListener("click", () => {
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
  renderThreeLevelCards(node, type) {
    const grid = this.mainContentEl.createDiv({ cls: "gm-cards-lg-grid" });
    node.children.forEach((child) => {
      this.renderLargeCard(grid, child, type);
    });
    node.items.forEach((item) => {
      this.renderContentCard(grid, item, "lg");
    });
  }
  /**
   * 渲染大卡片（第一层）
   */
  renderLargeCard(container, node, type) {
    const card = container.createDiv({ cls: "gm-card gm-card-lg" });
    const totalItems = this.countAllItems(node);
    const header = card.createDiv({ cls: "gm-card-header" });
    header.createDiv({ cls: "gm-card-title", text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: "gm-card-badge", text: String(totalItems) });
    }
    const body = card.createDiv({ cls: "gm-card-body" });
    if (node.children.length === 0 && node.items.length > 0) {
      this.renderCardBodyContent(body, node.items, 4);
    } else if (node.children.length > 0) {
      const mdGrid = body.createDiv({ cls: "gm-cards-md-grid" });
      const maxMd = 4;
      const showChildren = node.children.slice(0, maxMd);
      const remainingChildren = node.children.length - maxMd;
      showChildren.forEach((child) => {
        this.renderMediumCard(mdGrid, child, type);
      });
      const remainingSlots = maxMd - showChildren.length;
      const showItems = node.items.slice(0, remainingSlots);
      showItems.forEach((item) => {
        this.renderContentCard(mdGrid, item, "md");
      });
      const totalRemaining = remainingChildren + Math.max(0, node.items.length - remainingSlots);
      if (totalRemaining > 0) {
        const more = mdGrid.createDiv({ cls: "gm-more-card" });
        more.createSpan({ text: `+${totalRemaining} \u66F4\u591A` });
        more.addEventListener("click", (e) => {
          e.stopPropagation();
          this.navigateToNode(node.name);
        });
      }
    }
    card.addEventListener("click", () => {
      this.navigateToNode(node.name);
    });
  }
  /**
   * 渲染中卡片（第二层）
   */
  renderMediumCard(container, node, type) {
    const card = container.createDiv({ cls: "gm-card gm-card-md" });
    const totalItems = this.countAllItems(node);
    const header = card.createDiv({ cls: "gm-card-header" });
    header.createDiv({ cls: "gm-card-title", text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: "gm-card-badge", text: String(totalItems) });
    }
    const body = card.createDiv({ cls: "gm-card-body" });
    if (node.children.length === 0 && node.items.length > 0) {
      this.renderCardBodyContent(body, node.items, 2);
    } else if (node.children.length > 0) {
      const smGrid = body.createDiv({ cls: "gm-cards-sm-grid" });
      const maxSm = 4;
      const showChildren = node.children.slice(0, maxSm);
      const remainingChildren = node.children.length - maxSm;
      showChildren.forEach((child) => {
        this.renderSmallCard(smGrid, child);
      });
      const totalRemaining = remainingChildren + node.items.length;
      if (totalRemaining > 0) {
        const more = smGrid.createDiv({ cls: "gm-more-card" });
        more.createSpan({ text: `+${totalRemaining}` });
      }
    }
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateToNode(node.name);
    });
  }
  /**
   * 渲染小卡片（第三层）
   */
  renderSmallCard(container, node) {
    const card = container.createDiv({ cls: "gm-card gm-card-sm" });
    const totalItems = this.countAllItems(node);
    const header = card.createDiv({ cls: "gm-card-header" });
    header.createDiv({ cls: "gm-card-title", text: node.name });
    if (totalItems > 0) {
      header.createDiv({ cls: "gm-card-badge", text: String(totalItems) });
    }
    const body = card.createDiv({ cls: "gm-card-body" });
    const previewText = this.getNodePreviewText(node);
    if (previewText) {
      body.createDiv({ cls: "gm-card-preview", text: previewText });
    }
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateToNode(node.name);
    });
  }
  /**
   * 渲染内容卡片（叶子节点，显示具体文本）
   */
  renderContentCard(container, item, size) {
    const card = container.createDiv({ cls: `gm-card gm-card-${size} gm-card-content` });
    const header = card.createDiv({ cls: "gm-card-header" });
    header.createDiv({ cls: "gm-card-title", text: item.content });
    const body = card.createDiv({ cls: "gm-card-body" });
    if (item.textContent) {
      const contentEl = body.createDiv({ cls: "gm-content-text gm-markdown-content" });
      this.renderMarkdown(item.textContent, contentEl, item.sourceFile);
    }
    const source = body.createDiv({ cls: "gm-content-source" });
    const link = source.createEl("a", { text: this.getFileName(item.sourceFile) });
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      this.app.workspace.openLinkText(item.sourceFile, "", false);
    });
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      this.app.workspace.openLinkText(item.sourceFile, "", false);
    });
  }
  /**
   * 在卡片 body 中渲染内容项列表
   */
  renderCardBodyContent(body, items, maxItems) {
    const showItems = items.slice(0, maxItems);
    const remaining = items.length - maxItems;
    showItems.forEach((item) => {
      const itemEl = body.createDiv({ cls: "gm-content-text gm-markdown-content" });
      itemEl.style.marginBottom = "6px";
      itemEl.style.cursor = "pointer";
      const content = item.textContent || item.content;
      this.renderMarkdown(content, itemEl, item.sourceFile);
      itemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(item.sourceFile, "", false);
      });
    });
    if (remaining > 0) {
      const more = body.createDiv({ cls: "gm-content-source" });
      more.textContent = `+${remaining} \u66F4\u591A\u5185\u5BB9`;
    }
  }
  /**
   * 使用 Obsidian 的 MarkdownRenderer 渲染 Markdown 内容
   */
  renderMarkdown(content, container, sourcePath) {
    const component = new import_obsidian3.Component();
    component.load();
    import_obsidian3.MarkdownRenderer.render(
      this.app,
      content,
      container,
      sourcePath,
      component
    );
    this.register(() => component.unload());
  }
  /**
   * 获取节点预览文本
   */
  getNodePreviewText(node) {
    const parts = [];
    node.children.slice(0, 2).forEach((child) => {
      parts.push(child.name);
    });
    node.items.slice(0, 2).forEach((item) => {
      parts.push(item.content);
    });
    const remaining = node.children.length + node.items.length - parts.length;
    if (remaining > 0) {
      parts.push(`+${remaining}`);
    }
    return parts.join(", ");
  }
  /**
   * 导航到指定节点
   */
  navigateToNode(nodeName) {
    if (this.browseState) {
      this.browseState.path.push(nodeName);
      this.renderTab();
    }
  }
  /**
   * 根据路径获取节点
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

// src/commands/ExtractCommands.ts
var import_obsidian4 = require("obsidian");
var ExtractCommands = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  /**
   * 从选中文本创建子副本
   * Alt+X 快捷键
   */
  async extractToSubDungeon(editor, view) {
    var _a;
    const selectedText = editor.getSelection();
    if (!selectedText) {
      new import_obsidian4.Notice("\u8BF7\u5148\u9009\u4E2D\u8981\u6458\u5F55\u7684\u6587\u672C");
      return;
    }
    const currentFile = view.file;
    if (!currentFile) {
      new import_obsidian4.Notice("\u65E0\u6CD5\u83B7\u53D6\u5F53\u524D\u6587\u4EF6");
      return;
    }
    const parentPath = await this.getDungeonPath(currentFile);
    const result = await showInputModal(this.plugin.app, {
      title: "\u521B\u5EFA\u5B50\u526F\u672C",
      namePlaceholder: "\u8F93\u5165\u5B50\u526F\u672C\u540D\u79F0",
      showDescription: false
    });
    if (!(result == null ? void 0 : result.name))
      return;
    const subName = result.name;
    const newTag = parentPath.length > 0 ? `#dungeon-${parentPath.join("-")}-${subName}` : `#dungeon-${subName}`;
    const parentDir = ((_a = currentFile.parent) == null ? void 0 : _a.path) || "";
    const newFilePath = (0, import_obsidian4.normalizePath)(`${parentDir}/${subName}.md`);
    const existingFile = this.plugin.app.vault.getAbstractFileByPath(newFilePath);
    if (existingFile) {
      new import_obsidian4.Notice(`\u6587\u4EF6\u5DF2\u5B58\u5728: ${subName}.md`);
      return;
    }
    const sourceLine = editor.getCursor("from").line + 1;
    const content = this.buildSubDungeonContent({
      tag: newTag,
      name: subName,
      extractedText: selectedText,
      sourceFile: currentFile.path,
      sourceLine
    });
    try {
      const newFile = await this.plugin.app.vault.create(newFilePath, content);
      const linkText = `

> \u{1F4DD} \u6458\u5F55\u81F3 [[${subName}]]
`;
      editor.replaceSelection(selectedText + linkText);
      await this.plugin.app.workspace.openLinkText(newFile.path, "", true);
      new import_obsidian4.Notice(`\u5DF2\u521B\u5EFA\u5B50\u526F\u672C: ${subName}`);
    } catch (error) {
      new import_obsidian4.Notice(`\u521B\u5EFA\u6587\u4EF6\u5931\u8D25: ${error}`);
    }
  }
  /**
   * 从选中文本提炼为技能
   * Alt+S 快捷键
   */
  async extractToSkill(editor, view) {
    await this.extractToType(editor, view, "skill");
  }
  /**
   * 从选中文本提炼为装备
   * Alt+E 快捷键
   */
  async extractToEquipment(editor, view) {
    await this.extractToType(editor, view, "equip");
  }
  /**
   * 通用提炼方法
   */
  async extractToType(editor, view, type) {
    var _a;
    const selectedText = editor.getSelection();
    const currentFile = view.file;
    if (!currentFile) {
      new import_obsidian4.Notice("\u65E0\u6CD5\u83B7\u53D6\u5F53\u524D\u6587\u4EF6");
      return;
    }
    const typeLabel = type === "skill" ? "\u6280\u80FD" : "\u88C5\u5907";
    const typeIcon = type === "skill" ? "\u2694\uFE0F" : "\u{1F6E1}\uFE0F";
    const result = await showInputModal(this.plugin.app, {
      title: `\u63D0\u70BC\u4E3A${typeLabel}`,
      namePlaceholder: `\u8F93\u5165${typeLabel}\u540D\u79F0`,
      showDescription: true
    });
    if (!(result == null ? void 0 : result.name))
      return;
    const name = result.name;
    const sourceLine = editor.getCursor("from").line + 1;
    const tag = `#${type}-${name}`;
    if (selectedText && selectedText.length < 300) {
      const content = `

${tag}
${selectedText}
`;
      editor.replaceSelection(content);
      new import_obsidian4.Notice(`\u5DF2\u6DFB\u52A0${typeLabel}: ${name}`);
    } else {
      const parentDir = ((_a = currentFile.parent) == null ? void 0 : _a.path) || "";
      const filePath = (0, import_obsidian4.normalizePath)(`${parentDir}/${name}.md`);
      const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (existingFile) {
        new import_obsidian4.Notice(`\u6587\u4EF6\u5DF2\u5B58\u5728: ${name}.md`);
        return;
      }
      const fileContent = this.buildKnowledgeContent({
        tag,
        name,
        type,
        description: result.description,
        extractedText: selectedText || "",
        sourceFile: currentFile.path,
        sourceLine
      });
      try {
        await this.plugin.app.vault.create(filePath, fileContent);
        const replacement = selectedText ? `${selectedText}

> ${typeIcon} \u5DF2\u63D0\u70BC\u4E3A${typeLabel} [[${name}]]
` : `> ${typeIcon} \u5DF2\u521B\u5EFA${typeLabel} [[${name}]]
`;
        editor.replaceSelection(replacement);
        new import_obsidian4.Notice(`\u5DF2\u521B\u5EFA${typeLabel}: ${name}`);
      } catch (error) {
        new import_obsidian4.Notice(`\u521B\u5EFA\u6587\u4EF6\u5931\u8D25: ${error}`);
      }
    }
  }
  /**
   * 获取当前文件的副本标签路径
   */
  async getDungeonPath(file) {
    try {
      const content = await this.plugin.app.vault.read(file);
      const match = content.match(/#dungeon(-[a-zA-Z0-9\u4e00-\u9fa5_]+)+/);
      if (!match)
        return [];
      const tagContent = match[0].substring(9);
      return tagContent.split("-").filter((p) => p.length > 0);
    } catch (e) {
      return [];
    }
  }
  /**
   * 构建子副本文件内容
   */
  buildSubDungeonContent(params) {
    const sourceFileName = params.sourceFile.replace(".md", "");
    return `---
source: "[[${sourceFileName}]]"
source-line: ${params.sourceLine}
created: ${(/* @__PURE__ */ new Date()).toISOString()}
type: extract
---

${params.tag}

# ${params.name}

## \u6458\u5F55\u5185\u5BB9

${params.extractedText}

## \u6211\u7684\u7406\u89E3

<!-- \u5728\u8FD9\u91CC\u6DFB\u52A0\u4F60\u7684\u601D\u8003\u548C\u603B\u7ED3 -->
<!-- \u53EF\u4EE5\u7EE7\u7EED\u4F7F\u7528 Alt+X \u6458\u5F55\uFF0C\u6216\u4F7F\u7528 Alt+S/E \u63D0\u70BC\u4E3A\u6280\u80FD/\u88C5\u5907 -->

`;
  }
  /**
   * 构建技能/装备文件内容
   */
  buildKnowledgeContent(params) {
    const sourceFileName = params.sourceFile.replace(".md", "");
    const typeLabel = params.type === "skill" ? "\u6280\u80FD" : "\u88C5\u5907";
    return `---
source: "[[${sourceFileName}]]"
source-line: ${params.sourceLine}
created: ${(/* @__PURE__ */ new Date()).toISOString()}
type: ${params.type}
---

${params.tag}

# ${params.name}

${params.description ? `## \u63CF\u8FF0

${params.description}
` : ""}
## \u5185\u5BB9

${params.extractedText || `<!-- \u5728\u8FD9\u91CC\u8BE6\u7EC6\u63CF\u8FF0\u8FD9\u4E2A${typeLabel} -->`}

## \u5173\u8054

<!-- \u53EF\u4EE5\u94FE\u63A5\u76F8\u5173\u7684\u6280\u80FD\u3001\u88C5\u5907\u6216\u526F\u672C -->

`;
  }
};

// src/main.ts
var GameManagerPlugin = class extends import_obsidian5.Plugin {
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
    this.extractCommands = new ExtractCommands(this);
    this.addCommand({
      id: "extract-to-sub-dungeon",
      name: "\u6458\u5F55\u5230\u5B50\u526F\u672C (Extract)",
      editorCallback: (editor, view) => {
        this.extractCommands.extractToSubDungeon(editor, view);
      }
    });
    this.addCommand({
      id: "extract-to-skill",
      name: "\u63D0\u70BC\u4E3A\u6280\u80FD (Skill)",
      editorCallback: (editor, view) => {
        this.extractCommands.extractToSkill(editor, view);
      }
    });
    this.addCommand({
      id: "extract-to-equipment",
      name: "\u63D0\u70BC\u4E3A\u88C5\u5907 (Equip)",
      editorCallback: (editor, view) => {
        this.extractCommands.extractToEquipment(editor, view);
      }
    });
    if (this.settings.enableRealTimeUpdate) {
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file instanceof import_obsidian5.TFile && file.extension === "md") {
            this.onFileModify(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (file instanceof import_obsidian5.TFile && file.extension === "md") {
            this.onFileDelete(file);
          }
        })
      );
      this.registerEvent(
        this.app.vault.on("rename", (file, oldPath) => {
          if (file instanceof import_obsidian5.TFile && file.extension === "md") {
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
