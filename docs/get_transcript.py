import re
import os
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
import requests

def extract_video_id(url):
    """
    从YouTube链接中提取视频ID
    支持多种YouTube链接格式：
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/v/VIDEO_ID
    """
    # 处理 youtu.be 短链接 - 检查域名是否为 youtu.be
    parsed_url = urlparse(url)
    if parsed_url.hostname == 'youtu.be':
        video_id = url.split('/')[-1]
        # 移除可能的查询参数
        if '?' in video_id:
            video_id = video_id.split('?')[0]
        return video_id

    # 处理 youtube.com 链接
    if parsed_url.hostname in ['www.youtube.com', 'youtube.com']:
        if '/watch' in parsed_url.path:
            # 从查询参数中获取 v 参数
            query_params = parse_qs(parsed_url.query)
            if 'v' in query_params:
                return query_params['v'][0]
        elif '/embed/' in parsed_url.path or '/v/' in parsed_url.path:
            # 从路径中获取视频ID
            return parsed_url.path.split('/')[-1]

    return None

def get_video_title(video_id):
    """
    通过视频ID获取视频标题
    """
    try:
        # 使用YouTube Data API获取视频标题
        # 这里使用简单的网页抓取方法作为备选
        url = f"https://www.youtube.com/watch?v={video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            # 使用正则表达式提取视频标题
            title_match = re.search(r'<title>(.*?)</title>', response.text)
            if title_match:
                title = title_match.group(1)
                # 移除YouTube标题中的" - YouTube"后缀
                title = title.replace(' - YouTube', '')
                # 清理文件名非法字符
                title = re.sub(r'[<>:"/\\|?*]', '_', title)
                return title.strip()

        return f"video_{video_id}"
    except Exception as e:
        print(f"获取视频标题失败: {e}")
        return f"video_{video_id}"

def select_transcript_language(transcript_list, video_id):
    """
    选择字幕语言
    优先级：英文 -> 中文 -> 用户选择其他语言
    """
    print("\n正在分析可用字幕语言...")

    # 获取所有可用字幕
    available_transcripts = list(transcript_list)

    if not available_transcripts:
        print("❌ 未找到任何可用的字幕")
        return None

    print(f"✅ 找到 {len(available_transcripts)} 种可用字幕")

    # 1. 优先尝试英文
    print("1. 尝试获取英文字幕...")
    try:
        english_transcript = transcript_list.find_transcript(['en'])
        print(f"✅ 成功获取英文字幕: {english_transcript.language}")
        return english_transcript
    except Exception as e:
        print(f"   未找到英文字幕: {e}")

    # 2. 尝试中文（多种中文语言代码）
    print("2. 尝试获取中文字幕...")
    chinese_language_codes = ['zh', 'zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant']
    chinese_names = {
        'zh': '中文',
        'zh-CN': '中文 (简体)',
        'zh-TW': '中文 (繁体)',
        'zh-Hans': '中文 (简体)',
        'zh-Hant': '中文 (繁体)'
    }

    for code in chinese_language_codes:
        try:
            chinese_transcript = transcript_list.find_transcript([code])
            chinese_name = chinese_names.get(code, f'中文 ({code})')
            print(f"✅ 成功获取中文字幕: {chinese_name}")
            return chinese_transcript
        except Exception:
            continue

    print("   未找到中文字幕")

    # 3. 如果英文和中文都没有，显示所有可用语言让用户选择
    print("3. 显示所有可用语言供您选择...")
    print("\n可用的字幕语言:")
    for i, transcript in enumerate(available_transcripts, 1):
        generated_text = " (自动生成)" if hasattr(transcript, 'is_generated') and transcript.is_generated else ""
        print(f"  [{i}] {transcript.language} ({transcript.language_code}){generated_text}")

    # 用户选择
    while True:
        try:
            choice = input(f"\n请选择字幕语言 (1-{len(available_transcripts)}) 或输入 'q' 退出: ").strip()

            if choice.lower() == 'q':
                print("❌ 用户取消选择")
                return None

            choice_num = int(choice)
            if 1 <= choice_num <= len(available_transcripts):
                selected_transcript = available_transcripts[choice_num - 1]
                print(f"✅ 已选择: {selected_transcript.language} ({selected_transcript.language_code})")
                return selected_transcript
            else:
                print(f"❌ 无效选择，请输入 1-{len(available_transcripts)} 之间的数字")
        except ValueError:
            print("❌ 无效输入，请输入数字或 'q'")

def save_transcript_to_file(transcript, video_title, video_id):
    """
    将字幕保存到txt文件
    """
    # 确保 transcripts 文件夹存在
    transcripts_dir = "transcripts"
    if not os.path.exists(transcripts_dir):
        os.makedirs(transcripts_dir)
        print(f"创建文件夹: {transcripts_dir}")

    # 创建安全的文件名
    safe_title = video_title[:100]  # 限制文件名长度
    filename = os.path.join(transcripts_dir, f"{safe_title}.txt")

    # 如果文件名已存在，添加序号
    counter = 1
    original_filename = filename
    while os.path.exists(filename):
        filename = os.path.join(transcripts_dir, f"{safe_title}_{counter}.txt")
        counter += 1

    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"YouTube视频字幕\n")
            f.write(f"视频ID: {video_id}\n")
            f.write(f"视频标题: {video_title}\n")
            f.write("=" * 50 + "\n\n")

            for i, snippet in enumerate(transcript, 1):
                start_time = snippet['start']
                duration = snippet['duration']
                end_time = start_time + duration
                text = snippet['text']

                # 格式化时间显示
                start_min, start_sec = divmod(start_time, 60)
                start_hour, start_min = divmod(start_min, 60)

                end_min, end_sec = divmod(end_time, 60)
                end_hour, end_min = divmod(end_min, 60)

                # 确保时间值为整数用于格式化
                start_hour = int(start_hour)
                start_min = int(start_min)
                end_hour = int(end_hour)
                end_min = int(end_min)

                time_format = "{:02d}:{:02d}:{:06.3f}"
                f.write(f"[{i}] {time_format.format(start_hour, start_min, start_sec)} - {time_format.format(end_hour, end_min, end_sec)}\n")
                f.write(f"{text}\n\n")

        print(f"字幕已保存到文件: {filename}")
        return filename
    except Exception as e:
        print(f"保存文件失败: {e}")
        return None

def main():
    """
    主函数：获取YouTube字幕
    """
    print("YouTube字幕获取工具")
    print("=" * 50)

    # 获取用户输入的YouTube链接
    while True:
        url = input("\n请输入YouTube视频链接 (输入'quit'退出): ").strip()

        if url.lower() == 'quit':
            print("程序已退出")
            break

        if not url:
            print("链接不能为空，请重新输入")
            continue

        # 提取视频ID
        video_id = extract_video_id(url)
        if not video_id:
            print("无法从链接中提取视频ID，请检查链接格式是否正确")
            print("支持的链接格式:")
            print("  - https://www.youtube.com/watch?v=VIDEO_ID")
            print("  - https://youtu.be/VIDEO_ID")
            continue

        print(f"提取到的视频ID: {video_id}")

        # 获取视频标题
        print("正在获取视频标题...")
        video_title = get_video_title(video_id)
        print(f"视频标题: {video_title}")

        # 获取字幕
        print("正在获取字幕...")
        try:
            # 初始化 API 客户端
            ytt_api = YouTubeTranscriptApi()

            # 获取可用字幕列表
            print("正在获取可用字幕列表...")
            transcript_list = ytt_api.list(video_id)

            # 使用语言选择功能
            selected_transcript = select_transcript_language(transcript_list, video_id)

            if not selected_transcript:
                print("❌ 无法获取字幕，跳过此视频")
                continue

            # 获取选定语言的字幕内容
            print(f"正在获取 {selected_transcript.language} 字幕...")
            transcript_obj = selected_transcript.fetch()

            if not transcript_obj:
                print("❌ 字幕内容为空")
                continue

            # 将 FetchedTranscript 对象转换为字典列表
            transcript = transcript_obj.to_raw_data()

            print(f"✅ 成功获取到 {len(transcript)} 条 {selected_transcript.language} 字幕")

            # 显示前几句字幕预览
            print("\n字幕预览:")
            for i, snippet in enumerate(transcript[:3]):
                start_time = snippet['start']
                start_min, start_sec = divmod(start_time, 60)
                start_hour, start_min = divmod(start_min, 60)

                # 确保时间值为整数用于格式化
                start_hour = int(start_hour)
                start_min = int(start_min)

                time_format = "{:02d}:{:02d}:{:06.3f}"
                print(f"[{time_format.format(start_hour, start_min, start_sec)}] {snippet['text']}")
            if len(transcript) > 3:
                print(f"... 还有 {len(transcript) - 3} 条字幕")

            # 询问用户是否保存字幕
            save_choice = input("\n是否保存字幕到文件? (y/n): ").strip().lower()
            if save_choice in ['y', 'yes', '是', '']:
                # 在视频标题中包含语言信息
                video_title_with_lang = f"{video_title} [{selected_transcript.language}]"
                filename = save_transcript_to_file(transcript, video_title_with_lang, video_id)

                if filename:
                    # 询问是否显示完整字幕
                    show_choice = input("是否在控制台显示完整字幕? (y/n): ").strip().lower()
                    if show_choice in ['y', 'yes', '是']:
                        print(f"\n完整字幕内容:")
                        print("=" * 50)
                        for snippet in transcript:
                            start_time = snippet['start']
                            start_min, start_sec = divmod(start_time, 60)
                            start_hour, start_min = divmod(start_min, 60)

                            # 确保时间值为整数用于格式化
                            start_hour = int(start_hour)
                            start_min = int(start_min)

                            time_format = "{:02d}:{:02d}:{:06.3f}"
                            print(f"[{time_format.format(start_hour, start_min, start_sec)}] {snippet['text']}")

        except Exception as e:
            print(f"获取字幕失败：{e}")
            print("可能的原因:")
            print("  - 视频没有可用的字幕")
            print("  - 视频是私有视频")
            print("  - 网络连接问题")
            print("  - YouTube API限制")

if __name__ == "__main__":
    main()
