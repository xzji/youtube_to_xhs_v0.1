'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown, Clock } from 'lucide-react';
import { youtubeClientProvider } from '@/lib/services/youtube-client-provider';
import type { TranscriptItem, VideoMetadata } from '@/lib/services/transcript-provider';
import { AI_MODELS, DEFAULT_MODEL } from '@/lib/constants/models';
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/utils/fetch-with-timeout';

const CONFIG_TIMEOUT_MS = 8000;
const PROCESS_TIMEOUT_MS = 90000;
const MODEL_STORAGE_KEY = 'youtube2xhs_model';

export default function Home() {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [style, setStyle] = useState('故事模式');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');

  // History State
  interface HistoryItem {
    id: string;
    title: string;
    thumbnailUrl: string;
    updatedAt: number;
  }
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // Restore user's last selected model (if still available).
    try {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored && AI_MODELS.some((m) => m.id === stored)) {
        setModel(stored);
      }
    } catch (err) {
      console.error('Failed to restore model selection', err);
    }

    try {
      const items: HistoryItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('project_')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const data = JSON.parse(raw);
              items.push({
                id: data.metadata?.id || key.replace('project_', ''),
                title: data.generated?.title || data.metadata?.title || '未命名项目',
                thumbnailUrl: data.metadata?.thumbnailUrl || '',
                // Fallback to a default time if no updatedAt was saved before
                updatedAt: data.updatedAt || Date.now() - (Math.random() * 100000) 
              });
            }
          } catch (e) {
            console.error('Failed to parse history item', e);
          }
        }
      }
      // Sort by latest and take top 4
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      setHistory(items.slice(0, 4));
    } catch (err) {
      console.error('Failed to load history', err);
    }
  }, []);

  // API Key Modal State
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const router = useRouter();

  const formatProcessError = (data: any) => {
    const messages = [
      typeof data?.error === 'string' ? data.error.trim() : '',
      typeof data?.transcriptError === 'string' && data.transcriptError.trim() !== data?.error?.trim()
        ? `排查信息：${data.transcriptError.trim()}`
        : '',
    ].filter(Boolean);

    return messages.join('\n') || '处理失败，请重试';
  };

  const checkApiKey = async () => {
    try {
      const response = await fetchWithTimeout('/api/config', undefined, CONFIG_TIMEOUT_MS);
      const data = await response.json();
      return data.hasApiKey;
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('请输入有效的 API Key');
      return false;
    }

    setSavingApiKey(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }

      setShowApiKeyModal(false);
      setError('');
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Check if API key exists
    const hasKey = await checkApiKey();
    if (!hasKey) {
      setShowApiKeyModal(true);
      setError('请先配置 OpenRouter API Key 才能开始创作');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingMessage('正在验证链接...');

    try {
      // 1. 验证 URL 并提取视频 ID
      if (!youtubeClientProvider.validateUrl(url)) {
        throw new Error('请输入有效的 YouTube 链接');
      }

      const videoId = youtubeClientProvider.extractVideoId(url);
      if (!videoId) {
        throw new Error('无法从 URL 中提取视频 ID');
      }

      // 2. 在客户端获取字幕和元数据 - 使用用户真实 IP
      setLoadingMessage('正在获取字幕...');
      let transcript: TranscriptItem[];
      let metadata: VideoMetadata;

      try {
        [transcript, metadata] = await Promise.all([
          youtubeClientProvider.getTranscript(videoId),
          youtubeClientProvider.getMetadata(videoId)
        ]);
      } catch (transcriptError: any) {
        // Fallback to server-side fetching
        console.warn('Client-side transcript fetch failed, falling back to server:', transcriptError);
        // Clear variables to ensure server-side fetch is triggered
        transcript = undefined as any;
        metadata = undefined as any;
        // Don't return error, let it proceed to API call
      }

      if (transcript) {
        console.log(`Successfully fetched ${transcript.length} transcript items`);
      }

      // 3. 发送到后端进行 AI 内容生成
      setLoadingMessage('正在生成内容...');
      const response = await fetchWithTimeout('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          model,
          style,
          // 传递客户端获取的字幕和元数据
          transcript,
          metadata
        }),
      }, PROCESS_TIMEOUT_MS);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(formatProcessError(data));
      }

      // 4. 保存到本地存储并跳转
      const projectData = {
        ...data,
        updatedAt: Date.now(),
      };
      localStorage.setItem(`project_${videoId}`, JSON.stringify(projectData));
      router.push(`/edit/${videoId}`);

    } catch (err: any) {
      console.error('Error:', err);
      if (err instanceof FetchTimeoutError) {
        setError(`处理超时（>${Math.ceil(err.timeoutMs / 1000)}s）。当前模型响应较慢，请重试或切换到更快的模型。`);
      } else {
        setError(err.message || '发生未知错误，请重试');
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleApiKeySubmit = async () => {
    const saved = await saveApiKey();
    if (saved) {
      // Retry the original submission
      handleSubmit(new Event('submit') as any);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#FAFAFA] text-black font-sans">
      <div className="w-full max-w-[800px]">
        <h1 className="text-[42px] font-semibold mb-8 tracking-tight text-black">
          你想写点什么
        </h1>

        <div className="bg-white border border-[#E5E5E5] rounded-xl pt-6 pr-6 pb-3 pl-6 md:pt-8 md:pr-8 md:pb-4 md:pl-8 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] focus-within:border-black focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleSubmit} noValidate>
            <input
              type="text"
              placeholder="输入启发你的 youtube 链接"
              value={url || ''}
              onChange={(e) => {
                setUrl(e.target.value || '');
                if (error) setError(''); // Clear error when user modifies input
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  // Clear the input instead of browser default behavior
                  setUrl('');
                  e.currentTarget.blur();
                }
              }}
              className="w-full border-none text-base outline-none py-2.5 placeholder:text-[#999] text-black bg-transparent"
              autoFocus
            />

            {/* Reserve enough room for multi-line diagnostics */}
            <div className="min-h-[2.5rem] whitespace-pre-line text-sm leading-5 text-red-500 font-medium">
              {error}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
              {/* Left: Model Selector */}
              <div className="flex items-center">
                <Select
                  value={model}
                  onValueChange={(nextModel) => {
                    setModel(nextModel);
                    try {
                      localStorage.setItem(MODEL_STORAGE_KEY, nextModel);
                    } catch (err) {
                      console.error('Failed to persist model selection', err);
                    }
                  }}
                >
                  <SelectTrigger className="h-auto p-0 !border-none !shadow-none focus:ring-0 focus-visible:!ring-0 focus-visible:!border-none bg-transparent gap-1.5 text-sm text-[#333] hover:text-black data-[state=open]:text-black w-auto cursor-pointer">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.isFree ? '(Free)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right: Style Selector + Button */}
              <div className="flex items-center gap-6">
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="h-auto p-0 !border-none !shadow-none focus:ring-0 focus-visible:!ring-0 focus-visible:!border-none bg-transparent gap-1.5 text-sm text-[#333] hover:text-black data-[state=open]:text-black w-auto cursor-pointer">
                    <SelectValue placeholder="选择方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="故事模式">故事模式</SelectItem>
                    <SelectItem value="观点模式">观点模式</SelectItem>
                  </SelectContent>
                </Select>

                <button
                  type="submit"
                  disabled={loading || !url}
                  style={{ cursor: loading || !url ? 'not-allowed' : 'pointer' }}
                  className="bg-[#333] text-white border-none py-[6px] px-6 rounded-md text-sm font-medium transition-colors hover:bg-black disabled:bg-[#ccc] flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {loadingMessage || '处理中...'}
                    </>
                  ) : (
                    '去写点'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-medium text-gray-500">最近生成</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/edit/${item.id}`)}
                  className="bg-white border border-[#E5E5E5] rounded-xl p-3 cursor-pointer hover:border-black hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all flex items-center gap-3 group"
                >
                  {item.thumbnailUrl ? (
                    <div className="relative w-[72px] h-[40px] rounded-md overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-[10px] absolute z-0">无图</span>
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 relative z-10" 
                        onError={(e) => {
                          e.currentTarget.style.opacity = '0';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-[72px] h-[40px] bg-gray-100 rounded-md shrink-0 flex items-center justify-center">
                      <span className="text-gray-400 text-[10px]">无图</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-[13px] font-medium text-gray-900 truncate leading-tight group-hover:text-black transition-colors">{item.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-1 truncate">
                      {new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">配置 OpenRouter API Key</h2>
            <p className="text-sm text-gray-600">
              首次使用需要配置 API Key。请访问{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                OpenRouter
              </a>
              {' '}获取您的 API Key。
            </p>

            <div className="space-y-2">
              <label htmlFor="apikey" className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <input
                id="apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  setApiKey('');
                  setError('');
                }}
                disabled={savingApiKey}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleApiKeySubmit}
                disabled={savingApiKey || !apiKey.trim()}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {savingApiKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中
                  </>
                ) : (
                  '保存并继续'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
