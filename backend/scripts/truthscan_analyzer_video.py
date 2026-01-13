"""
TruthScan AI Video Detector - For Node.js Backend Integration
Extracts middle frame from video and analyzes it, returns JSON to stdout
"""

import os
import sys
import time
import json
from pathlib import Path

# Only import if not already installed
try:
    import cv2
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
    from selenium.webdriver.common.keys import Keys
except ImportError:
    print(json.dumps({"success": False, "error": "Required packages not installed. Run: pip install selenium opencv-python"}))
    sys.exit(1)


def extract_most_complex_frame(video_path, output_path, sample_rate=30):
    """
    Extract the most visually complex frame from a video.
    
    Args:
        video_path (str): Path to the video file
        output_path (str): Path where to save the extracted frame
        sample_rate (int): Analyze every Nth frame (default: 30)
        
    Returns:
        str: Path to the extracted frame image
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    max_complexity_score = 0
    best_frame = None
    best_frame_idx = 0
    
    frame_idx = 0
    
    while True:
        ret, frame = cap.read()
        
        if not ret:
            break
        
        if frame_idx % sample_rate == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            pixel_var = gray.var()
            
            edges = cv2.Canny(gray, 50, 150)
            edge_density = (edges > 0).sum() / edges.size
            
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            color_var = hsv[:,:,1].var()
            
            complexity_score = (
                laplacian_var * 0.35 +
                pixel_var * 0.25 +
                edge_density * 5000 +
                color_var * 0.15
            )
            
            if complexity_score > max_complexity_score:
                max_complexity_score = complexity_score
                best_frame = frame.copy()
                best_frame_idx = frame_idx
        
        frame_idx += 1
    
    cap.release()
    
    if best_frame is None:
        raise ValueError("Could not extract any frame from video")
    
    cv2.imwrite(output_path, best_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    
    return output_path


class TruthScanDetector:
    """
    TruthScan AI Image Detector - waits for analysis to complete.
    """
    
    def __init__(self):
        self.url = "https://truthscan.com/ai-image-detector"
        self.driver = None
        
    def _setup_driver(self):
        """Setup Chrome WebDriver."""
        chrome_options = Options()
        
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-features=NetworkService')
        chrome_options.add_argument('--window-size=1920x1080')
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception as e:
            raise Exception(f"Browser initialization failed: {e}")
    
    def _safe_popup_close(self):
        """Safely close popup without crashing the browser."""
        try:
            body = self.driver.find_element(By.TAG_NAME, "body")
            for i in range(3):
                body.send_keys(Keys.ESCAPE)
                time.sleep(0.2)
            return True
        except:
            return False
    
    def _check_if_browser_alive(self):
        """Check if browser is still responsive."""
        try:
            self.driver.title
            return True
        except WebDriverException:
            return False
        
    def check_image(self, image_path, wait_time=120):
        """
        Upload and analyze an image.
        
        Args:
            image_path (str): Path to the image file
            wait_time (int): Maximum seconds to wait for results
            
        Returns:
            dict: Detection results
        """
        if not Path(image_path).exists():
            return {
                "success": False,
                "error": f"Image not found: {image_path}"
            }
        
        abs_path = str(Path(image_path).resolve())
        
        try:
            self._setup_driver()
            
            self.driver.get(self.url)
            time.sleep(5)
            
            self._safe_popup_close()
            
            file_input = self._find_file_input()
            
            if not file_input:
                raise Exception("Could not find file upload element")
            
            file_input.send_keys(abs_path)
            
            time.sleep(2)
            self._safe_popup_close()
            
            result = self._wait_for_results(wait_time)
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except:
                    pass
    
    def _find_file_input(self):
        """Find the file input element."""
        wait = WebDriverWait(self.driver, 10)
        
        selectors = [
            (By.CSS_SELECTOR, "input[type='file']"),
            (By.CSS_SELECTOR, "input[accept*='image']"),
            (By.XPATH, "//input[@type='file']"),
        ]
        
        for by, selector in selectors:
            try:
                element = wait.until(EC.presence_of_element_located((by, selector)))
                if element:
                    return element
            except:
                continue
        
        return None
    
    def _wait_for_results(self, wait_time):
        """
        Wait for analysis to complete - "Analyzing..." must disappear.
        
        Returns:
            dict: Parsed results
        """
        import re
        
        result = {
            "success": False,
            "verdict": None,
            "ai_percentage": None,
            "human_percentage": None,
            "confidence": None,
            "is_ai_generated": None
        }
        
        results_found = False
        
        for i in range(wait_time):
            time.sleep(1)
            
            if not self._check_if_browser_alive():
                break
            
            if i in [10, 25, 40]:
                try:
                    self._safe_popup_close()
                except:
                    pass
            
            try:
                page_text = self.driver.find_element(By.TAG_NAME, "body").text
                
                is_analyzing = "Analyzing..." in page_text or "Inspecting Pixels" in page_text
                
                if is_analyzing:
                    continue
                
                has_probability_result = bool(re.search(r'(\d+)\s*%\s+Probability', page_text))
                has_confidence_result = bool(re.search(r'(High|Medium|Low)\s+Confidence', page_text))
                has_classification_result = bool(re.search(r'(Fake|Real)\s+Classification', page_text))
                
                if has_probability_result and has_classification_result:
                    results_found = True
                    time.sleep(2)
                    break
                
                lines = page_text.split('\n')
                for idx, line in enumerate(lines):
                    if re.search(r'\d+%', line):
                        context = '\n'.join(lines[max(0,idx-2):min(len(lines),idx+3)])
                        if 'Probability' in context and 'Classification' in context:
                            if 'Detection Accuracy' not in context:
                                results_found = True
                                time.sleep(2)
                                break
                
                if results_found:
                    break
                    
            except Exception as e:
                continue
        
        try:
            page_text = self.driver.find_element(By.TAG_NAME, "body").text
            
            if "Analyzing..." in page_text:
                result["error"] = "Analysis timeout - still processing"
                return result
            
            prob_match = re.search(r'(\d+)\s*%\s+Probability', page_text)
            if prob_match:
                probability = float(prob_match.group(1))
                result["ai_percentage"] = probability
                result["human_percentage"] = 100 - probability
            
            conf_match = re.search(r'(High|Medium|Low)\s+Confidence', page_text)
            if conf_match:
                result["confidence"] = conf_match.group(1)
            
            class_match = re.search(r'(Fake|Real)\s+Classification', page_text)
            if class_match:
                classification = class_match.group(1)
                result["verdict"] = "AI Generated" if classification == "Fake" else "Human Created"
                result["is_ai_generated"] = (classification == "Fake")
            
            if not prob_match:
                percentages = re.findall(r'(\d+)\s*%', page_text)
                for pct in percentages:
                    pct_val = int(pct)
                    pct_idx = page_text.find(f"{pct}%")
                    context = page_text[max(0,pct_idx-100):min(len(page_text),pct_idx+200)]
                    
                    if 'Detection Accuracy' not in context and ('Probability' in context or 'Classification' in context):
                        result["ai_percentage"] = float(pct)
                        result["human_percentage"] = 100 - float(pct)
                        break
            
            if (result["verdict"] or result["ai_percentage"] is not None) and "Analyzing..." not in page_text:
                result["success"] = True
            else:
                result["error"] = "Incomplete results"
            
        except Exception as e:
            result["error"] = f"Parsing error: {str(e)}"
        
        return result


# Main execution - receives video path from command line
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No video path provided. Usage: python truthscan_analyzer_video.py <video_path>"
        }))
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    try:
        # Create temp directory for frame extraction
        temp_dir = os.path.join(os.path.dirname(video_path), 'temp_frames')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        
        # Extract frame
        frame_path = os.path.join(temp_dir, f"frame_{int(time.time())}.jpg")
        extract_most_complex_frame(video_path, frame_path, sample_rate=30)
        
        # Analyze the extracted frame
        detector = TruthScanDetector()
        result = detector.check_image(frame_path, wait_time=120)
        
        # Clean up frame
        try:
            os.remove(frame_path)
            os.rmdir(temp_dir)
        except:
            pass
        
        # Output JSON to stdout for Node.js to read
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)