/**
 * Transcript Provider Interface
 * 
 * 定义字幕提供者的抽象接口，所有字幕服务必须实现此接口
 * 这样可以轻松替换不同的字幕获取服务（YouTube, Vimeo, Bilibili 等）
 */

export interface TranscriptItem {
    text: string;
    duration: number;
    offset: number;
}

export interface VideoMetadata {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    duration: number;
}

export interface TranscriptProvider {
    /**
     * 验证视频 URL 是否有效
     * @param url 视频 URL
     * @returns 是否有效
     */
    validateUrl(url: string): boolean;

    /**
     * 从 URL 提取视频 ID
     * @param url 视频 URL
     * @returns 视频 ID，如果无法提取则返回 null
     */
    extractVideoId(url: string): string | null;

    /**
     * 获取视频字幕
     * @param videoId 视频 ID
     * @returns 字幕数组
     * @throws 如果视频不存在、字幕不可用等情况
     */
    getTranscript(videoId: string): Promise<TranscriptItem[]>;

    /**
     * 获取视频元数据
     * @param videoId 视频 ID
     * @returns 视频元数据
     * @throws 如果视频不存在等情况
     */
    getMetadata(videoId: string): Promise<VideoMetadata>;
}
