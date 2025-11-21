'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, FileText, Play, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';

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
    const totalPages = 12; // Mock total pages for now

    // Video Player State
    const [currentTime, setCurrentTime] = useState(0);
    const playerRef = useRef<any>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const previewCardRef = useRef<HTMLDivElement>(null);

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

                // Initialize preview state
                setPreviewData({
                    title: data.generated?.title || '',
                    content: data.generated?.content || ''
                });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [params.id]);

    const handlePreview = () => {
        setPreviewData({
            title,
            content
        });
    };

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

    const handleExportSingle = async () => {
        if (!previewCardRef.current) return;

        try {
            // Clone the card element to avoid affecting the displayed one
            const originalCard = previewCardRef.current;
            const clone = originalCard.cloneNode(true) as HTMLElement;

            // Remove all Tailwind classes and apply only inline styles
            clone.style.cssText = `
                background-color: #ffffff;
                width: 540px;
                aspect-ratio: 3/4;
                padding: 48px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                border-radius: 2px;
                position: relative;
            `;

            // Style all child elements
            const title = clone.querySelector('h2');
            if (title) {
                (title as HTMLElement).style.cssText = `
                    font-size: 44px;
                    font-weight: 800;
                    line-height: 1.25;
                    letter-spacing: -0.03em;
                    margin-bottom: 40px;
                    color: #000000;
                    word-wrap: break-word;
                `;
            }

            const content = clone.querySelectorAll('div')[1];
            if (content) {
                (content as HTMLElement).style.cssText = `
                    font-size: 25px;
                    line-height: 1.7;
                    color: #1F2937;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                `;
            }

            const pageNum = clone.querySelectorAll('div')[2];
            if (pageNum) {
                (pageNum as HTMLElement).style.cssText = `
                    text-align: right;
                    font-size: 18px;
                    font-weight: 500;
                    color: #9CA3AF;
                    margin-top: auto;
                    padding-top: 24px;
                `;
            }

            // Create a temporary container
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'position: absolute; left: -9999px; top: 0;';
            tempContainer.appendChild(clone);
            document.body.appendChild(tempContainer);

            // Capture at 2x scale for 1080px width
            const canvas = await html2canvas(clone, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            });

            // Clean up
            document.body.removeChild(tempContainer);

            const link = document.createElement('a');
            link.download = `${previewData.title || 'preview'}_page_${currentPage}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
            alert('导出失败，请查看控制台了解详情');
        }
    };

    const handleExportAll = async () => {
        if (!previewCardRef.current) return;

        try {
            // For now, export all pages with the same content
            // TODO: Implement content pagination logic
            for (let i = 1; i <= totalPages; i++) {
                const canvas = await html2canvas(previewCardRef.current, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false,
                });

                const link = document.createElement('a');
                link.download = `${previewData.title || 'preview'}_page_${i}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();

                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (error) {
            console.error('Export all failed:', error);
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
                        <button
                            onClick={handlePreview}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            预览
                        </button>
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 overflow-y-auto px-10 py-8">
                        <div className="max-w-none">
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

                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="开始写作..."
                                className="w-full text-[15px] leading-relaxed text-gray-700 placeholder:text-gray-300 border-none outline-none focus:ring-0 focus:outline-none p-0 bg-transparent resize-none h-[calc(100vh-300px)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview (32%) */}
                <div className="w-[32%] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h2 className="text-base font-semibold text-gray-900">效果预览</h2>
                        <div className="flex gap-2.5">
                            <button onClick={handleExportSingle} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium bg-white border border-[#E5E5E5] text-gray-900 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
                                <FileText className="w-3.5 h-3.5" />
                                单页
                            </button>
                            <button onClick={handleExportAll} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium bg-black border border-black text-white rounded-lg hover:opacity-90 transition-all shadow-sm">
                                <Download className="w-3.5 h-3.5" />
                                全部导出
                            </button>
                        </div>
                    </div>

                    {/* Preview Card Container */}
                    <div className="flex-1 bg-[#F3F4F6] border border-[#E5E5E5] rounded-xl p-6 flex flex-col items-center justify-center overflow-hidden">
                        {/* Phone Card */}
                        <div
                            ref={previewCardRef}
                            className="bg-white w-full max-w-[540px] aspect-[3/4] p-12 flex flex-col justify-between shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] rounded-[2px] overflow-hidden relative"
                            style={{
                                backgroundColor: '#ffffff',
                                color: '#1F2937'
                            }}
                        >
                            <div className="flex-1 overflow-hidden">
                                <h2
                                    className="text-[44px] font-extrabold leading-[1.25] tracking-tight mb-10 break-words"
                                    style={{ color: '#000000' }}
                                >
                                    {previewData.title || '标题预览'}
                                </h2>
                                <div
                                    className="text-[25px] leading-[1.7] whitespace-pre-wrap break-words line-clamp-[12]"
                                    style={{ color: '#1F2937' }}
                                >
                                    {previewData.content || '内容预览...'}
                                </div>
                            </div>
                            <div
                                className="text-right text-[18px] font-medium mt-auto pt-6"
                                style={{ color: '#9CA3AF' }}
                            >
                                {currentPage} / {totalPages}
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center gap-4 mt-5">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                className="w-9 h-9 rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[13px] font-medium text-gray-500">
                                第 {currentPage} 页
                            </span>
                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                className="w-9 h-9 rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
