import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

def get_transcript(video_id):
    try:
        # Instantiate the API
        ytt_api = YouTubeTranscriptApi()
        
        # List all available transcripts
        transcript_list = ytt_api.list(video_id)
        
        # Logic adapted from docs/get_transcript.py
        # 1. Try English
        try:
            transcript = transcript_list.find_transcript(['en'])
        except:
            transcript = None
            
        # 2. Try Chinese if English failed
        if not transcript:
            chinese_language_codes = ['zh', 'zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant']
            for code in chinese_language_codes:
                try:
                    transcript = transcript_list.find_transcript([code])
                    break
                except:
                    continue
        
        # 3. Fallback to any available if specific languages failed
        if not transcript:
             try:
                # Just take the first one available
                transcript = next(iter(transcript_list))
             except StopIteration:
                # No transcripts available at all
                print(json.dumps([]))
                return

        # Fetch the actual data
        # Note: fetch() returns a list of dictionaries directly in the newer API versions or via the object
        # The user script uses transcript.fetch().to_raw_data() or similar. 
        # Let's check the user script line 251: transcript_obj = selected_transcript.fetch()
        # And line 258: transcript = transcript_obj.to_raw_data() -- wait, no, fetch() usually returns the list directly.
        # In the user script:
        # transcript_obj = selected_transcript.fetch()
        # ...
        # transcript = transcript_obj.to_raw_data()  <-- This suggests fetch() returns an object that has to_raw_data()??
        # Actually, looking at standard youtube_transcript_api, fetch() returns a list of dicts.
        # But the user script implies otherwise? Let's look closely at user script line 258.
        # "transcript = transcript_obj.to_raw_data()"
        # Wait, if I look at line 251: "transcript_obj = selected_transcript.fetch()"
        # If selected_transcript is a Transcript object, .fetch() returns a list of dicts.
        # List has no attribute to_raw_data().
        # Maybe the user script is using a wrapper or I am misreading.
        # Let's stick to the standard API behavior which returns a list of dicts.
        # Fetch the actual data
        transcript_data = transcript.fetch()
        
        # Convert to the format expected by our frontend/backend
        formatted_transcript = []
        for item in transcript_data:
            # Debug: print type of item
            # print(f"Debug: item type: {type(item)}", file=sys.stderr)
            # print(f"Debug: item content: {item}", file=sys.stderr)
            
            # If item is a dictionary (standard behavior)
            if isinstance(item, dict):
                formatted_transcript.append({
                    'text': item['text'],
                    'offset': item['start'],
                    'duration': item['duration']
                })
            else:
                # If it's an object, try accessing attributes
                formatted_transcript.append({
                    'text': item.text,
                    'offset': item.start,
                    'duration': item.duration
                })
            
        print(json.dumps(formatted_transcript))
        
    except (TranscriptsDisabled, NoTranscriptFound) as e:
        print(f"Debug: No transcript found - {str(e)}", file=sys.stderr)
        print(json.dumps([]))
    except Exception as e:
        print(f"Debug: Unexpected error - {str(e)}", file=sys.stderr)
        print(json.dumps([]))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python get_transcript.py <video_id>", file=sys.stderr)
        sys.exit(1)
    
    video_id = sys.argv[1]
    get_transcript(video_id)
