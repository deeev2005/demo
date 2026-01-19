"""
TruthScan AI Video Detector - Direct API Integration
Sends video directly to TruthScan API without frame extraction
"""

import requests
import json
import sys
import os
import subprocess
import time
import random
from pathlib import Path
from requests_toolbelt.multipart.encoder import MultipartEncoder


class TruthScanVideoAPI:
    """
    Direct API integration with TruthScan for video detection
    """
    
    def __init__(self):
        self.base_url = "https://truthscan.com/api"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://truthscan.com',
            'Referer': 'https://truthscan.com/ai-video-detector',
            'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Gpc': '1'
        })
    
    def get_video_duration(self, video_path):
        """
        Get actual video duration using ffprobe
        
        Args:
            video_path (str): Path to the video file
            
        Returns:
            int: Duration in seconds (rounded up)
        """
        try:
            # Try using ffprobe to get accurate duration
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and result.stdout.strip():
                duration = float(result.stdout.strip())
                rounded_duration = max(1, int(round(duration)))
                print(f"DEBUG: FFprobe detected duration: {duration:.2f}s (rounded to {rounded_duration}s)", file=sys.stderr)
                return rounded_duration
            else:
                print(f"DEBUG: ffprobe failed, using file size estimation", file=sys.stderr)
                raise Exception("ffprobe unavailable")
                
        except Exception as e:
            # Fallback to file size estimation if ffprobe fails
            print(f"DEBUG: Using file size estimation (ffprobe error: {e})", file=sys.stderr)
            file_size = os.path.getsize(video_path)
            # Rough estimate: assume ~1MB per second for typical video
            estimated_duration = max(1, int(file_size / (1024 * 1024)))
            print(f"DEBUG: Estimated duration from file size: {estimated_duration}s", file=sys.stderr)
            return estimated_duration
    
    def check_video(self, video_path):
        """
        Analyze a video for AI generation using direct API calls
        
        Args:
            video_path (str): Path to the video file
            
        Returns:
            dict: Complete analysis results matching expected format
        """
        if not Path(video_path).exists():
            return {
                "success": False,
                "error": f"Video not found: {video_path}"
            }
        
        try:
            # Get accurate video duration using ffprobe
            duration = self.get_video_duration(video_path)
            
            # Add initial delay before upload - WITH RANDOMIZATION
            time.sleep(1 + random.uniform(0.5, 1.5))
            
            print(f"DEBUG: Uploading video {video_path}", file=sys.stderr)
            
            # Step 1: Upload and detect video in one API call
            detection_result = self._ai_detect_video(video_path, duration)
            
            if not detection_result.get('score') and detection_result.get('error'):
                print(f"DEBUG: Detection failed: {detection_result}", file=sys.stderr)
                return {
                    "success": False,
                    "error": f"Video detection failed: {detection_result.get('error', 'Unknown error')}"
                }
            
            print(f"DEBUG: Detection successful", file=sys.stderr)
            
            # Format the response to match expected structure
            return self._format_results(detection_result)
            
        except Exception as e:
            print(f"DEBUG: Exception: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": str(e)
            }
    
    def _ai_detect_video(self, video_path, duration):
        """
        Send video to TruthScan API for AI detection
        """
        url = f"{self.base_url}/ai-detect-video"
        
        try:
            file_name = Path(video_path).name
            file_ext = Path(video_path).suffix.lower()
            
            # Determine MIME type
            if file_ext == '.mp4':
                mime_type = 'video/mp4'
            elif file_ext == '.mov':
                mime_type = 'video/quicktime'
            elif file_ext == '.avi':
                mime_type = 'video/x-msvideo'
            elif file_ext == '.webm':
                mime_type = 'video/webm'
            else:
                mime_type = 'video/mp4'  # Default fallback
            
            print(f"DEBUG: Uploading {file_name} as {mime_type}, duration: {duration}s", file=sys.stderr)
            
            # Try with requests_toolbelt for better multipart handling
            try:
                with open(video_path, 'rb') as f:
                    multipart_data = MultipartEncoder(
                        fields={
                            'video': (file_name, f, mime_type),
                            'fileName': file_name,
                            'fileType': mime_type,
                            'duration': str(duration)
                        }
                    )
                    
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.8',
                        'Origin': 'https://truthscan.com',
                        'Referer': 'https://truthscan.com/ai-video-detector',
                        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Gpc': '1',
                        'Content-Type': multipart_data.content_type
                    }
                    
                    response = requests.post(
                        url,
                        data=multipart_data,
                        headers=headers,
                        timeout=120  # Longer timeout for video uploads
                    )
            except ImportError:
                # Fallback to standard requests if requests_toolbelt not available
                with open(video_path, 'rb') as f:
                    files = {
                        'video': (file_name, f, mime_type)
                    }
                    data = {
                        'fileName': file_name,
                        'fileType': mime_type,
                        'duration': str(duration)
                    }
                    
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.8',
                        'Origin': 'https://truthscan.com',
                        'Referer': 'https://truthscan.com/ai-video-detector',
                        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Brave";v="144"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Gpc': '1'
                    }
                    
                    response = requests.post(
                        url,
                        files=files,
                        data=data,
                        headers=headers,
                        timeout=120
                    )
            
            print(f"DEBUG: Response status: {response.status_code}", file=sys.stderr)
            
            if response.status_code != 200:
                return {
                    "error": f"{response.status_code} {response.reason}: {response.text[:200]}"
                }
            
            result = response.json()
            print(f"DEBUG: Response data: {result}", file=sys.stderr)
            
            return result
            
        except requests.exceptions.RequestException as e:
            return {
                "error": f"Request failed: {str(e)}"
            }
        except Exception as e:
            return {
                "error": f"Detection error: {str(e)}"
            }
    
    def _format_results(self, detection):
        """
        Format results to match expected output format
        TruthScan video API returns: videoScore, videoIsAI, videoConfidence, result_details
        """
        # Use videoScore (the ML model score) as primary indicator
        ai_percentage = detection.get('videoScore', 0)
        
        # Determine if it's AI generated using videoIsAI
        is_ai = detection.get('videoIsAI', False)
        
        # Get confidence level
        confidence = detection.get('videoConfidence', 'Unknown')
        
        # Get verdict from result_details
        result_details = detection.get('result_details', {})
        verdict = result_details.get('final_result', 'AI Generated' if is_ai else 'Human Created')
        
        # Format the response to match expected structure
        return {
            "success": True,
            "verdict": verdict,
            "ai_percentage": ai_percentage,
            "human_percentage": 100 - ai_percentage,
            "confidence": confidence,
            "is_ai_generated": is_ai
        }


# Main execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No video path provided. Usage: python truthscan_analyzer_video.py <video_path>"
        }))
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    try:
        # Analyze the video directly
        detector = TruthScanVideoAPI()
        result = detector.check_video(video_path)
        
        # Output JSON to stdout
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)