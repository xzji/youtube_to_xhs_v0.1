import { getPreviewStyles, detectTextLanguage, getH1FontFamily } from '../styles/previewCardStyles';

// 避头标点：不能出现在行首（即不能作为一页的第一个字符）
const PROHIBITED_START_CHARS = [
    '，', '。', '？', '！', '：', '；', '"', '\'', '）', '】', '》', '、',
    ',', '.', '?', '!', ':', ';', '"', "'", ')', ']', '}',
    '!', ')', ',', '.', ':', ';', '?', ']', '}', '"', '\'', '»'
];

interface PaginationOptions {
    content: string;
    cardWidth: number;  // 卡片总宽度（包括 padding），用于计算 scale
    contentWidth: number;  // 内容宽度（已扣除 padding），用于测量容器
    titleHeight: number; // 第一页需要减去标题高度
    contentHeight: number; // 每页可用内容高度
}

/**
 * 主分页函数 - 保留所有内嵌HTML标签
 */
export const paginateContent = async (options: PaginationOptions): Promise<string[]> => {
    const { content, cardWidth, contentWidth, titleHeight, contentHeight } = options;

    // 1. 创建测量容器
    const container = createMeasurementContainer(contentWidth, cardWidth);
    document.body.appendChild(container);

    // 2. 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const nodes = Array.from(doc.body.childNodes);

    const pages: string[] = [];
    let currentPageNodes: Node[] = [];

    // 计算每页可用高度
    const scale = cardWidth / 540;
    const firstPageMaxHeight = contentHeight - titleHeight - (40 * scale);
    const otherPageMaxHeight = contentHeight;

    // 3. 遍历所有顶层节点（p, h2, ul 等）
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // 跳过空白文本节点
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
            continue;
        }

        // 尝试将节点加入当前页
        const testNodes = [...currentPageNodes, node];
        const maxHeight = pages.length === 0 ? firstPageMaxHeight : otherPageMaxHeight;
        const height = measureNodes(container, testNodes);

        if (height <= maxHeight) {
            // 未溢出，继续添加
            currentPageNodes.push(node);
        } else {
            // 溢出，需要处理
            if (currentPageNodes.length === 0) {
                // 当前页是空的，但单个节点就超出了，需要拆分这个节点
                const splitResult = splitBlockNode(node, container, maxHeight, scale, [], true);

                if (splitResult) {
                    // 当前页放入第一部分
                    pages.push(nodesToHtml([splitResult.first]));
                    currentPageNodes = [];

                    // 剩余部分作为新节点继续处理
                    if (splitResult.remaining) {
                        nodes.splice(i + 1, 0, splitResult.remaining as ChildNode);
                    }
                } else {
                    // 无法拆分，直接放入新页
                    pages.push(nodesToHtml([node]));
                    currentPageNodes = [];
                }
            } else {
                // 当前页已有内容，尝试拆分当前节点
                const splitResult = splitBlockNode(node, container, maxHeight, scale, currentPageNodes, true);

                if (splitResult && splitResult.first) {
                    // 将能放下的部分加入当前页
                    currentPageNodes.push(splitResult.first);
                    pages.push(nodesToHtml(currentPageNodes));
                    currentPageNodes = [];

                    // 剩余部分继续处理
                    if (splitResult.remaining) {
                        nodes.splice(i + 1, 0, splitResult.remaining as ChildNode);
                    }
                } else {
                    // 无法拆分，当前节点完整放入下一页
                    pages.push(nodesToHtml(currentPageNodes));
                    currentPageNodes = [node];
                }
            }
        }
    }

    // 处理最后一页
    if (currentPageNodes.length > 0) {
        pages.push(nodesToHtml(currentPageNodes));
    }

    // 清理
    document.body.removeChild(container);

    return pages;
};

/**
 * 创建测量容器
 */
function createMeasurementContainer(contentWidth: number, cardWidth: number): HTMLElement {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.width = `${contentWidth}px`;
    container.style.padding = '0';
    container.style.margin = '0';

    // 应用基础字体样式
    const scale = cardWidth / 540;
    container.style.fontSize = `${20 * scale}px`;
    container.style.lineHeight = '1.7';
    container.style.color = '#333333';
    container.style.fontFamily = 'sans-serif';

    return container;
}

/**
 * 测量节点数组的高度
 */
function measureNodes(container: HTMLElement, nodes: Node[]): number {
    container.innerHTML = '';
    nodes.forEach(node => container.appendChild(node.cloneNode(true)));
    return container.scrollHeight;
}

/**
 * 将节点数组转换为HTML字符串
 */
function nodesToHtml(nodes: Node[]): string {
    const tempDiv = document.createElement('div');
    nodes.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
    return tempDiv.innerHTML;
}

/**
 * 拆分块级节点（p, h2, ul等），保留所有内嵌HTML标签
 */
function splitBlockNode(
    node: Node,
    container: HTMLElement,
    maxHeight: number,
    scale: number,
    existingNodes: Node[] = [],
    markContinuation: boolean = false  // 是否标记延续项
): { first: Node; remaining: Node | null; isContinuation?: boolean } | null {

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null; // 只处理元素节点
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // 应用样式用于测量
    const styledElement = element.cloneNode(true) as HTMLElement;
    applyElementStyles(styledElement, tagName, scale);

    // 特殊处理：列表现在允许拆分，以防止长列表内容丢失
    // if (tagName === 'ul' || tagName === 'ol') {
    //    return null;
    // }

    // 获取所有子节点（包括文本和内嵌标签）
    const childNodes = Array.from(styledElement.childNodes);

    if (childNodes.length === 0) {
        return null;
    }

    // 使用二分查找找到最佳分割点
    const { splitIndex, flatStructure } = findOptimalSplitPoint(
        styledElement,
        childNodes,
        container,
        maxHeight,
        existingNodes,
        scale,
        tagName
    );

    if (splitIndex === 0) {
        return null; // 无法放入任何内容
    }

    if (splitIndex === flatStructure.length) {
        return null; // 整个节点都能放下，不需要拆分
    }

    // 使用 reconstructElement 重建两个部分
    // 这确保了即使是在文本节点中间拆分，也能正确保留标签结构
    const firstNode = reconstructElement(
        element.tagName,
        flatStructure.slice(0, splitIndex),
        tagName,
        scale,
        false  // 第一部分不标记为延续
    );

    const remainingNode = reconstructElement(
        element.tagName,
        flatStructure.slice(splitIndex),
        tagName,
        scale,
        markContinuation || tagName === 'li'  // 列表项的延续部分标记为延续
    );

    // 应用避头规则
    const adjustedResult = applyProhibitedStartRule(firstNode, remainingNode);

    // 确保延续标记在避头规则处理后仍然保留
    if (tagName === 'li' && adjustedResult.remaining) {
        (adjustedResult.remaining as HTMLElement).setAttribute('data-continuation', 'true');
    }

    return {
        first: adjustedResult.first,
        remaining: adjustedResult.remaining.childNodes.length > 0 ? adjustedResult.remaining : null,
        isContinuation: tagName === 'li'  // 如果是列表项被拆分，标记为延续
    };
}

/**
 * 使用二分查找找到最佳分割点（在TEXT级别）
 */
function findOptimalSplitPoint(
    element: HTMLElement,
    childNodes: Node[],
    container: HTMLElement,
    maxHeight: number,
    existingNodes: Node[],
    scale: number,
    tagName: string
): { splitIndex: number; flatStructure: CharacterEntry[] } {
    // 将复杂的嵌套结构扁平化为字符级别的数组
    // 每个条目记录：字符、所属的节点路径、标签栈
    const flatStructure = flattenToCharacterLevel(childNodes);

    if (flatStructure.length === 0) {
        return { splitIndex: 0, flatStructure };
    }

    // 二分查找最佳分割点（字符级别）
    let left = 0;
    let right = flatStructure.length;
    let bestSplit = 0;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);

        // 重建到mid位置的DOM结构
        const testElement = reconstructElement(element.tagName, flatStructure.slice(0, mid), tagName, scale, false);

        // 测量高度
        const testNodes = [...existingNodes, testElement];
        const height = measureNodes(container, testNodes);

        if (height <= maxHeight) {
            bestSplit = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return { splitIndex: bestSplit, flatStructure };
}

/**
 * 将节点数组扁平化为字符级别的结构
 * 增强版：记录元素路径和属性
 */
interface ElementInfo {
    tagName: string;
    attributes: { [key: string]: string }; // 保存元素的所有属性
    siblingIndex: number; // 同级同类型元素的索引
}

interface CharacterEntry {
    char: string;
    elementPath: ElementInfo[]; // 从根到当前字符的完整元素路径
    nodeIndex: number; // 原始节点索引
}

function flattenToCharacterLevel(nodes: Node[]): CharacterEntry[] {
    const result: CharacterEntry[] = [];

    function traverse(
        node: Node,
        elementPath: ElementInfo[],
        nodeIndex: number,
        siblingCounts: Map<string, number> // 跟踪同级同类型元素的计数
    ) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            for (const char of text) {
                result.push({
                    char,
                    elementPath: elementPath.map(e => ({ ...e })), // 深拷贝
                    nodeIndex
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();

            // 获取当前元素的同级索引
            const siblingKey = `${elementPath.length}-${tagName}`;
            const siblingIndex = siblingCounts.get(siblingKey) || 0;
            siblingCounts.set(siblingKey, siblingIndex + 1);

            // 保存元素属性
            const attributes: { [key: string]: string } = {};
            Array.from(element.attributes).forEach(attr => {
                attributes[attr.name] = attr.value;
            });

            // 创建新的元素信息
            const elementInfo: ElementInfo = {
                tagName,
                attributes,
                siblingIndex
            };

            const newPath = [...elementPath, elementInfo];

            // 为子节点创建新的 siblingCounts（每层独立计数）
            const childSiblingCounts = new Map<string, number>();

            // 递归处理所有子节点
            for (const child of Array.from(element.childNodes)) {
                traverse(child, newPath, nodeIndex, childSiblingCounts);
            }
        }
    }

    // 所有同级节点共享一个 siblingCounts，这样才能正确计数
    const rootSiblingCounts = new Map<string, number>();
    nodes.forEach((node, index) => {
        traverse(node, [], index, rootSiblingCounts);
    });

    return result;
}



/**
 * 根据字符级别的结构重建元素
 */
function reconstructElement(
    containerTag: string,
    charEntries: CharacterEntry[],
    tagName: string,
    scale: number,
    markContinuation: boolean = false  // 是否标记为延续项
): HTMLElement {
    const container = document.createElement(containerTag);
    applyElementStyles(container, tagName, scale);

    // 如果这是一个被拆分的列表项的延续部分，添加标记
    if (markContinuation && containerTag.toLowerCase() === 'li') {
        container.setAttribute('data-continuation', 'true');
    }

    if (charEntries.length === 0) {
        return container;
    }

    // 使用栈来管理嵌套标签
    let currentContainer = container;
    const elementStack: HTMLElement[] = [container];
    let currentPath: ElementInfo[] = [];
    let textBuffer = '';
    let firstLiMarked = false;  // 标记是否已经为第一个 li 设置了 continuation 属性

    function flushText() {
        if (textBuffer) {
            currentContainer.appendChild(document.createTextNode(textBuffer));
            textBuffer = '';
        }
    }

    // 比较两个 elementPath 是否相同
    function pathsEqual(path1: ElementInfo[], path2: ElementInfo[]): boolean {
        if (path1.length !== path2.length) return false;

        for (let i = 0; i < path1.length; i++) {
            if (path1[i].tagName !== path2[i].tagName ||
                path1[i].siblingIndex !== path2[i].siblingIndex) {
                return false;
            }
        }
        return true;
    }

    for (const entry of charEntries) {
        // 检查元素路径是否需要更新
        if (!pathsEqual(entry.elementPath, currentPath)) {
            flushText();

            // 找到分叉点（最后一个相同的元素）
            let commonDepth = 0;
            while (
                commonDepth < Math.min(entry.elementPath.length, currentPath.length) &&
                entry.elementPath[commonDepth].tagName === currentPath[commonDepth].tagName &&
                entry.elementPath[commonDepth].siblingIndex === currentPath[commonDepth].siblingIndex
            ) {
                commonDepth++;
            }

            // 关闭不需要的标签
            while (elementStack.length > commonDepth + 1) {
                elementStack.pop();
                currentPath.pop();
            }

            // 打开新标签
            currentContainer = elementStack[elementStack.length - 1];
            for (let i = commonDepth; i < entry.elementPath.length; i++) {
                const elementInfo = entry.elementPath[i];
                const newElement = document.createElement(elementInfo.tagName);

                // 恢复元素属性
                Object.entries(elementInfo.attributes).forEach(([name, value]) => {
                    newElement.setAttribute(name, value);
                });

                // 应用样式（主要用于块级元素的测量）
                applyElementStyles(newElement, elementInfo.tagName, scale);

                // ✅ 关键修复：如果外层容器是 ul/ol 且标记了 continuation
                // 并且当前创建的是第一个 li 子元素，则标记它
                if (markContinuation &&
                    !firstLiMarked &&
                    (containerTag.toLowerCase() === 'ul' || containerTag.toLowerCase() === 'ol') &&
                    elementInfo.tagName === 'li' &&
                    elementStack.length === 1) {  // 确保是直接子元素
                    newElement.setAttribute('data-continuation', 'true');
                    firstLiMarked = true;  // 标记已设置，确保只设置一次
                }

                currentContainer.appendChild(newElement);
                elementStack.push(newElement);
                currentPath.push(elementInfo);
                currentContainer = newElement;
            }
        }

        textBuffer += entry.char;
    }

    flushText();
    return container;
}



/**
 * 应用避头标点规则
 */
function applyProhibitedStartRule(
    firstNode: HTMLElement,
    remainingNode: HTMLElement
): { first: HTMLElement; remaining: HTMLElement } {

    // 获取remaining节点的第一个字符
    const firstChar = getFirstCharacter(remainingNode);

    if (!firstChar || !PROHIBITED_START_CHARS.includes(firstChar)) {
        return { first: firstNode, remaining: remainingNode };
    }

    // 如果第一个字符是避头标点，需要将其移到firstNode
    const moveResult = moveFirstCharacter(remainingNode, firstNode);

    return {
        first: moveResult.target,
        remaining: moveResult.source
    };
}

/**
 * 获取元素的第一个字符
 */
function getFirstCharacter(element: HTMLElement): string | null {
    function findFirstChar(node: Node): string | null {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            return text.length > 0 ? text[0] : null;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (const child of Array.from(node.childNodes)) {
                const char = findFirstChar(child);
                if (char) return char;
            }
        }
        return null;
    }

    return findFirstChar(element);
}

/**
 * 将第一个字符从source移动到target
 */
function moveFirstCharacter(
    source: HTMLElement,
    target: HTMLElement
): { source: HTMLElement; target: HTMLElement } {

    function moveChar(sourceNode: Node, targetParent: Node): { moved: boolean; char: string | null } {
        if (sourceNode.nodeType === Node.TEXT_NODE) {
            const text = sourceNode.textContent || '';
            if (text.length > 0) {
                const char = text[0];
                const remaining = text.substring(1);

                // 移动字符
                targetParent.appendChild(document.createTextNode(char));
                sourceNode.textContent = remaining;

                return { moved: true, char };
            }
        } else if (sourceNode.nodeType === Node.ELEMENT_NODE) {
            const element = sourceNode as HTMLElement;

            // 在target中创建相同的标签
            const newElement = document.createElement(element.tagName);
            Array.from(element.attributes).forEach(attr => {
                newElement.setAttribute(attr.name, attr.value);
            });
            targetParent.appendChild(newElement);

            // 递归处理子节点
            for (const child of Array.from(element.childNodes)) {
                const result = moveChar(child, newElement);
                if (result.moved) {
                    // 如果源节点变空了，删除它
                    if (!element.textContent?.trim()) {
                        element.remove();
                    }
                    return result;
                }
            }

            // 如果没有移动任何字符，删除刚创建的空元素
            newElement.remove();
        }

        return { moved: false, char: null };
    }

    const sourceClone = source.cloneNode(true) as HTMLElement;
    const targetClone = target.cloneNode(true) as HTMLElement;

    for (const child of Array.from(sourceClone.childNodes)) {
        const result = moveChar(child, targetClone);
        if (result.moved) {
            break;
        }
    }

    return { source: sourceClone, target: targetClone };
}

/**
 * 应用特定元素的样式（必须与 previewCardStyles.ts 保持一致）
 */
function applyElementStyles(el: HTMLElement, tag: string, scale: number) {
    el.style.margin = '0';
    el.style.padding = '0';

    if (tag === 'p') {
        el.style.fontSize = `${20 * scale}px`;
        el.style.marginBottom = `${12 * scale}px`;
    } else if (tag === 'h1') {
        el.style.fontSize = `${40 * scale}px`;
        el.style.fontWeight = '700';
        el.style.fontFamily = 'Times New Roman, serif';
        el.style.marginBottom = `${40 * scale}px`;
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
    } else if (tag === 'li') {
        el.style.fontSize = `${22 * scale}px`;
        el.style.marginBottom = `${4 * scale}px`;
    }
}
