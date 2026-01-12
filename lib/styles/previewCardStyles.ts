/**
 * 预览卡片响应式排版工具
 * 基准宽度：540px
 */

/**
 * 根据卡片宽度计算响应式字号
 * @param baseSize - 基准字号（540px宽度下的字号）
 * @param cardWidth - 当前卡片宽度
 * @returns 计算后的字号
 */
export function getResponsiveFontSize(baseSize: number, cardWidth: number): number {
    return baseSize * (cardWidth / 540);
}

/**
 * 检测文本语言类型
 * @param text - 待检测文本
 * @returns 'chinese' | 'english' | 'mixed'
 */
export function detectTextLanguage(text: string): 'chinese' | 'english' | 'mixed' {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
    const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;

    if (chineseChars > 0 && englishChars === 0) return 'chinese';
    if (englishChars > 0 && chineseChars === 0) return 'english';
    return 'mixed';
}

/**
 * 生成H1标题的字体样式
 * @param language - 语言类型
 * @returns CSS font-family 字符串
 */
export function getH1FontFamily(language: 'chinese' | 'english' | 'mixed'): string {
    if (language === 'chinese') {
        return 'var(--font-noto-serif-sc)';
    } else if (language === 'english') {
        return 'var(--font-inter)';
    } else {
        // 混合：中文用思源宋体，英文用Inter
        return 'var(--font-noto-serif-sc), var(--font-inter)';
    }
}

/**
 * 生成预览卡片的完整样式对象
 * @param cardWidth - 当前卡片宽度
 * @returns 包含所有元素样式的对象
 */
export function getPreviewStyles(cardWidth: number) {
    const scale = cardWidth / 540;

    return {
        // H1 主标题 - 字体由语言检测决定
        h1: {
            fontSize: `${38 * scale}px`,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: '-0.03em',
            marginBottom: `${40 * scale}px`,
        },

        // H2 副标题
        h2: {
            fontFamily: 'Times New Roman, serif',
            fontSize: `${32 * scale}px`,
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: `${32 * scale}px`,
            marginBottom: `${16 * scale}px`,
        },

        // H3 三级标题
        h3: {
            fontFamily: 'Times New Roman, serif',
            fontSize: `${26 * scale}px`,
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: `${24 * scale}px`,
            marginBottom: `${12 * scale}px`,
        },

        // 正文段落
        p: {
            fontSize: `${20 * scale}px`,
            lineHeight: 1.7,
            color: '#333333',
            marginBottom: `${16 * scale}px`,
        },

        // 链接
        a: {
            color: '#4a9eff',
            textDecoration: 'none',
        },

        // 强调（非斜体）
        em: {
            color: '#000000',
            fontStyle: 'normal',
        },

        // 粗体
        strong: {
            fontWeight: 'bold',
        },

        // 高亮标记
        mark: {
            backgroundColor: '#fff59d',
            // background: '#fff59d', // Removed shorthand to avoid conflicts
            color: '#000000',
            fontWeight: 'bold',
            borderRadius: `${4 * scale}px`,
            padding: `${2 * scale}px ${6 * scale}px`,
            textDecoration: 'none',
            textDecorationLine: 'none',
            border: 'none',
            borderBottom: 'none',
            boxShadow: 'none',
            display: 'inline',
            WebkitBoxDecorationBreak: 'clone',
            boxDecorationBreak: 'clone',
        },

        // 无序列表
        ul: {
            fontSize: `${22 * scale}px`,
            paddingLeft: `${20 * scale}px`,
            marginBottom: `${20 * scale}px`,
        },

        // 有序列表
        ol: {
            fontSize: `${22 * scale}px`,
            paddingLeft: `${20 * scale}px`,
            marginBottom: `${20 * scale}px`,
        },

        // 列表项
        li: {
            marginBottom: `${8 * scale}px`,
        },

        // 引用块
        blockquote: {
            borderLeft: `${4 * scale}px solid #4a9eff`,
            paddingLeft: `${20 * scale}px`,
            fontStyle: 'italic',
            margin: `${20 * scale}px 0`,
        },

        // 代码块
        code: {
            fontFamily: 'var(--font-jetbrains-mono)',
            fontSize: `${18 * scale}px`,
            backgroundColor: '#f5f5f5',
            padding: `${2 * scale}px ${6 * scale}px`,
            borderRadius: `${4 * scale}px`,
        },

        // 页码
        pageNumber: {
            fontSize: `${14 * scale}px`,
            fontWeight: 300,
            color: '#9CA3AF',
            paddingTop: `${3 * scale}px`,
        },
    };
}
/**
 * 应用特定元素的样式（使用 centralized styles）
 */
export function applyElementStyles(el: HTMLElement, tag: string, scale: number) {
    // Reset basic styles
    el.style.margin = '0';
    el.style.padding = '0';
    el.removeAttribute('class'); // Remove class to ensure no CSS interference

    const effectiveCardWidth = scale * 540;
    const styles = getPreviewStyles(effectiveCardWidth);

    if (tag === 'p') {
        Object.assign(el.style, styles.p);
    } else if (tag === 'h1') {
        Object.assign(el.style, styles.h1);
        el.style.display = 'block';
    } else if (tag === 'h2') {
        Object.assign(el.style, styles.h2);
    } else if (tag === 'h3') {
        Object.assign(el.style, styles.h3);
    } else if (tag === 'ul') {
        Object.assign(el.style, styles.ul);
    } else if (tag === 'ol') {
        Object.assign(el.style, styles.ol);
    } else if (tag === 'li') {
        Object.assign(el.style, styles.li);
    } else if (tag === 'a') {
        Object.assign(el.style, styles.a);
    } else if (tag === 'code') {
        Object.assign(el.style, styles.code);
    } else if (tag === 'mark') {
        Object.assign(el.style, styles.mark);
    } else if (tag === 'blockquote') {
        Object.assign(el.style, styles.blockquote);
    }
}

/**
 * 处理 HTML 字符串，为所有元素应用内联样式
 * @param html - 原始 HTML 字符串
 * @param cardWidth - 卡片宽度
 * @returns 带有内联样式的 HTML 字符串
 */
export function processHtmlWithStyles(html: string, cardWidth: number): string {
    if (!html) return '';

    // Only works in browser environment
    if (typeof window === 'undefined') return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const scale = cardWidth / 540;

    // Recursive function to apply styles
    const processNode = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();

            applyElementStyles(el, tagName, scale);

            // Recursively process children
            Array.from(el.childNodes).forEach(processNode);
        }
    };

    Array.from(doc.body.childNodes).forEach(processNode);
    return doc.body.innerHTML;
}
