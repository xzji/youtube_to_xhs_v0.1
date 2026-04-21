'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    CAN_UNDO_COMMAND,
    CAN_REDO_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
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
    Undo2,
    Redo2,
} from 'lucide-react';
import { mergeRegister } from '@lexical/utils';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
    HIGHLIGHT_BACKGROUND_COLOR,
    HIGHLIGHT_BORDER_COLOR,
    HIGHLIGHT_BORDER_WIDTH_PX,
    HIGHLIGHT_FONT_WEIGHT,
    HIGHLIGHT_PADDING_X_PX,
    HIGHLIGHT_PADDING_Y_PX,
    HIGHLIGHT_RADIUS_PX,
} from '@/lib/constants/highlight-style';


export default function ToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isHighlight, setIsHighlight] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            setIsBold(selection.hasFormat('bold'));
            setIsItalic(selection.hasFormat('italic'));
            setIsUnderline(selection.hasFormat('underline'));
            // Check for highlight style (background-color)
            const backgroundColor = $getSelectionStyleValueForProperty(selection, 'background-color', HIGHLIGHT_BACKGROUND_COLOR);
            setIsHighlight(!!backgroundColor);
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
            editor.registerCommand(
                CAN_UNDO_COMMAND,
                (payload) => {
                    setCanUndo(payload);
                    return false;
                },
                1
            ),
            editor.registerCommand(
                CAN_REDO_COMMAND,
                (payload) => {
                    setCanRedo(payload);
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
                // 使用 mark 标签模拟高亮
                $patchStyleText(selection, {
                    'background-color': HIGHLIGHT_BACKGROUND_COLOR,
                    'border-bottom': `${HIGHLIGHT_BORDER_WIDTH_PX}px solid ${HIGHLIGHT_BORDER_COLOR}`,
                    'border-radius': `${HIGHLIGHT_RADIUS_PX}px`,
                    'padding': `${HIGHLIGHT_PADDING_Y_PX}px ${HIGHLIGHT_PADDING_X_PX}px`,
                    'font-weight': HIGHLIGHT_FONT_WEIGHT,
                });
            }
        });
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
            {/* 撤销/重做 */}
            <button
                disabled={!canUndo}
                onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
                className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                title="撤销"
            >
                <Undo2 className="w-4 h-4" />
            </button>
            <button
                disabled={!canRedo}
                onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
                className="p-2 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                title="重做"
            >
                <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 标题 */}
            <button
                onClick={() => formatHeading('h2')}
                className="p-2 hover:bg-gray-200 rounded"
                title="H2 标题"
            >
                <Heading2 className="w-4 h-4" />
            </button>
            <button
                onClick={() => formatHeading('h3')}
                className="p-2 hover:bg-gray-200 rounded"
                title="H3 标题"
            >
                <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 文本格式 */}
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
                className={`p-2 hover:bg-gray-200 rounded ${isBold ? 'bg-gray-300' : ''}`}
                title="加粗"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
                className={`p-2 hover:bg-gray-200 rounded ${isItalic ? 'bg-gray-300' : ''}`}
                title="斜体"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
                className={`p-2 hover:bg-gray-200 rounded ${isUnderline ? 'bg-gray-300' : ''}`}
                title="下划线"
            >
                <Underline className="w-4 h-4" />
            </button>
            <button
                onClick={toggleHighlight}
                className={`p-2 hover:bg-gray-200 rounded ${isHighlight ? 'bg-gray-300' : ''}`}
                title="高亮"
            >
                <Highlighter className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 列表 */}
            <button
                onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
                className="p-2 hover:bg-gray-200 rounded"
                title="无序列表"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
                className="p-2 hover:bg-gray-200 rounded"
                title="有序列表"
            >
                <ListOrdered className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1" />

            {/* 其他 */}
            <button
                onClick={insertLink}
                className="p-2 hover:bg-gray-200 rounded"
                title="插入链接"
            >
                <LinkIcon className="w-4 h-4" />
            </button>
            <button
                onClick={formatQuote}
                className="p-2 hover:bg-gray-200 rounded"
                title="引用"
            >
                <Quote className="w-4 h-4" />
            </button>
            <button
                onClick={formatCode}
                className="p-2 hover:bg-gray-200 rounded"
                title="代码块"
            >
                <Code className="w-4 h-4" />
            </button>
        </div>
    );
}
