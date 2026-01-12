'use client';

export const runtime = 'edge';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Play } from 'lucide-react';
import html2canvas from 'html2canvas';
import LexicalEditor from '@/lib/editor/LexicalEditor';
import { getPreviewStyles, detectTextLanguage, getH1FontFamily, processHtmlWithStyles } from '@/lib/styles/previewCardStyles';
import '@/lib/styles/previewCard.css';

interface ProjectData {
    metadata: {
        id: string;
        title: string;
        thumbnailUrl: string;
        author?: string;
    };
    frames: string[];
    transcript?: Array<{
        text: string;
        offset: number;
        duration: number;
    }>;
    generated: {
        title: string;
        content: string;
        tags: string[];
    };
}

export default function EditPage() {
    const params = useParams();
    const router = useRouter();
    const [project, setProject] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Editor State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Preview State (Manual Refresh)
    const [previewData, setPreviewData] = useState({ title: '', content: '' });
    const [currentPage, setCurrentPage] = useState(1);
    // totalPages removed (calculated dynamically below)

    // Video Player State
    const [currentTime, setCurrentTime] = useState(0);
    const playerRef = useRef<any>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const previewCardRef = useRef<HTMLDivElement>(null);

    // 响应式排版状态
    const [cardWidth, setCardWidth] = useState(540); // 默认540px

    // Auto-resize title textarea
    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
    }, [title]);

    useEffect(() => {
        const loadProject = () => {
            try {
                const savedData = localStorage.getItem(`project_${params.id}`);
                if (!savedData) {
                    throw new Error('Project not found');
                }
                const data = JSON.parse(savedData);
                setProject(data);

                // Initialize editor state
                setTitle(data.generated?.title || '');
                setContent(data.generated?.content || '');

                // Note: previewData will be updated via the useEffect below
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [params.id]);

    // Real-time preview sync: Update previewData whenever title or content changes
    useEffect(() => {
        setPreviewData({
            title,
            content
        });
    }, [title, content]);

    // 测量预览卡片宽度以实现响应式排版
    useEffect(() => {
        // 使用 setTimeout 确保 DOM 已完全渲染
        const timer = setTimeout(() => {
            console.log('🔍 Checking preview card ref...', !!previewCardRef.current);

            if (!previewCardRef.current) {
                console.warn('⚠️ Preview card ref is null!');
                return;
            }

            // 立即测量一次初始宽度
            const initialWidth = previewCardRef.current.offsetWidth;
            console.log('📏 Initial card width:', initialWidth, 'px');

            if (initialWidth > 0) {
                setCardWidth(initialWidth);
            }

            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    // ✅ 使用 offsetWidth（包括 padding），而不是 contentRect.width
                    const newWidth = (entry.target as HTMLElement).offsetWidth;
                    console.log('📐 Card width changed:', newWidth, 'px (offsetWidth) | Browser:', window.innerWidth, 'px');
                    setCardWidth(newWidth);
                }
            });

            resizeObserver.observe(previewCardRef.current);

            // 额外监听窗口大小变化
            const handleWindowResize = () => {
                if (previewCardRef.current) {
                    const actualWidth = previewCardRef.current.offsetWidth;
                    console.log('🪟 Window resized | Card:', actualWidth, 'px | Browser:', window.innerWidth, 'px');
                }
            };

            window.addEventListener('resize', handleWindowResize);

            return () => {
                resizeObserver.disconnect();
                window.removeEventListener('resize', handleWindowResize);
            };
        }, 100); // 延迟 100ms 确保 DOM 渲染完成

        return () => {
            clearTimeout(timer);
        };
    }, [previewCardRef]); // 添加 previewCardRef 到依赖

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const seekTo = (seconds: number) => {
        // In a real implementation, this would control the YouTube player
        setCurrentTime(seconds);
        console.log('Seeking to:', seconds);
    };

    // Pagination state
    const [pages, setPages] = useState<string[]>([]);
    const [isPaginating, setIsPaginating] = useState(false);
    const totalPages = pages.length > 0 ? pages.length : 1;

    // Import pagination helper
    const { paginateContent } = require('@/lib/utils/PaginationHelper');

    // Pagination effect
    useEffect(() => {
        const calculatePages = async () => {
            if (!cardWidth || !previewData.content) {
                setPages([previewData.content || '']);
                return;
            }

            setIsPaginating(true);

            try {
                const scale = cardWidth / 540;
                const totalHeight = cardWidth * (5 / 3);
                const padding = 48 * scale;
                const footerHeight = 30 * scale;
                const safetyBuffer = 20 * scale; // Buffer to prevent truncation
                const availableHeight = totalHeight - (padding * 2) - footerHeight - safetyBuffer;

                // Title height calculation (Dynamic measurement)
                const measureH1 = document.createElement('h1');
                const titleLang = detectTextLanguage(previewData.title || '');
                // Apply same styles as preview/export
                Object.assign(measureH1.style, {
                    visibility: 'hidden',
                    position: 'absolute',
                    width: `${cardWidth - (padding * 2)}px`, // Content width
                    fontSize: `${38 * scale}px`,
                    fontWeight: '700',
                    lineHeight: '1.25',
                    letterSpacing: '-0.03em',
                    marginBottom: `${40 * scale}px`,
                    fontFamily: getH1FontFamily(titleLang),
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    margin: '0',
                    padding: '0'
                });
                measureH1.textContent = previewData.title || '标题预览';
                document.body.appendChild(measureH1);

                // Height = offsetHeight + marginBottom
                const measuredTitleHeight = measureH1.offsetHeight + (40 * scale);
                document.body.removeChild(measureH1);

                const titleHeight = measuredTitleHeight;

                const result = await paginateContent({
                    content: previewData.content,
                    cardWidth: cardWidth,
                    contentWidth: cardWidth - (padding * 2),
                    titleHeight: titleHeight,
                    contentHeight: availableHeight
                });

                setPages(result.length > 0 ? result : ['']);
            } catch (error) {
                console.error('Pagination failed:', error);
                setPages([previewData.content]);
            } finally {
                setIsPaginating(false);
            }
        };

        // Debounce pagination
        const timer = setTimeout(calculatePages, 500);
        return () => clearTimeout(timer);
    }, [previewData.content, cardWidth, previewData.title]);

    // Ensure current page is valid
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    const handleExportSingle = async (pageIndex?: number) => {
        if (!previewCardRef.current) return;

        try {
            // Use passed pageIndex or current state
            const targetPage = pageIndex !== undefined ? pageIndex : currentPage;

            // 导出宽度为1080px (2x)
            const exportWidth = 1080;
            const scale = exportWidth / 540;

            // Get standardized styles
            const styles = getPreviewStyles(exportWidth);

            // Clone the card element
            const originalCard = previewCardRef.current;
            const clone = originalCard.cloneNode(true) as HTMLElement;

            // 移除所有class属性
            clone.removeAttribute('class');

            // Apply export styles to container
            clone.style.cssText = `
                background-color: #ffffff !important;
                width: ${exportWidth}px !important;
                aspect-ratio: 3/5 !important;
                padding: ${48 * scale}px !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                position: relative !important;
                box-sizing: border-box !important;
                margin: 0 !important;
            `;

            // 清除所有子元素的class
            const allElements = clone.querySelectorAll('*');
            allElements.forEach(el => {
                el.removeAttribute('class');
            });

            // Style title (h1)
            const title = clone.querySelector('h1');
            if (title) {
                // Only show title on first page
                if (targetPage === 1) {
                    const titleLang = detectTextLanguage(previewData.title || '');
                    Object.assign(title.style, {
                        ...styles.h1,
                        fontFamily: getH1FontFamily(titleLang),
                        color: '#000000',
                        display: 'block',
                        background: 'none',
                        border: 'none',
                        padding: '0',
                        marginTop: '0'
                    });
                } else {
                    // Hide title on other pages
                    (title as HTMLElement).style.display = 'none';
                }
            }

            // Style content container
            const contentContainer = clone.querySelector('.preview-content, [class*="preview"]') || clone.children[0];
            if (contentContainer) {
                (contentContainer as HTMLElement).removeAttribute('class');
                (contentContainer as HTMLElement).style.cssText = `
                    flex: 1 !important;
                    overflow: hidden !important;
                    padding: 0 !important;
                    margin: 0 !important;
                `;
            }

            // Style content div
            let contentDiv: HTMLElement | null = null;
            const titleElement = clone.querySelector('h1');
            if (titleElement && titleElement.nextElementSibling) {
                contentDiv = titleElement.nextElementSibling as HTMLElement;
            } else if (contentContainer) {
                const divs = contentContainer.querySelectorAll('div');
                if (divs.length > 0) {
                    contentDiv = divs[0] as HTMLElement;
                }
            }

            if (contentDiv && contentDiv.tagName === 'DIV') {
                contentDiv.removeAttribute('class');
                contentDiv.style.cssText = `
                    font-size: ${styles.p.fontSize} !important;
                    line-height: ${styles.p.lineHeight} !important;
                    color: ${styles.p.color} !important;
                    background: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                `;

                // Apply styles to all HTML elements inside content
                const elements = contentDiv.querySelectorAll('*');
                elements.forEach((el) => {
                    const tag = el.tagName.toLowerCase();
                    const htmlEl = el as HTMLElement;

                    htmlEl.removeAttribute('class');

                    // Special handling for mark tags: preserve background
                    if (tag !== 'mark') {
                        htmlEl.style.background = 'none';
                    }

                    htmlEl.style.border = 'none';
                    htmlEl.style.margin = '0';
                    htmlEl.style.padding = '0';

                    // Apply styles from centralized config
                    if (tag === 'p') {
                        Object.assign(htmlEl.style, styles.p);
                    } else if (tag === 'h2') {
                        Object.assign(htmlEl.style, styles.h2);
                    } else if (tag === 'h3') {
                        Object.assign(htmlEl.style, styles.h3);
                    } else if (tag === 'ul') {
                        Object.assign(htmlEl.style, styles.ul);
                    } else if (tag === 'ol') {
                        Object.assign(htmlEl.style, styles.ol);
                    } else if (tag === 'li') {
                        Object.assign(htmlEl.style, styles.li);
                    } else if (tag === 'a') {
                        Object.assign(htmlEl.style, styles.a);
                    } else if (tag === 'code') {
                        Object.assign(htmlEl.style, styles.code);
                    } else if (tag === 'mark') {
                        Object.assign(htmlEl.style, styles.mark);
                        // Explicitly enforce background color for mark
                        htmlEl.style.backgroundColor = styles.mark.backgroundColor || '#fff59d';
                    } else if (tag === 'blockquote') {
                        Object.assign(htmlEl.style, styles.blockquote);
                    }
                });
            }

            // Style page number
            const allDivs = clone.querySelectorAll('div');
            const pageNum = allDivs[allDivs.length - 1];
            if (pageNum) {
                pageNum.removeAttribute('class');
                Object.assign(pageNum.style, {
                    ...styles.pageNumber,
                    textAlign: 'right',
                    marginTop: 'auto',
                    background: 'none',
                    border: 'none',
                    display: 'block' // Ensure visibility
                });
            }

            // --- Iframe Isolation Strategy ---
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 0; height: 0; border: 0;';
            document.body.appendChild(iframe);

            // Wait for iframe to load
            await new Promise(resolve => setTimeout(resolve, 100));

            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) {
                throw new Error('Could not access iframe document');
            }

            // Write clean HTML structure
            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        /* Reset styles */
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { margin: 0; padding: 0; background: white; font-family: sans-serif; }
                    </style>
                    <!-- Google Fonts -->
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                </head>
                <body></body>
                </html>
            `);
            doc.close();

            // Wait for fonts to load (simple delay)
            await new Promise(resolve => setTimeout(resolve, 500));

            // Append clone to iframe body
            doc.body.appendChild(clone);

            // Capture using html2canvas ON THE IFRAME BODY
            const canvas = await html2canvas(doc.body, {
                scale: 1, // Already scaled via CSS
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                allowTaint: true,
                width: exportWidth,
                height: exportWidth * (5 / 3), // 3:5 aspect ratio
                windowWidth: exportWidth,
                windowHeight: exportWidth * (5 / 3),
            });

            // Clean up
            document.body.removeChild(iframe);

            const link = document.createElement('a');
            link.download = `${previewData.title || 'preview'}_page_${targetPage}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            console.log('✅ Export successful via iframe isolation!');
        } catch (error) {
            console.error('❌ Export failed:', error);
            alert('导出失败：' + (error as Error).message);
        }
    };

    const handleExportAll = async () => {
        // 导出所有页面
        for (let i = 1; i <= totalPages; i++) {
            try {
                // 切换到该页
                setCurrentPage(i);
                // 等待渲染
                await new Promise(resolve => setTimeout(resolve, 500));
                // 导出，传入当前页码
                await handleExportSingle(i);
                // 小延迟避免浏览器阻止多次下载
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`Export page ${i} failed:`, error);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
                    <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
                    <Link href="/" className="text-blue-600 hover:underline">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col h-screen overflow-hidden font-sans text-gray-900">
            {/* Header */}
            <header className="h-[60px] px-6 flex items-center shrink-0 bg-[#FAFAFA]">
                <Link href="/" className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors gap-1.5 -ml-3 px-3 py-2 rounded-md hover:bg-black/5">
                    <ChevronLeft className="w-4 h-4" />
                    返回首页
                </Link>
            </header>

            {/* Main Layout */}
            <main className="flex-1 flex px-6 pb-6 gap-5 overflow-hidden">

                {/* Left Column: Source (28%) */}
                <div className="w-[28%] flex flex-col bg-white border border-[#E5E5E5] rounded-xl shadow-sm overflow-hidden">
                    {/* Video Section */}
                    <div className="p-4 border-b border-[#E5E5E5] bg-[#F9FAFB]">
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden relative group cursor-pointer">
                            <iframe
                                src={`https://www.youtube.com/embed/${project.metadata.id}`}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>

                    {/* Transcript Section */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#E5E5E5] flex justify-between items-center bg-white">
                            <span className="font-semibold text-sm text-gray-900">视频字幕</span>
                            <span className="text-xs text-gray-400 font-normal">自动滚动</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0">
                            {project.transcript?.map((item, index) => (
                                <div
                                    key={index}
                                    onClick={() => seekTo(item.offset)}
                                    className={`px-4 py-2.5 text-[13px] leading-relaxed cursor-pointer border-l-[3px] transition-colors hover:bg-gray-50 ${currentTime >= item.offset && currentTime < (item.offset + item.duration)
                                        ? 'bg-gray-50 border-black text-gray-900'
                                        : 'border-transparent text-gray-500'
                                        }`}
                                >
                                    <span className="inline-block w-12 font-mono text-[11px] text-gray-400 font-medium mr-2">
                                        {formatTime(item.offset)}
                                    </span>
                                    {item.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Middle Column: Editor (40%) */}
                <div className="w-[40%] flex flex-col bg-white border border-[#E5E5E5] rounded-xl shadow-sm overflow-hidden relative">
                    {/* Toolbar */}
                    <div className="px-5 py-3 border-b border-[#E5E5E5] flex justify-end items-center bg-white shrink-0">
                        <span className="text-xs text-gray-400 font-medium">实时预览</span>
                    </div>

                    {/* Editor Area - 统一滚动容器 */}
                    <div className="flex-1 overflow-y-auto px-10 py-8">
                        {/* 标题 */}
                        <div className="relative mb-6 flex items-start gap-2">
                            <textarea
                                ref={titleRef}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={30}
                                placeholder="输入标题..."
                                className="flex-1 text-2xl font-bold text-gray-900 placeholder:text-gray-300 border-none outline-none focus:ring-0 focus:outline-none p-0 bg-transparent resize-none leading-tight tracking-tight overflow-hidden"
                                rows={1}
                                style={{ height: 'auto', minHeight: '40px', maxHeight: '80px' }}
                            />
                            <span className="text-xs text-gray-400 font-medium pt-2 shrink-0 select-none">
                                {title.length}/30
                            </span>
                        </div>

                        {/* 正文编辑器 */}
                        <LexicalEditor
                            value={content}
                            onChange={setContent}
                            placeholder="开始写作..."
                        />
                    </div>
                </div>

                {/* Right Column: Preview (32%) */}
                <div className="w-[32%] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h2 className="text-base font-semibold text-gray-900">
                            效果预览
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                                (宽度: {Math.round(cardWidth)}px, 标题: {Math.round(38 * (cardWidth / 540))}px)
                            </span>
                        </h2>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => handleExportSingle()}
                                title="下载当前页面"
                                style={{ cursor: 'pointer' }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium bg-white border border-[#E5E5E5] text-gray-900 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                单页
                            </button>
                            <button
                                onClick={handleExportAll}
                                title="下载全部页面"
                                style={{ cursor: 'pointer' }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium bg-black border border-black text-white rounded-lg hover:opacity-90 transition-all shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                全部导出
                            </button>
                        </div>
                    </div>

                    {/* Preview Card Container */}
                    <div className="flex-1 bg-[#F3F4F6] border border-[#E5E5E5] rounded-xl p-6 flex flex-col items-center justify-center overflow-visible">
                        {/* Card with Navigation Arrows */}
                        <div className="relative group">
                            {/* Phone Card */}
                            <div
                                ref={previewCardRef}
                                className="bg-white w-full max-w-[540px] flex flex-col justify-between shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] rounded-[2px] overflow-hidden relative"
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: `${48 * (cardWidth / 540)}px`,
                                    aspectRatio: '3 / 5',
                                }}
                            >
                                <div className="flex-1 overflow-hidden preview-content">
                                    {currentPage === 1 && (
                                        <h1
                                            className={detectTextLanguage(previewData.title || '')}
                                            style={{
                                                fontSize: `${38 * (cardWidth / 540)}px`,
                                                fontWeight: 700,
                                                lineHeight: 1.25,
                                                letterSpacing: '-0.03em',
                                                marginBottom: `${40 * (cardWidth / 540)}px`,
                                                fontFamily: getH1FontFamily(detectTextLanguage(previewData.title || '')),
                                                color: '#000000',
                                            }}
                                        >
                                            {previewData.title || '标题预览'}
                                        </h1>
                                    )}
                                    <div
                                        style={{
                                            // fontSize: `${20 * (cardWidth / 540)}px`, // Removed: Styles are now inline in the HTML
                                            // lineHeight: 1.7,
                                            // color: '#333333',
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: processHtmlWithStyles(
                                                (pages.length > 0 ? pages[currentPage - 1] : previewData.content) || '<p>内容预览...</p>',
                                                cardWidth
                                            )
                                        }}
                                    />
                                </div>
                                <div
                                    className="text-right mt-auto"
                                    style={{
                                        fontSize: `${14 * (cardWidth / 540)}px`,
                                        fontWeight: 300,
                                        color: '#9CA3AF',
                                        paddingTop: `${3 * (cardWidth / 540)}px`,
                                    }}
                                >
                                    {currentPage} / {totalPages}
                                </div>
                            </div>

                            {/* Left Arrow - Show on hover */}
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`absolute left-[10px] top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center transition-all duration-300 ${currentPage === 1
                                    ? 'opacity-0 cursor-not-allowed'
                                    : 'opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-white hover:scale-110'
                                    }`}
                                style={{ border: '1px solid rgba(0,0,0,0.1)', width: '30px', height: '30px' }}
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-700" />
                            </button>

                            {/* Right Arrow - Show on hover */}
                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`absolute right-[10px] top-1/2 -translate-y-1/2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center transition-all duration-300 ${currentPage === totalPages
                                    ? 'opacity-0 cursor-not-allowed'
                                    : 'opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-white hover:scale-110'
                                    }`}
                                style={{ border: '1px solid rgba(0,0,0,0.1)', width: '30px', height: '30px' }}
                            >
                                <ChevronRight className="w-4 h-4 text-gray-700" />
                            </button>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
