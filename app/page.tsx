'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('tngtech/deepseek-r1t2-chimera:free');
  const [style, setStyle] = useState('故事模式');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // API Key Modal State
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const router = useRouter();

  const checkApiKey = async () => {
    try {
      const response = await fetch('/api/config');
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

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          model,
          style
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      const videoId = data.metadata.id;
      localStorage.setItem(`project_${videoId}`, JSON.stringify(data));

      router.push(`/edit/${videoId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

        <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 md:p-8 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] focus-within:border-black focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleSubmit}>
            <input
              type="url"
              placeholder="输入启发你的 youtube 链接"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border-none text-base outline-none py-2.5 mb-10 placeholder:text-[#999] text-black bg-transparent"
              autoFocus
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
              {/* Left: Model Selector */}
              <div className="flex items-center">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-auto p-0 border-none shadow-none focus:ring-0 bg-transparent gap-1.5 text-sm text-[#333] hover:text-black data-[state=open]:text-black w-auto">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tngtech/deepseek-r1t2-chimera:free">DeepSeek R1T2 (Free)</SelectItem>
                    <SelectItem value="kwaipilot/kat-coder-pro:free">Kat Coder Pro (Free)</SelectItem>
                    <SelectItem value="z-ai/glm-4.5-air:free">GLM-4.5 Air (Free)</SelectItem>
                    <SelectItem value="tngtech/deepseek-r1t-chimera:free">DeepSeek R1T (Free)</SelectItem>
                    <SelectItem value="qwen/qwen3-coder:free">Qwen 3 Coder (Free)</SelectItem>
                    <SelectItem value="nvidia/nemotron-nano-12b-v2-vl:free">Nemotron Nano 12B (Free)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Right: Style Selector + Button */}
              <div className="flex items-center gap-6">
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="h-auto p-0 border-none shadow-none focus:ring-0 bg-transparent gap-1.5 text-sm text-[#333] hover:text-black data-[state=open]:text-black w-auto">
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
                  className="bg-[#333] text-white border-none py-2.5 px-6 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-black disabled:bg-[#ccc] disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中
                    </>
                  ) : (
                    '去写点'
                  )}
                </button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 text-sm text-red-500 font-medium">
              ⚠️ {error}
            </div>
          )}
        </div>
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
