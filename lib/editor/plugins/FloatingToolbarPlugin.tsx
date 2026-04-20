'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import {
    Bold,
    Italic,
    Underline,
    Link as LinkIcon,
    List,
    ListOrdered,
    Quote,
    Code,
    Heading2,
    Heading3,
    Highlighter,
} from 'lucide-react';
import { mergeRegister } from '@lexical/utils';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $patchStyleText } from '@lexical/selection';
import { createPortal } from 'react-dom';

export default function FloatingToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const [isText, setIsText] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
            // 检查是否有选中的文本
            const hasText = !selection.isCollapsed();
            setIsText(hasText);

            if (hasText) {
                setIsBold(selection.hasFormat('bold'));
                setIsItalic(selection.hasFormat('italic'));
                setIsUnderline(selection.hasFormat('underline'));

                // 计算工具栏位置
                const nativeSelection = window.getSelection();
                if (nativeSelection && nativeSelection.rangeCount > 0) {
                    const range = nativeSelection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    setPosition({
                        top: rect.top - 50 + window.scrollY,
                        left: rect.left + rect.width / 2 - 200, // 工具栏宽度的一半
                    });
                }
            }
        } else {
            setIsText(false);
        }
    }, []);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                1
            ),
        );
    }, [editor, updateToolbar]);

    const formatHeading = (headingType: HeadingTagType) => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createHeadingNode(headingType));
            }
        });
    };

    const formatQuote = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createQuoteNode());
            }
        });
    };

    const formatCode = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createCodeNode());
            }
        });
    };

    const insertLink = () => {
        const url = prompt('输入链接地址:');
        if (url) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }
    };

    const toggleHighlight = () => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                // simple check: if any part of selection has the background color, remove it
                // A robust implementation might check all nodes, but for now specific style check is fine
                // Lexical's $patchStyleText merges styles. To remove, we set values to null.

                // HACK: Check if the *first* node in selection has the style to determine toggle state
                // This is a common simplification.
                // Or better: try to remove first, if no change (or checking current style), then add.

                // Let's use `hasFormat` equivalent for styles? Lexical doesn't have `hasStyle`.
                // We need to check style of the nodes.

                // We'll trust the user intention: if they click highlight, and it looks highlighted, they want to remove.
                // For this simple implementation, let's check a known style property on the selection anchor.

                // Actually, $patchStyleText is smart. But to *remove*, we need to pass null.
                // We need to know IF we should remove.
                // Let's just implement a robust toggle based on current state.

                // Since we don't track `isHighlight` state in this component yet (only bold/italic),
                // let's add logic to detect it or just blindly apply/remove based on a heuristic?
                // No, better to detect.

                // Let's rely on the fact that if we apply 'background-color': null, it removes it.
                // But we need to know the current state.
                // Let's try to read the style from the selection.

                /* 
                   Lexical doesn't provide an easy "getStyle" for RangeSelection exposed directly here easily without traversing.
                   However, we can check the nodes. 
                */

                // Improved logic:
                const currentStyle = selection.style; // RangeSelection has a style string? No.
                // It's on the nodes.

                // Let's use a simpler approach used by other plugins:
                // Check if the selection has the specific background color using a helper or DOM check?
                // The floating toolbar is checking bold/italic using `selection.hasFormat`.
                // For styles, it's harder.

                // Let's implement a rudimentary toggle:
                // We will try to apply "remove" styles. If we are properly highlighting, we track it.

                // Better plan: Add `isHighlight` to the state tracking (lines 35-40) so the button shows active state,
                // and use that state to decide whether to add or remove.

                // But first, let's update the `updateToolbar` to detect highlight.
                // We can't easily detect "background-color: #fff59d" with `selection.hasFormat`.
                // We need to parse `selection.getStyle()`. Wait, does RangeSelection have `getStyle`? Not directly public in all versions.

                // Let's try `selection.hasStyle` if available? No.

                // Alternative: We can check the DOM node of the anchor.
                // const anchorNode = selection.anchor.getNode();
                // const style = anchorNode.getStyle(); 

                // Let's proceed with:
                // 1. Get nodes. 
                // 2. Check if any has 'background-color: #fff59d'.
                // 3. If so, remove. Else add.

                const nodes = selection.getNodes();
                const isHighlighted = nodes.some(node => {
                    if ('getStyle' in node && typeof node.getStyle === 'function') {
                        const style = node.getStyle() as string;
                        return style.includes('background-color: #fff59d') || style.includes('background-color: rgb(255, 245, 157)');
                    }
                    return false;
                });

                if (isHighlighted) {
                    $patchStyleText(selection, {
                        'background-color': null,
                        'border-bottom': null,
                        'border-radius': null,
                        'padding': null,
                        'font-weight': null,
                    });
                } else {
                    $patchStyleText(selection, {
                        'background-color': '#fff59d',
                        'border-bottom': '2px solid #ff9800',
                        'border-radius': '4px',
                        'padding': '2px 6px',
                        'font-weight': 'bold',
                    });
                }
            }
        });
    };

    if (!isText) {
        return null;
    }

    return createPortal(
        <div
            ref={toolbarRef}
            className="fixed z-50 flex gap-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            {/* 标题 */}
            <button
                onClick={() => formatHeading('h2')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="H2 标题"
            >
                <Heading2 className="w-4 h-4" />
            </button>
            <button
                onClick={() => formatHeading('h3')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="H3 标题"
            >
                <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 文本格式 */}
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
                className={`p-2 rounded transition-colors ${isBold ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="加粗"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
                className={`p-2 rounded transition-colors ${isItalic ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="斜体"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
                className={`p-2 rounded transition-colors ${isUnderline ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                title="下划线"
            >
                <Underline className="w-4 h-4" />
            </button>
            <button
                onClick={toggleHighlight}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="高亮"
            >
                <Highlighter className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 列表 */}
            <button
                onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="无序列表"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="有序列表"
            >
                <ListOrdered className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 其他 */}
            <button
                onClick={insertLink}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="插入链接"
            >
                <LinkIcon className="w-4 h-4" />
            </button>
            <button
                onClick={formatQuote}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="引用"
            >
                <Quote className="w-4 h-4" />
            </button>
            <button
                onClick={formatCode}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="代码块"
            >
                <Code className="w-4 h-4" />
            </button>
        </div>,
        document.body
    );
}
