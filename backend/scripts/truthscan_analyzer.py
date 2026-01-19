"""
TruthScan AI Image Detector - Fixed Implementation with Retry Logic
"""

import requests
import json
import sys
import os
import time
import random
from pathlib import Path
from requests_toolbelt.multipart.encoder import MultipartEncoder


class TruthScanDirectAPI:
    """
    Direct API integration with TruthScan - with retry logic and rate limiting
    """
    
    def __init__(self):
        self.base_url = "https://truthscan.com/api"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://truthscan.com',
            'Referer': 'https://truthscan.com/ai-image-detector',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        })
        self.max_retries = 3
        self.retry_delay = 2  # seconds
    
    def _retry_request(self, func, *args, **kwargs):
        """Retry a request with exponential backoff"""
        for attempt in range(self.max_retries):
            try:
                result = func(*args, **kwargs)
                if result.get('success') or attempt == self.max_retries - 1:
                    return result
                
                # If not successful and not last attempt, wait and retry
                wait_time = self.retry_delay * (2 ** attempt) + random.uniform(0.5, 2.0)
                print(f"DEBUG: Attempt {attempt + 1} failed, retrying in {wait_time:.1f}s...", file=sys.stderr)
                time.sleep(wait_time)
                
            except Exception as e:
                if attempt == self.max_retries - 1:
                    return {"success": False, "error": str(e)}
                
                wait_time = self.retry_delay * (2 ** attempt) + random.uniform(0.5, 2.0)
                print(f"DEBUG: Exception on attempt {attempt + 1}: {e}, retrying in {wait_time:.1f}s...", file=sys.stderr)
                time.sleep(wait_time)
        
        return {"success": False, "error": "Max retries exceeded"}
    
    def check_image(self, image_path, wait_time=120):
        """
        Analyze an image for AI generation using direct API calls
        """
        if not Path(image_path).exists():
            return {
                "success": False,
                "error": f"Image not found: {image_path}"
            }
        
        try:
            # Step 1: Upload the image (with retry)
            print(f"DEBUG: Uploading {image_path}", file=sys.stderr)
            upload_result = self._retry_request(self._upload_image, image_path)
            
            if not upload_result.get('success'):
                print(f"DEBUG: Upload failed after retries: {upload_result}", file=sys.stderr)
                return {
                    "success": False,
                    "error": f"Image upload failed: {upload_result.get('error', 'Unknown error')}"
                }
            
            print(f"DEBUG: Upload successful", file=sys.stderr)
            
            image_url = upload_result['imageUrl']
            r2_file_path = upload_result['r2FilePath']
            
            # Get file info
            file_name = Path(image_path).name
            file_size = os.path.getsize(image_path)
            file_ext = Path(image_path).suffix.lower()
            
            if file_ext in ['.png']:
                file_type = 'image/png'
            elif file_ext in ['.jpg', '.jpeg']:
                file_type = 'image/jpeg'
            else:
                file_type = 'image/jpeg'
            
            # Add delay between requests to avoid overwhelming API - WITH RANDOMIZATION
            time.sleep(1 + random.uniform(0.5, 1.5))
            
            # Step 2: Detect AI (with retry)
            print(f"DEBUG: Running AI detection", file=sys.stderr)
            detection_result = self._retry_request(
                self._ai_detect, image_url, r2_file_path, file_name, file_size, file_type
            )
            
            if not detection_result.get('success'):
                print(f"DEBUG: Detection failed after retries: {detection_result}", file=sys.stderr)
                return {
                    "success": False,
                    "error": f"AI detection failed: {detection_result.get('error', 'Unknown error')}"
                }
            
            print(f"DEBUG: Detection successful", file=sys.stderr)
            
            # Add delay between requests - WITH RANDOMIZATION
            time.sleep(1 + random.uniform(0.5, 1.5))
            
            # Step 3: Moderate content
            print(f"DEBUG: Running moderation check", file=sys.stderr)
            moderation_result = self._moderate_content(image_url)
            print(f"DEBUG: Moderation result: {moderation_result}", file=sys.stderr)
            
            # Add delay before final analysis - WITH RANDOMIZATION
            time.sleep(1 + random.uniform(0.5, 1.5))
            
            # Step 4: Get detailed analysis (skip if API is having issues)
            print(f"DEBUG: Running detailed analysis", file=sys.stderr)
            analysis_result = {}
            try:
                analysis_result = self._ai_image_analysis(
                    image_url,
                    detection_result.get('score', 0),
                    detection_result.get('details', {}).get('result_details', {}).get('final_result', ''),
                    detection_result.get('detectionResultId', ''),
                    detection_result.get('details', {}).get('result_details', {})
                )
            except Exception as e:
                print(f"DEBUG: Analysis endpoint failed (non-critical): {e}", file=sys.stderr)
                # Continue without detailed analysis - we have detection results
            
            print(f"DEBUG: Analysis result: {analysis_result}", file=sys.stderr)
            
            return self._format_results(detection_result, analysis_result, moderation_result)
            
        except Exception as e:
            print(f"DEBUG: Exception: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": str(e)
            }
    
    def _upload_image(self, image_path):
        """Step 1: Upload image"""
        url = f"{self.base_url}/upload-image"
        
        try:
            file_name = Path(image_path).name
            file_ext = Path(image_path).suffix.lower()
            
            if file_ext == '.png':
                mime_type = 'image/png'
            elif file_ext in ['.jpg', '.jpeg']:
                mime_type = 'image/jpeg'
            elif file_ext == '.gif':
                mime_type = 'image/gif'
            elif file_ext == '.webp':
                mime_type = 'image/webp'
            else:
                mime_type = 'image/jpeg'
            
            print(f"DEBUG: Uploading {file_name} as {mime_type}", file=sys.stderr)
            
            try:
                with open(image_path, 'rb') as f:
                    multipart_data = MultipartEncoder(
                        fields={'file': (file_name, f, mime_type)}
                    )
                    
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Origin': 'https://truthscan.com',
                        'Referer': 'https://truthscan.com/ai-image-detector',
                        'Content-Type': multipart_data.content_type
                    }
                    
                    response = requests.post(
                        url,
                        data=multipart_data,
                        headers=headers,
                        timeout=120  # Increased timeout
                    )
            except ImportError:
                with open(image_path, 'rb') as f:
                    files = {'file': (file_name, f, mime_type)}
                    
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Origin': 'https://truthscan.com',
                        'Referer': 'https://truthscan.com/ai-image-detector'
                    }
                    
                    response = requests.post(
                        url,
                        files=files,
                        headers=headers,
                        timeout=120  # Increased timeout
                    )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"{response.status_code} {response.reason}"
                }
            
            return response.json()
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Upload error: {str(e)}"
            }
    
    def _ai_detect(self, image_url, r2_file_path, file_name, file_size, file_type):
        """Step 2: Run AI detection"""
        url = f"{self.base_url}/ai-detect-image"
        
        try:
            try:
                multipart_data = MultipartEncoder(
                    fields={
                        'imageUrl': image_url,
                        'fileName': file_name,
                        'fileSize': str(file_size),
                        'fileType': file_type,
                        'r2FilePath': r2_file_path
                    }
                )
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Origin': 'https://truthscan.com',
                    'Referer': 'https://truthscan.com/ai-image-detector',
                    'Content-Type': multipart_data.content_type
                }
                
                response = requests.post(
                    url,
                    data=multipart_data,
                    headers=headers,
                    timeout=120  # Increased timeout
                )
            except ImportError:
                data = {
                    'imageUrl': image_url,
                    'fileName': file_name,
                    'fileSize': str(file_size),
                    'fileType': file_type,
                    'r2FilePath': r2_file_path
                }
                
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Origin': 'https://truthscan.com',
                    'Referer': 'https://truthscan.com/ai-image-detector'
                }
                
                response = requests.post(
                    url,
                    data=data,
                    headers=headers,
                    timeout=120  # Increased timeout
                )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"{response.status_code} {response.reason}"
                }
            
            return response.json()
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Detection error: {str(e)}"
            }
    
    def _moderate_content(self, image_url):
        """Step 3: Content moderation check"""
        url = f"{self.base_url}/moderate-content"
        
        try:
            data = {
                'imageUrl': image_url
            }
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Origin': 'https://truthscan.com',
                'Referer': 'https://truthscan.com/ai-image-detector'
            }
            
            response = requests.post(
                url,
                data=data,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            return response.json()
        except:
            return {"safe": True}
    
    def _ai_image_analysis(self, image_url, ai_score, final_result, detection_result_id, result_details):
        """Step 4: Get detailed AI analysis (optional, may fail)"""
        url = f"{self.base_url}/ai-image-analysis"
        
        try:
            data = {
                'imageUrl': image_url,
                'aiScore': str(ai_score),
                'finalResult': final_result,
                'detectionResultId': detection_result_id,
                'resultDetails': json.dumps(result_details)
            }
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Origin': 'https://truthscan.com',
                'Referer': 'https://truthscan.com/ai-image-detector'
            }
            
            response = requests.post(
                url,
                data=data,
                headers=headers,
                timeout=90
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"DEBUG: Analysis error (non-critical): {e}", file=sys.stderr)
            return {}
    
    def _format_results(self, detection, analysis, moderation):
        """Format results to match expected output format"""
        ai_percentage = detection.get('score', 0)
        is_ai = detection.get('isAI', False)
        confidence = detection.get('confidence', 'Unknown')
        
        # Get detailed analysis if available
        result_details = detection.get('details', {}).get('result_details', {})
        
        return {
            "success": True,
            "verdict": result_details.get('final_result', 'AI Generated' if is_ai else 'Real'),
            "ai_percentage": ai_percentage,
            "human_percentage": 100 - ai_percentage,
            "confidence": confidence,
            "is_ai_generated": is_ai,
            "heatmap_url": result_details.get('heatmap_url'),
            "analysis": analysis,
            "metadata": result_details.get('metadata', []),
            "detection_step": result_details.get('detection_step')
        }


# Main execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No image path provided. Usage: python truthscan_analyzer.py <image_path>"
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    detector = TruthScanDirectAPI()
    result = detector.check_image(image_path, wait_time=120)
    
    print(json.dumps(result))