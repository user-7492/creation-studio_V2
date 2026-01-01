import { AspectRatio } from "../types";

// 1. 修改 Base URL：去掉结尾的 /v1，因为我们需要动态切换 v1 和 v1beta
const BASE_URL = "https://geminikey.top"; 

interface GenerateContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// ... (其他接口定义保持不变) ...

// 辅助函数保持不变
const handleResponse = async (response: Response, context: string) => {
  if (!response.ok) {
    const errorText = await response.text();
    // 优化错误提示，让用户更容易看懂
    throw new Error(`API Request Failed (${context}) - Status ${response.status}: ${errorText}`);
  }
  return response.json();
};

export const generateImageWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string[]> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  const parts: GenerateContentPart[] = [];

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

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      imageConfig: { aspectRatio: ratio }
    }
  };

  try {
    // 🔴 核心修改 1：使用正确的模型名称 (gemini-2.0-flash-exp)
    // 🔴 核心修改 2：使用 /v1beta/ 接口，而不是 /v1/
    const url = `${BASE_URL}/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${key}`;
    
    console.log("Requesting URL:", url); // 方便调试

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await handleResponse(response, "Image Generation");

    const generatedUrls: string[] = [];
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          generatedUrls.push(`data:${mimeType};base64,${part.inlineData.data}`);
        }
      }
    }
    
    return generatedUrls;

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

export const generateVideoWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("API Key is missing");

  let targetRatio = '16:9';
  if (ratio === AspectRatio.Tall || ratio === AspectRatio.Portrait) {
    targetRatio = '9:16';
  }

  const payload: any = {
    // 🔴 核心修改 3：Veo 模型也建议使用 v1beta 路径
    model: 'veo-3.1-fast-generate-preview', // 这里的 model 字段是给 body 用的
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
    // 🔴 核心修改 4：视频生成同样切换到 v1beta
    const generateUrl = `${BASE_URL}/v1beta/models/veo-3.1-fast-generate-preview:generateVideos?key=${key}`;
    
    const initialResponse = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const operation = await handleResponse(initialResponse, "Video Task Creation");
    
    let operationName = operation.name; 
    console.log("Video operation started:", operationName);

    let videoUri: string | null = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (!videoUri && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

      // 🔴 核心修改 5：轮询路径也需要适配 v1beta
      // 注意：operationName 通常包含版本号，但如果代理需要显式前缀，这里用 v1beta 安全
      const pollUrl = `${BASE_URL}/v1beta/${operationName}?key=${key}`;
      
      const pollResponse = await fetch(pollUrl, { method: "GET" });
      const pollData = await handleResponse(pollResponse, "Video Polling");

      if (pollData.done) {
        if (pollData.error) {
           throw new Error(`Video generation failed: ${pollData.error.message}`);
        }
        const videos = pollData.response?.generatedVideos || pollData.result?.generatedVideos;
        videoUri = videos?.[0]?.video?.uri;
      }
    }

    if (!videoUri) throw new Error("Video generation timed out");

    // 视频下载部分保持逻辑不变，只修改 Base URL
    let videoUrl = videoUri;
    if (videoUri.includes('googleapis.com') || !videoUri.startsWith('http')) {
        // 这里假设您的代理支持 /v1/video-proxy 或 /video-proxy，根据实际情况调整
       videoUrl = `${BASE_URL}/v1/video-proxy?uri=${encodeURIComponent(videoUri)}&key=${key}`;
    }

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
