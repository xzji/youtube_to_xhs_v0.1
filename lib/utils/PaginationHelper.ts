import { getPreviewStyles, detectTextLanguage, getH1FontFamily } from '../styles/previewCardStyles';

// 避头标点：不能出现在行首（即不能作为一页的第一个字符）
const PROHIBITED_START_CHARS = [
    '，', '。', '？', '！', '：', '；', '”', '’', '）', '】', '》', '、',
    ',', '.', '?', '!', ':', ';', '"', "'", ')', ']', '}',
    '!', ')', ',', '.', ':', ';', '?', ']', '}', '”', '’', '»'
];

interface PaginationOptions {
    content: string;
    cardWidth: number;  // 卡片总宽度（包括 padding），用于计算 scale
    contentWidth: number;  // 内容宽度（已扣除 padding），用于测量容器
    titleHeight: number; // 第一页需要减去标题高度
    contentHeight: number; // 每页可用内容高度
}

export const paginateContent = async (options: PaginationOptions): Promise<string[]> => {
    const { content, cardWidth, contentWidth, titleHeight, contentHeight } = options;

    // 1. 创建测量容器
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.width = `${contentWidth}px`; // ✅ 使用内容宽度
    container.style.padding = '0'; // 内容区域无padding，由外层控制
    container.style.margin = '0';

    // ✅ 应用基础字体样式 (与 previewCardStyles 保持一致)
    // 使用卡片总宽度计算 scale
    const scale = cardWidth / 540;
    container.style.fontSize = `${20 * scale}px`;
    container.style.lineHeight = '1.7';
    container.style.color = '#333333';
    container.style.fontFamily = 'sans-serif'; // 默认字体

    document.body.appendChild(container);

    // 2. 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const nodes = Array.from(doc.body.childNodes);

    const pages: string[] = [];
    let currentPageContent: Node[] = [];
    let currentHeight = 0;
    // 第一页可用高度 = 总高度 - 标题高度 - 标题margin
    // 标题margin在样式中是 40 * scale
    const firstPageMaxHeight = contentHeight - titleHeight - (40 * scale);
    const otherPageMaxHeight = contentHeight;

    // 辅助函数：获取当前页的最大高度
    const getMaxHeight = () => pages.length === 0 ? firstPageMaxHeight : otherPageMaxHeight;

    // 辅助函数：将节点列表转换为 HTML 字符串
    const nodesToHtml = (nodes: Node[]) => {
        const tempDiv = document.createElement('div');
        nodes.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
        return tempDiv.innerHTML;
    };

    // 辅助函数：测量当前内容高度
    const measure = (nodes: Node[]) => {
        container.innerHTML = '';
        nodes.forEach(node => container.appendChild(node.cloneNode(true)));
        return container.scrollHeight;
    };

    // 3. 遍历节点
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // 尝试将节点加入当前页
        currentPageContent.push(node);
        const height = measure(currentPageContent);

        if (height <= getMaxHeight()) {
            // 未溢出，继续
            continue;
        }

        // 溢出，需要回退并拆分
        currentPageContent.pop(); // 移除导致溢出的节点

        // 如果是文本节点或简单元素，尝试拆分
        if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE)) {
            const remainingNode = await splitNode(
                node,
                container,
                currentPageContent,
                getMaxHeight(),
                scale
            );

            // 完成当前页
            pages.push(nodesToHtml(currentPageContent));
            currentPageContent = [];

            // 如果有剩余部分，将其作为下一个待处理节点插入回循环
            if (remainingNode) {
                // 替换当前节点为剩余部分，并回退索引以重新处理
                nodes[i] = remainingNode as ChildNode;
                i--;
            }
        } else {
            // 复杂节点暂不拆分（理论上不应出现，因为富文本主要是 p, h2, ul 等）
            // 直接放入下一页
            pages.push(nodesToHtml(currentPageContent));
            currentPageContent = [node];
        }
    }

    // 处理最后一页
    if (currentPageContent.length > 0) {
        pages.push(nodesToHtml(currentPageContent));
    }

    // 清理
    document.body.removeChild(container);

    return pages;
};

// 深度拆分节点
async function splitNode(
    node: Node,
    container: HTMLElement,
    currentContent: Node[],
    maxHeight: number,
    scale: number
): Promise<Node | null> {
    // 这里主要处理 Element 节点（如 <p>text</p>）
    // 如果是纯 Text 节点，逻辑类似但更简单

    let clone: HTMLElement | Text;
    let textContent = '';
    let isElement = false;

    if (node.nodeType === Node.ELEMENT_NODE) {
        clone = node.cloneNode(true) as HTMLElement;
        textContent = clone.textContent || '';
        isElement = true;

        // 应用特定样式以便测量（如 h2, ul 等）
        const tag = (node as HTMLElement).tagName.toLowerCase();
        applyElementStyles(clone as HTMLElement, tag, scale);

    } else {
        clone = node.cloneNode(true) as Text;
        textContent = clone.textContent || '';
    }

    // 二分查找
    let left = 0;
    let right = textContent.length;
    let splitIndex = 0;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const subText = textContent.substring(0, mid);

        // 构建临时节点用于测量
        let tempNode: Node;
        if (isElement) {
            (clone as HTMLElement).textContent = subText;
            tempNode = clone;
        } else {
            tempNode = document.createTextNode(subText);
        }

        // 测量：已有内容 + 尝试的这部分内容
        container.innerHTML = '';
        currentContent.forEach(n => container.appendChild(n.cloneNode(true)));
        container.appendChild(tempNode.cloneNode(true));

        if (container.scrollHeight <= maxHeight) {
            splitIndex = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    // 避头规则处理
    // 检查 splitIndex 后的第一个字符
    if (splitIndex < textContent.length) {
        const nextChar = textContent[splitIndex];
        if (PROHIBITED_START_CHARS.includes(nextChar)) {
            // 如果下一页首字是避头标点，则将其包含在当前页
            // 这可能会导致当前页轻微溢出，但在排版上是允许的
            splitIndex++;
        }
    }

    // 执行拆分
    const firstPartText = textContent.substring(0, splitIndex);
    const secondPartText = textContent.substring(splitIndex);

    // 1. 将前半部分加入 currentContent
    if (isElement) {
        const firstNode = node.cloneNode(false) as HTMLElement; // 浅拷贝，保留标签属性
        firstNode.textContent = firstPartText;
        // 再次应用样式确保渲染正确
        const tag = (node as HTMLElement).tagName.toLowerCase();
        applyElementStyles(firstNode, tag, scale);
        currentContent.push(firstNode);
    } else {
        currentContent.push(document.createTextNode(firstPartText));
    }

    // 2. 返回后半部分作为新节点
    if (secondPartText.length === 0) return null;

    if (isElement) {
        const secondNode = node.cloneNode(false) as HTMLElement;
        secondNode.textContent = secondPartText;
        return secondNode;
    } else {
        return document.createTextNode(secondPartText);
    }
}

// 辅助：应用特定元素的样式（必须与 previewCardStyles.ts 保持一致）
function applyElementStyles(el: HTMLElement, tag: string, scale: number) {
    // 基础重置
    el.style.margin = '0';
    el.style.padding = '0';

    if (tag === 'p') {
        el.style.fontSize = `${20 * scale}px`;
        el.style.marginBottom = `${12 * scale}px`;
    } else if (tag === 'h2') {
        el.style.fontSize = `${32 * scale}px`;
        el.style.fontWeight = '700';
        el.style.fontFamily = 'Times New Roman, serif';
        el.style.marginBottom = `${16 * scale}px`;
        el.style.marginTop = `${24 * scale}px`;
    } else if (tag === 'h3') {
        el.style.fontSize = `${26 * scale}px`;
        el.style.fontWeight = '700';
        el.style.fontFamily = 'Times New Roman, serif';
        el.style.marginBottom = `${12 * scale}px`;
        el.style.marginTop = `${20 * scale}px`;
    } else if (tag === 'ul' || tag === 'ol') {
        el.style.fontSize = `${22 * scale}px`;
        el.style.paddingLeft = `${20 * scale}px`;
        el.style.marginBottom = `${12 * scale}px`;
    }
    // ... 其他样式根据需要添加
}
