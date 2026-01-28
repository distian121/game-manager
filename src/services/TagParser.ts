/**
 * 标签解析服务
 * 解析 #skill-a-b-c-xxx、#equip-a-b-xxx、#dungeon-a-xxx 格式的标签
 * 规则：
 * - 最后一项为内容，前面所有项（除类型外）为分类路径
 * - 如果标签在文件开头（前几行），表示整个文件都是该类型
 * - 如果标签在文中，表示从标签下一行到下一个空行的内容
 */

import { ParsedTag, TagType } from '../types';

// 支持的标签类型前缀
const TAG_PREFIXES: Record<string, TagType> = {
  'skill': 'skill',
  'equip': 'equip',
  'dungeon': 'dungeon',
  'set': 'set',
};

// 标签匹配正则：#type-xxx-xxx-xxx（至少有类型和一个内容）
const TAG_REGEX = /#(skill|equip|dungeon|set)(-[a-zA-Z0-9\u4e00-\u9fa5_]+)+/g;

/**
 * 判断标签是否在文件开头（前3行非空行内）
 */
function isAtFileStart(lines: string[], lineIndex: number): boolean {
  let nonEmptyCount = 0;
  for (let i = 0; i <= lineIndex && i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      nonEmptyCount++;
    }
  }
  return nonEmptyCount <= 3;
}

/**
 * 获取标签关联的文本内容
 * @param lines 文件所有行
 * @param tagLineIndex 标签所在行索引
 * @param isFullFile 是否为全文件标签
 * @returns 关联的文本内容
 */
function getAssociatedContent(lines: string[], tagLineIndex: number, isFullFile: boolean): string {
  if (isFullFile) {
    // 全文件标签：返回整个文件内容（跳过标签行）
    const contentLines = lines.slice(tagLineIndex + 1).filter(line => {
      // 跳过其他标签行和空行开头
      return !line.trim().match(/^#(skill|equip|dungeon|set)-/);
    });
    return contentLines.join('\n').trim().substring(0, 500); // 限制长度
  } else {
    // 文中标签：从下一行到下一个空行
    const contentLines: string[] = [];
    for (let i = tagLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        break; // 遇到空行停止
      }
      // 如果遇到另一个标签，也停止
      if (line.match(/#(skill|equip|dungeon|set)-/)) {
        break;
      }
      contentLines.push(line);
    }
    return contentLines.join('\n').trim().substring(0, 300); // 限制长度
  }
}

/**
 * 从文本内容中解析所有标签
 * @param content 文件内容
 * @param sourceFile 来源文件路径
 * @returns 解析后的标签数组
 */
export function parseTagsFromContent(content: string, sourceFile: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let match: RegExpExecArray | null;

    // 重置正则状态
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

/**
 * 解析单个标签
 * @param tag 完整标签字符串，如 #skill-编程-python-装饰器
 * @param sourceFile 来源文件
 * @param lineNumber 行号
 * @param textContent 关联的文本内容
 * @param isFullFile 是否为全文件标签
 * @returns 解析后的标签对象，无效则返回 null
 */
export function parseTag(
  tag: string, 
  sourceFile: string, 
  lineNumber: number,
  textContent?: string,
  isFullFile?: boolean
): ParsedTag | null {
  // 移除 # 前缀
  const withoutHash = tag.startsWith('#') ? tag.slice(1) : tag;
  
  // 按 - 分割
  const parts = withoutHash.split('-');
  
  if (parts.length < 2) {
    return null; // 至少需要类型和一个内容
  }

  const typeStr = parts[0].toLowerCase();
  const type = TAG_PREFIXES[typeStr];

  if (!type) {
    return null; // 未知类型
  }

  // 最后一项是内容，中间的是分类路径
  const content = parts[parts.length - 1];
  const categories = parts.slice(1, -1); // 可能为空数组（只有类型和内容）

  return {
    type,
    categories,
    content,
    sourceFile,
    lineNumber,
    fullTag: tag,
    textContent,
    isFullFile,
  };
}

/**
 * 从标签构建完整路径（用于树结构）
 * @param tag 解析后的标签
 * @returns 路径数组，如 ['编程', 'python', '装饰器']
 */
export function buildPathFromTag(tag: ParsedTag): string[] {
  return [...tag.categories, tag.content];
}

/**
 * 验证标签格式是否正确
 * @param tag 标签字符串
 * @returns 是否有效
 */
export function isValidTag(tag: string): boolean {
  TAG_REGEX.lastIndex = 0;
  return TAG_REGEX.test(tag);
}

/**
 * 获取标签的显示名称
 * @param tag 解析后的标签
 * @returns 用于显示的名称
 */
export function getTagDisplayName(tag: ParsedTag): string {
  if (tag.categories.length === 0) {
    return tag.content;
  }
  return `${tag.categories.join(' > ')} > ${tag.content}`;
}
