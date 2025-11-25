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
            color: '#000000',
            fontWeight: 'bold',
            borderBottom: '2px solid #ff9800',
            borderRadius: `${4 * scale}px`,
            padding: `${2 * scale}px ${6 * scale}px`,
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
