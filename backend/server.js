// server.js
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Layer 1: Filename Pattern Detection
const aiPatterns = [
  { name: 'Gemini', pattern: /gemini[_\s]generated[_\s]image/i },
  { name: 'ChatGPT/DALL-E', pattern: /chatgpt[_\s]image|dall[-_]?e/i },
  { name: 'Midjourney', pattern: /midjourney|_MJ_/i },
  { name: 'Stable Diffusion', pattern: /stable[_\s]diffusion|sd[_\s]|sdxl/i },
  { name: 'Firefly', pattern: /firefly[_\s]/i },
  { name: 'Flux', pattern: /flux[_\s]/i },
  { name: 'Grok', pattern: /grok[_\s]/i },
  { name: 'Leonardo AI', pattern: /leonardo[_\s]ai/i },
  { name: 'Bing Image Creator', pattern: /bing[_\s]image|image[_\s]creator/i },
  { name: 'Ideogram', pattern: /ideogram/i },
  { name: 'Craiyon', pattern: /craiyon/i },
  { name: 'Generic AI', pattern: /ai[_\s]generated|generated[_\s]by[_\s]ai|ai[_\s]art/i }
];

function checkFilenameLayer(filename) {
  for (const { name, pattern } of aiPatterns) {
    if (pattern.test(filename)) {
      return { 
        passed: false, 
        isAI: true, 
        layer: 1,
        layerName: 'Filename Pattern Detection',
        model: name,
        reason: `Filename contains AI generator pattern: ${name}`
      };
    }
  }
  return { passed: true, isAI: false };
}

// Layer 2: Metadata Analysis
async function checkMetadataLayer(filePath, filename) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(fileBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(uint8Array);
    const textLower = text.toLowerCase();

    const detection = {
      isAI: false,
      isScreenshot: false,
      isCameraPhoto: false,
      indicators: [],
      generator: null,
      sourceType: null,
      deviceInfo: null
    };

    // Check for Grok AI markers
    const grokMarkers = [
      'Grok Image Prompt',
      'GrokImagePrompt',
      'Grok Image Upsampled',
      'GrokImageUpsampled',
      'xmp:GrokImage'
    ];
    
    for (const marker of grokMarkers) {
      if (textLower.includes(marker.toLowerCase())) {
        detection.isAI = true;
        detection.generator = 'Grok AI (X/xAI)';
        detection.sourceType = 'Grok AI Generated';
        detection.indicators.push('Grok AI metadata detected');
        break;
      }
    }

    // Check for XMP Toolkit
    if (text.includes('XMP Toolkit') || text.includes('Adobe XMP Core')) {
      detection.indicators.push('XMP metadata present');
    }

    // Check for Screenshots
    const screenshotPatterns = [
      /Screenshot_\d{4}-\d{2}-\d{2}/i,
      /Screenshot[\s_-]\d/i,
      /Screen[_-]?shot/i,
      /SCR[\d-]/i,
      /SS_\d/i
    ];
    
    const isScreenshotByName = screenshotPatterns.some(pattern => pattern.test(filename));
    const hasAndroidSoftware = /Android CPH|Android|MIUI|ColorOS|OneUI|OxygenOS/i.test(text);
    
    if (isScreenshotByName || (hasAndroidSoftware && filename.toLowerCase().includes('screenshot'))) {
      detection.isScreenshot = true;
      detection.sourceType = 'Screenshot';
      detection.indicators.push('Screenshot detected');
    }

    // Check for Camera Photos (EXIF data)
    const cameraIndicators = {
      hasExposure: /ExposureTime|ExposureProgram|ExposureMode/i.test(text),
      hasAperture: /Aperture|FNumber|ApertureValue/i.test(text),
      hasFocalLength: /FocalLength/i.test(text),
      hasISO: /ISO[\s:]|ISOSpeedRatings/i.test(text),
      hasFlash: /Flash[\s:]/i.test(text),
      hasMeteringMode: /MeteringMode/i.test(text),
      hasWhiteBalance: /WhiteBalance/i.test(text)
    };

    const cameraIndicatorCount = Object.values(cameraIndicators).filter(Boolean).length;
    
    if (cameraIndicatorCount >= 3) {
      detection.isCameraPhoto = true;
      detection.sourceType = 'Camera Photo';
      detection.indicators.push(`Camera EXIF data present (${cameraIndicatorCount} indicators)`);
    }

    // Check for C2PA markers
    if (text.includes('c2pa') || text.includes('C2PA')) {
      detection.indicators.push('C2PA standard detected');
    }

    // Check for digital source type (AI indicator)
    if (text.includes('trainedAlgorithmicMedia')) {
      detection.isAI = true;
      detection.sourceType = 'Trained Algorithmic Media (AI)';
      detection.indicators.push('Digital source type: AI-generated');
    }

    // Detect specific AI generators
    if (!detection.generator) {
      const generators = {
        'Google AI': /Made with Google AI|Google Generative AI|Google C2PA/i,
        'ChatGPT/GPT-4': /ChatGPT|GPT-4o/i,
        'Adobe Firefly': /Adobe_Firefly|Adobe Firefly/i,
        'Gemini': /Gemini Flash|gemini-flash/i,
        'Flux': /flux|fluxPro/i,
        'DALL-E': /DALL-E|dalle/i,
        'Midjourney': /midjourney/i,
        'Stable Diffusion': /stable.?diffusion/i
      };

      for (const [name, pattern] of Object.entries(generators)) {
        if (pattern.test(text)) {
          detection.generator = name;
          detection.isAI = true;
          detection.indicators.push(`Generator: ${name}`);
          break;
        }
      }
    }

    // Extract device information
    const makeMatch = text.match(/Make[\s:]+([^\n\r]+)/i);
    const modelMatch = text.match(/Model[\s:]+([^\n\r]+?)(?:\n|\r|$)/i);
    
    if (makeMatch || modelMatch) {
      const deviceParts = [];
      if (makeMatch && makeMatch[1].trim() && !makeMatch[1].includes('Unknown')) {
        deviceParts.push(makeMatch[1].trim());
      }
      if (modelMatch && modelMatch[1].trim() && !modelMatch[1].includes('Unknown')) {
        deviceParts.push(modelMatch[1].trim());
      }
      
      if (deviceParts.length > 0) {
        detection.deviceInfo = deviceParts.join(' ');
        detection.indicators.push(`Device: ${detection.deviceInfo}`);
      }
    }

    // Determine if image passed this layer
    if (detection.isAI) {
      return {
        passed: false,
        isAI: true,
        layer: 2,
        layerName: 'Metadata Analysis',
        generator: detection.generator,
        sourceType: detection.sourceType,
        indicators: detection.indicators,
        reason: `AI-generated metadata detected: ${detection.generator || 'Unknown Generator'}`
      };
    }

    return { 
      passed: true, 
      isAI: false,
      isScreenshot: detection.isScreenshot,
      isCameraPhoto: detection.isCameraPhoto,
      deviceInfo: detection.deviceInfo,
      indicators: detection.indicators
    };

  } catch (error) {
    console.error('Metadata analysis error:', error);
    return { passed: true, error: error.message };
  }
}

// Layer 3: TruthScan Analysis - NOW ACTIVE
async function checkTruthScanLayer(filePath, filename) {
  return new Promise((resolve, reject) => {
    console.log(`Starting TruthScan analysis for: ${filename}`);
    
    // Call Python script with image path (from scripts folder)
    const pythonScriptPath = path.join(__dirname, 'scripts', 'truthscan_analyzer.py');
    const python = spawn('python3', [pythonScriptPath, filePath]);
    
    let dataString = '';
    let errorString = '';
    
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        console.error(`Error output: ${errorString}`);
        resolve({
          passed: true,
          error: `TruthScan analysis failed: ${errorString || 'Unknown error'}`
        });
        return;
      }
      
      try {
        const result = JSON.parse(dataString);
        
        console.log(`TruthScan result for ${filename}:`, result);
        
        if (!result.success) {
          resolve({
            passed: true,
            error: result.error || 'TruthScan analysis incomplete'
          });
          return;
        }
        
        if (result.is_ai_generated) {
          resolve({
            passed: false,
            isAI: true,
            layer: 3,
            layerName: 'TruthScan Deep Analysis',
            verdict: result.verdict,
            aiPercentage: result.ai_percentage,
            humanPercentage: result.human_percentage,
            confidence: result.confidence,
            reason: `TruthScan detected AI generation with ${result.ai_percentage}% AI probability`
          });
        } else {
          resolve({
            passed: true,
            isAI: false,
            verdict: result.verdict,
            aiPercentage: result.ai_percentage,
            humanPercentage: result.human_percentage,
            confidence: result.confidence
          });
        }
      } catch (error) {
        console.error('Failed to parse TruthScan output:', error);
        console.error('Raw output:', dataString);
        resolve({
          passed: true,
          error: `Failed to parse TruthScan results: ${error.message}`
        });
      }
    });
  });
}

// Main processing endpoint
app.post('/api/analyze-claim', upload.array('files', 8), async (req, res) => {
  try {
    const { claimId, notes } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    let totalProgress = 0;
    const progressPerFile = 100 / files.length;

    // Process each file through the three layers
    for (const file of files) {
      const fileResult = {
        filename: file.originalname,
        size: file.size,
        type: file.mimetype.startsWith('image') ? 'image' : 'video',
        layerResults: [],
        finalStatus: null,
        failedAtLayer: null
      };

      // Layer 1: Filename Check
      const layer1Result = checkFilenameLayer(file.originalname);
      fileResult.layerResults.push({
        layer: 1,
        name: 'Filename Pattern Detection',
        ...layer1Result
      });

      if (!layer1Result.passed) {
        fileResult.finalStatus = 'AI_DETECTED';
        fileResult.failedAtLayer = 1;
        fileResult.authenticity = 'AI Generated';
        fileResult.details = layer1Result;
        results.push(fileResult);
        totalProgress += progressPerFile;
        
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        continue;
      }

      // Layer 2: Metadata Analysis
      const layer2Result = await checkMetadataLayer(file.path, file.originalname);
      fileResult.layerResults.push({
        layer: 2,
        name: 'Metadata Analysis',
        ...layer2Result
      });

      if (!layer2Result.passed) {
        fileResult.finalStatus = 'AI_DETECTED';
        fileResult.failedAtLayer = 2;
        fileResult.authenticity = 'AI Generated';
        fileResult.details = layer2Result;
        results.push(fileResult);
        totalProgress += progressPerFile;
        
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        continue;
      }

      // Layer 3: TruthScan Deep Analysis - NOW ACTIVE
      const layer3Result = await checkTruthScanLayer(file.path, file.originalname);
      fileResult.layerResults.push({
        layer: 3,
        name: 'TruthScan Deep Analysis',
        ...layer3Result
      });

      if (!layer3Result.passed) {
        fileResult.finalStatus = 'AI_DETECTED';
        fileResult.failedAtLayer = 3;
        fileResult.authenticity = 'AI Generated';
        fileResult.details = layer3Result;
      } else {
        fileResult.finalStatus = 'PASSED';
        fileResult.failedAtLayer = null;
        fileResult.authenticity = 'Likely Genuine';
        fileResult.details = layer3Result;
      }

      results.push(fileResult);
      totalProgress += progressPerFile;

      // Clean up uploaded file
      fs.unlinkSync(file.path);
    }

    // Calculate overall statistics
    const aiDetectedCount = results.filter(r => r.finalStatus === 'AI_DETECTED').length;
    const genuineCount = results.filter(r => r.finalStatus === 'PASSED').length;
    
    const overallRisk = aiDetectedCount > genuineCount ? 'High' : 
                        aiDetectedCount > 0 ? 'Medium' : 'Low';

    const response = {
      claimId,
      processedAt: new Date().toISOString(),
      fileCount: files.length,
      imageCount: files.filter(f => f.mimetype.startsWith('image')).length,
      videoCount: files.filter(f => f.mimetype.startsWith('video')).length,
      riskScore: overallRisk,
      confidence: Math.round((genuineCount / files.length) * 100),
      aiDetectedCount,
      genuineCount,
      results,
      notes
    };

    res.json(response);

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`TruthScan Layer 3 is ACTIVE`);
});