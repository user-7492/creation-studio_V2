import { AspectRatio } from "../types";

// ==========================================
// 配置区域
// ==========================================

// 1. 设置 Base URL (去掉结尾的 /v1，以便动态切换 v1/v1beta)
const BASE_URL = "https://geminikey.top";

// ==========================================
// 类型定义 (适配 Google Vertex AI REST 协议)
// ==========================================

// --- Imagen 3.0 (图片) 相关类型 ---
interface ImagenInstance {
  prompt: string;
}

interface ImagenParameters {
  sampleCount: number;
  aspectRatio: string;
  // includeRaiReasoning?: boolean; 
}

interface ImagenRequest {
  instances: ImagenInstance[];
  parameters: ImagenParameters;
}

interface ImagenPrediction {
  bytesBase64Encoded: string;
  mimeType: string;
}

interface ImagenResponse {
  predictions?: ImagenPrediction[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// --- Veo (视频) 相关类型 ---
interface VeoRequest {
  model: string; // 用于兼容某些代理的 body 检查
  prompt: string;
  config: {
    numberOfVideos: number;
    resolution: string;
    aspectRatio: string; // 16:9 or 9:16
  };
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

// ==========================================
// 辅助函数
// ==========================================

const handleResponse = async (response: Response, context: string) => {
  if (!response.ok) {
    const errorText = await response.text();
    // 抛出详细错误，方便在前端调试
    throw new Error(`[${context}] API Error ${response.status}: ${errorText}`);
  }
  return response.json();
};

// ==========================================
// 核心功能导出
// ==========================================

/**
 * 生成图片
 * 使用模型: imagen-3.0-generate-001
 * 协议: Vertex AI (:predict)
 */
export const generateImageWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string[]> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  // 1. 映射长宽比到 Imagen 3 支持的字符串格式
  let targetRatio = "1:1";
  switch (ratio) {
    case AspectRatio.Wide: targetRatio = "16:9"; break;
    case AspectRatio.Tall: targetRatio = "9:16"; break;
    case AspectRatio.Standard: targetRatio = "4:3"; break;
    case AspectRatio.Portrait: targetRatio = "3:4"; break;
    default: targetRatio = "1:1";
  }

  // 2. 处理 Prompt (Imagen 3 API 主要支持文生图，参考图建议转为文字描述)
  let finalPrompt = prompt;
  if (referenceImageBase64) {
    console.warn("Imagen 3 API: Reference image provided but optimized as text prompt enhancement.");
    finalPrompt = `(Create an image based on a reference idea) ${prompt}`;
  }

  const payload: ImagenRequest = {
    instances: [
      { prompt: finalPrompt }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: targetRatio
    }
  };

  try {
    // 3. 构建请求 URL (注意使用 v1beta)
    const url = `${BASE_URL}/v1beta/models/imagen-3.0-generate-001:predict?key=${key}`;
    console.log(`[Image] Requesting: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: ImagenResponse = await handleResponse(response, "Imagen Generation");

    // 4. 解析结果 (Imagen 返回的是 predictions 数组)
    const generatedUrls: string[] = [];
    if (data.predictions && Array.isArray(data.predictions)) {
      for (const prediction of data.predictions) {
        if (prediction.bytesBase64Encoded) {
          const mimeType = prediction.mimeType || 'image/png';
          generatedUrls.push(`data:${mimeType};base64,${prediction.bytesBase64Encoded}`);
        }
      }
    }

    if (generatedUrls.length === 0) {
      console.warn("API Request successful but no images returned:", data);
      throw new Error("No image data found in API response.");
    }

    return generatedUrls;

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    // 捕获并重新抛出，以便上层 UI 展示
    throw error;
  }
};

/**
 * 生成视频
 * 使用模型: veo-3.1-fast-generate-preview (或 veo-2.0-generate-preview)
 * 协议: Vertex AI (:generateVideos + Polling)
 */
export const generateVideoWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  // 1. Veo 严格限制长宽比为 16:9 或 9:16
  let targetRatio = '16:9';
  if (ratio === AspectRatio.Tall || ratio === AspectRatio.Portrait) {
    targetRatio = '9:16';
  }

  const payload: VeoRequest = {
    model: 'veo-3.1-fast-generate-preview', // 这里的字段用于 body
    prompt: prompt || 'A cinematic video',
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: targetRatio
    }
  };

  if (referenceImageBase64) {
    const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    payload.image = {
      imageBytes: cleanBase64,
      mimeType: 'image/png'
    };
  }

  try {
    // 2. 发起生成任务 (使用 v1beta)
    // 如果 veo-3.1 报错 404，可尝试降级为 veo-2.0-generate-preview
    const generateUrl = `${BASE_URL}/v1beta/models/veo-3.1-fast-generate-preview:generateVideos?key=${key}`;
    console.log(`[Video] Starting task: ${generateUrl}`);

    const initialResponse = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const operation = await handleResponse(initialResponse, "Video Task Creation");
    
    // 获取 Operation Name (例如: projects/xxx/locations/xxx/operations/xxx)
    const operationName = operation.name; 
    if (!operationName) {
        throw new Error("Failed to get operation name from video generation response");
    }
    console.log(`[Video] Operation started: ${operationName}`);

    // 3. 轮询状态 (Polling)
    let videoUri: string | null = null;
    let attempts = 0;
    const maxAttempts = 120; // 120 * 5s = 10分钟超时

    while (!videoUri && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
      attempts++;

      // 轮询 URL: BASE_URL + /v1beta/ + operationName
      const pollUrl = `${BASE_URL}/v1beta/${operationName}?key=${key}`;
      
      const pollResponse = await fetch(pollUrl, { method: "GET" });
      const pollData = await handleResponse(pollResponse, "Video Polling");

      if (pollData.done) {
        if (pollData.error) {
           throw new Error(`Video generation failed: ${pollData.error.message}`);
        }
        
        // 解析结果 URI
        // 结构通常是 response.generatedVideos[0].video.uri 或 result.generatedVideos...
        const resultContainer = pollData.response || pollData.result;
        const videos = resultContainer?.generatedVideos;
        
        if (videos && videos.length > 0) {
            videoUri = videos[0].video?.uri;
        }

        if (!videoUri) {
            console.error("Polling done but no URI:", pollData);
            throw new Error("Operation completed but no video URI was returned.");
        }
      }
    }

    if (!videoUri) {
        throw new Error("Video generation timed out.");
    }

    console.log(`[Video] Generation success. URI: ${videoUri}`);

    // 4. 视频下载代理
    // 如果返回的是 gs:// 或 http 链接，为了避免跨域或鉴权问题，走代理转发
    let downloadUrl = videoUri;
    
    // 如果不是直接可访问的链接，或者需要代理鉴权
    // 这里构建代理请求，通常代理服务器在根路径或 /v1/ 下提供 helper
    // 假设 geminikey.top 的视频代理端点是 /v1/video-proxy
    if (!videoUri.startsWith('http') || videoUri.includes('googleapis.com')) {
       downloadUrl = `${BASE_URL}/v1/video-proxy?uri=${encodeURIComponent(videoUri)}&key=${key}`;
    }

    console.log(`[Video] Downloading from: ${downloadUrl}`);
    
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video stream: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Gemini Video Generation Error:", error);
    throw error;
  }
};
