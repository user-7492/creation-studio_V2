import { AspectRatio } from "../types";

// 定义基础 URL
const BASE_URL = "https://geminikey.top/v1";

// 定义简单的接口以替代 SDK 的类型
interface GenerateContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GenerateContentRequest {
  contents: { parts: GenerateContentPart[] }[];
  generationConfig?: {
    imageConfig?: { aspectRatio: AspectRatio };
  };
}

// 视频生成相关的类型定义
interface GenerateVideoRequest {
  model: string;
  prompt: string;
  config: {
    numberOfVideos: number;
    resolution: string;
    aspectRatio: string;
  };
  image?: {
    imageBytes: string;
    mimeType: string;
  };
}

/**
 * 辅助函数：处理 API 错误
 */
const handleResponse = async (response: Response, context: string) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${context}) [${response.status}]: ${errorText}`);
  }
  return response.json();
};

/**
 * 图片生成 (使用 Fetch)
 */
export const generateImageWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string[]> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  const parts: GenerateContentPart[] = [];

  // 1. 处理参考图
  if (referenceImageBase64) {
    const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: 'image/png',
      },
    });
    parts.push({ text: `Based on this reference image, generate: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  // 2. 构建请求体
  // 注意：这里假设代理服务器支持 gemini-2.5-flash-image 的 generateContent 接口
  // 如果是 Imagen 3 模型，端点可能是 :predict，但此处保持与您原代码意图一致
  const payload: GenerateContentRequest = {
    contents: [{ parts }],
    generationConfig: {
      imageConfig: { aspectRatio: ratio }
    }
  };

  try {
    // 3. 发起请求
    const url = `${BASE_URL}/models/gemini-2.0-flash-preview-image-generationmini-2.0-flash-preview-image-generation:generateContent?key=${key}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await handleResponse(response, "Image Generation");

    // 4. 解析结果
    const generatedUrls: string[] = [];
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          generatedUrls.push(`data:${mimeType};base64,${part.inlineData.data}`);
        }
      }
    }
    
    if (generatedUrls.length === 0) {
        console.warn("API returned success but no image data found.", data);
    }

    return generatedUrls;

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

/**
 * 视频生成 (使用 Fetch + 轮询)
 */
export const generateVideoWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  // 1. 处理长宽比映射
  let targetRatio = '16:9';
  if (ratio === AspectRatio.Tall || ratio === AspectRatio.Portrait) {
    targetRatio = '9:16';
  }

  // 2. 构建请求体
  const payload: GenerateVideoRequest = {
    model: 'veo-3.1-fast-generate-preview',
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
    // 3. 发起生成任务 (POST)
    // 注意：Veo 的标准 API 通常是 :generateVideos
    const generateUrl = `${BASE_URL}/models/veo-3.1-fast-generate-preview:generateVideos?key=${key}`;
    
    const initialResponse = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const operation = await handleResponse(initialResponse, "Video Task Creation");
    
    // 获取 Operation 名称 (例如 "projects/.../locations/.../operations/...")
    // 不同的代理/API 版本返回字段可能不同，通常是 operation.name
    let operationName = operation.name; 
    if (!operationName && operation.response) {
       // 如果直接返回了结果而没有进入等待队列（较少见）
       // 处理逻辑需视实际 API 而定
    }

    console.log("Video operation started:", operationName);

    // 4. 轮询状态 (Polling)
    let videoUri: string | null = null;
    let attempts = 0;
    const maxAttempts = 60; // 防止无限死循环 (比如 5分钟超时)

    while (!videoUri && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
      attempts++;

      // 构建查询 Operation 的 URL
      // 注意：必须通过代理查询，将 operationName 拼接到 URL 中
      // 标准格式: GET https://geminikey.top/v1/{operationName}
      const pollUrl = `${BASE_URL}/${operationName}?key=${key}`;
      
      const pollResponse = await fetch(pollUrl, { method: "GET" });
      const pollData = await handleResponse(pollResponse, "Video Polling");

      if (pollData.done) {
        if (pollData.error) {
           throw new Error(`Video generation failed: ${pollData.error.message}`);
        }
        // 提取 Video URI
        // 结构通常是: response.result.generatedVideos[0].video.uri 或 response.generatedVideos...
        // 取决于 SDK 之前是如何解包的，这里根据 REST API 标准结构尝试解析
        const videos = pollData.response?.generatedVideos || pollData.result?.generatedVideos;
        videoUri = videos?.[0]?.video?.uri;
        
        if (!videoUri) {
             throw new Error("Operation done but no video URI found in response");
        }
      }
    }

    if (!videoUri) {
        throw new Error("Video generation timed out");
    }

    // 5. 视频下载代理逻辑 (保持您原有的核心逻辑)
    let videoUrl = videoUri;
    
    // 如果是 Google 原始存储链接，通过您的代理下载
    if (videoUri.includes('googleapis.com')) {
       videoUrl = `${BASE_URL}/video-proxy?uri=${encodeURIComponent(videoUri)}&key=${key}`;
    } 
    // 如果返回的不是 http 开头 (只是路径)，也需要处理
    else if (!videoUri.startsWith('http')) {
       // 这种情况极少，但以防万一
       videoUrl = `${BASE_URL}/video-proxy?uri=${encodeURIComponent(videoUri)}&key=${key}`;
    }

    console.log("Fetching video from:", videoUrl);
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video stream: ${videoResponse.statusText}`);
    }

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Gemini Video Generation Error:", error);
    throw error;
  }
};
