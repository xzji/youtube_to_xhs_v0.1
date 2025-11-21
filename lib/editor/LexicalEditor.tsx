'use client';

import { $getRoot, $getSelection, EditorState, LexicalEditor as LexicalEditorType } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { MarkNode } from '@lexical/mark';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import FloatingToolbarPlugin from './plugins/FloatingToolbarPlugin';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface LexicalEditorProps {
    value: string; // HTML string
    onChange: (html: string) => void;
    placeholder?: string;
}

// 编辑器主题配置
const theme = {
    paragraph: 'mb-2',
    quote: 'border-l-4 border-gray-300 pl-4 italic my-4',
    heading: {
        h2: 'text-2xl font-bold mt-6 mb-3',
        h3: 'text-xl font-bold mt-4 mb-2',
    },
    list: {
        ul: 'list-disc list-inside my-2',
        ol: 'list-decimal list-inside my-2',
        listitem: 'ml-4',
    },
    link: 'text-blue-500 hover:underline',
    text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        code: 'bg-gray-100 px-1 py-0.5 rounded font-mono text-sm',
    },
    code: 'bg-gray-100 p-4 rounded-lg font-mono text-sm my-2 block',
};

// HTML 到编辑器的初始化插件
function InitializeEditorPlugin({ html, onChange }: { html: string; onChange?: (html: string) => void }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        if (!html) return;

        editor.update(() => {
            console.log('🔄 InitializeEditorPlugin: Updating editor with content');
            const root = $getRoot();
            root.clear();

            // 如果是纯文本（不包含HTML标签），转换为段落
            if (!html.includes('<') && !html.includes('>')) {
                console.log('📝 InitializeEditorPlugin: Detected plain text, converting to paragraphs');
                // 纯文本：按换行符分割成段落
                const lines = html.split('\n');
                lines.forEach((line) => {
                    if (line.trim()) {
                        const parser = new DOMParser();
                        const dom = parser.parseFromString(`<p>${line}</p>`, 'text/html');
                        const nodes = $generateNodesFromDOM(editor, dom);

                        // 安全地添加节点
                        for (const node of nodes) {
                            try {
                                if (node && typeof node.getType === 'function' && node.getType() !== 'root') {
                                    root.append(node);
                                }
                            } catch (e) {
                                console.warn('Failed to append node:', e);
                            }
                        }
                    }
                });
            } else {
                console.log('<html> InitializeEditorPlugin: Detected HTML, parsing directly');
                // HTML内容：直接解析
                const parser = new DOMParser();
                const dom = parser.parseFromString(html, 'text/html');
                const nodes = $generateNodesFromDOM(editor, dom);

                // 安全地添加节点
                for (const node of nodes) {
                    try {
                        if (node && typeof node.getType === 'function' && node.getType() !== 'root') {
                            root.append(node);
                        }
                    } catch (e) {
                        console.warn('Failed to append node:', e);
                    }
                }
            }
        });

        // Manually trigger onChange to ensure parent state is synced with the formatted HTML
        if (onChange) {
            // We need to wait for the update to be applied to the editor state
            // editor.getEditorState().read() inside a timeout or immediate might work, 
            // but editor.update is synchronous in terms of state update queueing, 
            // but the read might need to happen after.
            // Actually, we can just read it immediately after update in the same cycle if we use editor.getEditorState()
            // BUT, the update callback above runs in a transaction.

            // Let's use a microtask or setTimeout to ensure we read the *updated* state
            setTimeout(() => {
                editor.getEditorState().read(() => {
                    const formattedHtml = $generateHtmlFromNodes(editor);
                    console.log('🔄 InitializeEditorPlugin: Syncing formatted HTML to parent:', formattedHtml.length);
                    onChange(formattedHtml);
                });
            }, 0);
        }

    }, []); // 只在初始化时运行一次

    return null;
}

// 编辑器内容变更处理
function OnChangeHandler({ onChange }: { onChange: (html: string) => void }) {
    const [editor] = useLexicalComposerContext();

    const handleChange = (editorState: EditorState) => {
        editorState.read(() => {
            const html = $generateHtmlFromNodes(editor);
            console.log('⚡ OnChangeHandler: Editor content changed, generating HTML length:', html.length);
            onChange(html);
        });
    };

    return <OnChangePlugin onChange={handleChange} />;
}

export default function LexicalEditor({ value, onChange, placeholder = '输入内容...' }: LexicalEditorProps) {
    const initialConfig = {
        namespace: 'RichTextEditor',
        theme,
        onError: (error: Error) => {
            console.error('Lexical error:', error);
        },
        nodes: [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            CodeNode,
            LinkNode,
            MarkNode,
        ],
    };

    return (
        <LexicalComposer initialConfig={initialConfig}>
            <div className="relative">
                <RichTextPlugin
                    contentEditable={
                        <ContentEditable className="px-0 py-0 outline-none text-base leading-relaxed" />
                    }
                    placeholder={
                        <div className="absolute top-0 left-0 text-gray-400 pointer-events-none select-none">
                            {placeholder}
                        </div>
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <LinkPlugin />
                <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                <FloatingToolbarPlugin />
                <InitializeEditorPlugin html={value} onChange={onChange} />
                <OnChangeHandler onChange={onChange} />
            </div>
        </LexicalComposer>
    );
}
