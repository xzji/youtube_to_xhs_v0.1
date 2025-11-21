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
                $patchStyleText(selection, {
                    'background-color': '#fff59d',
                    'border-bottom': '2px solid #ff9800',
                    'border-radius': '4px',
                    'padding': '2px 6px',
                    'font-weight': 'bold',
                });
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
