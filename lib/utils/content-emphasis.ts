const BLOCK_TAG_PATTERN = /<(p|h[1-6]|ul|ol|li|blockquote|pre|div)\b/i;
const ANY_TAG_PATTERN = /<[^>]+>/;
const SKIP_INLINE_TAGS = new Set(['strong', 'mark', 'code', 'pre', 'a']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isOrderedListItem(line: string): boolean {
  return /^\d+[.)]\s+/.test(line);
}

function isUnorderedListItem(line: string): boolean {
  return /^[-*•]\s+/.test(line);
}

function isHeadingLine(line: string): boolean {
  return /^(#{1,3}\s*|[一二三四五六七八九十]+[、.]\s*|[0-9]+[、.]\s*)/.test(line);
}

function stripHeadingPrefix(line: string): string {
  return line.replace(/^(#{1,3}\s*|[一二三四五六七八九十]+[、.]\s*|[0-9]+[、.]\s*)/, '').trim();
}

function formatPlainTextAsHtml(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '';
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        return '';
      }

      if (lines.length === 1 && isHeadingLine(lines[0])) {
        return `<h2>${escapeHtml(stripHeadingPrefix(lines[0]))}</h2>`;
      }

      if (lines.every(isOrderedListItem)) {
        return `<ol>${lines
          .map((line) => `<li>${escapeHtml(line.replace(/^\d+[.)]\s+/, ''))}</li>`)
          .join('')}</ol>`;
      }

      if (lines.every(isUnorderedListItem)) {
        return `<ul>${lines
          .map((line) => `<li>${escapeHtml(line.replace(/^[-*•]\s+/, ''))}</li>`)
          .join('')}</ul>`;
      }

      return `<p>${lines.map(escapeHtml).join('<br />')}</p>`;
    })
    .join('');
}

function wrapPattern(text: string, pattern: RegExp, tagName: 'strong' | 'mark'): string {
  return text.replace(pattern, (_match, prefix: string = '', target: string) => {
    const safePrefix = prefix || '';
    const safeTarget = typeof target === 'string' ? target.trim() : '';

    if (!safeTarget) {
      return _match;
    }

    return `${safePrefix}<${tagName}>${safeTarget}</${tagName}>`;
  });
}

function emphasizeSegment(text: string): string {
  if (!text.trim()) {
    return text;
  }

  let result = text;

  const markPatterns: RegExp[] = [
    /(^|[\s>（(])((?:最重要的是|真正的关键是|核心观点是|核心结论是|核心逻辑是|重点是|本质上|本质是|记住这一点|说白了|总结一下|一句话总结|一定要|千万不要)[^，。！？；\n<]{0,26})/g,
    /(^|[\s>（(])((?:值得反复看|最值得注意的是|需要注意的是|最容易忽略的一点是)[^，。！？；\n<]{0,24})/g,
    /(^|[\s>（(])((?:不是[^，。！？；\n<]{0,16}而是[^，。！？；\n<]{0,16}))/g,
  ];

  const strongPatterns: RegExp[] = [
    /(^|[\s>（(])((?:首先|其次|然后|最后|第一|第二|第三|一是|二是|三是)(?:[：:，、]?))/g,
    /(^|[\s>（(])((?:关键在于|原因就在于|结论是|重点来了)[^，。！？；\n<]{0,18})/g,
    /(^|[\s>（(])([「“"][^「」“”"<>\n]{4,18}[」”"])/g,
  ];

  for (const pattern of markPatterns) {
    result = wrapPattern(result, pattern, 'mark');
  }

  for (const pattern of strongPatterns) {
    result = wrapPattern(result, pattern, 'strong');
  }

  return result;
}

function applyEmphasisToHtml(html: string): string {
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);
  const tagStack: string[] = [];

  return tokens
    .map((token) => {
      if (token.startsWith('<')) {
        const closeMatch = token.match(/^<\/([a-z0-9-]+)/i);
        if (closeMatch) {
          const closingTag = closeMatch[1].toLowerCase();
          for (let index = tagStack.length - 1; index >= 0; index -= 1) {
            if (tagStack[index] === closingTag) {
              tagStack.splice(index, 1);
              break;
            }
          }
          return token;
        }

        const openMatch = token.match(/^<([a-z0-9-]+)/i);
        const isSelfClosing = /\/>$/.test(token) || /^<br\s*\/?>$/i.test(token);
        if (openMatch && !isSelfClosing) {
          tagStack.push(openMatch[1].toLowerCase());
        }
        return token;
      }

      if (tagStack.some((tag) => SKIP_INLINE_TAGS.has(tag))) {
        return token;
      }

      return emphasizeSegment(token);
    })
    .join('');
}

export function formatGeneratedContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  const html = BLOCK_TAG_PATTERN.test(trimmed)
    ? trimmed
    : ANY_TAG_PATTERN.test(trimmed)
      ? `<p>${trimmed}</p>`
      : formatPlainTextAsHtml(trimmed);

  return applyEmphasisToHtml(html);
}
