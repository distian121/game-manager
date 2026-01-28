/**
 * 标签解析服务
 * 解析 #skill-a-b-c-xxx、#equip-a-b-xxx、#dungeon-a-xxx 格式的标签
 * 规则：最后一项为内容，前面所有项（除类型外）为分类路径
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
      const parsed = parseTag(fullTag, sourceFile, lineNumber);
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
 * @returns 解析后的标签对象，无效则返回 null
 */
export function parseTag(tag: string, sourceFile: string, lineNumber: number): ParsedTag | null {
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
