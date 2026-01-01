import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// 自定义配置：使用代理服务器
const getAI = (apiKey?: string) => new GoogleGenAI({ 
  apiKey: apiKey || process.env.API_KEY,
  // 设置自定义基础URL
  baseURL: "https://geminikey.top/v1"
});

export const generateImageWithGemini = async (
  prompt: string,
  referenceImageBase64: string | null,
  ratio: AspectRatio,
  apiKey?: string
): Promise<string[]> => {
  try {
    const ai = getAI(apiKey);
    const parts: any[] = [];

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: ratio }
      },
    });

    const generatedUrls: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
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
  try {
    const ai = getAI(apiKey);
    
    // Veo only supports 16:9 or 9:16. Map others to nearest.
    let targetRatio = '16:9';
    if (ratio === AspectRatio.Tall || ratio === AspectRatio.Portrait) {
        targetRatio = '9:16';
    }

    const config: any = {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: targetRatio
    };

    let params: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'A cinematic video', 
      config: config
    };

    if (referenceImageBase64) {
        const cleanBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
        params.image = {
            imageBytes: cleanBase64,
            mimeType: 'image/png'
        };
    }

    let operation = await ai.models.generateVideos(params);

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("No video URI returned");
    }

    // 注意：视频下载部分可能需要特殊处理
    // 如果代理服务器不处理视频下载，可能需要直接使用原始Google链接
    let videoUrl = videoUri;
    
    // 检查URI是否是完整的URL，如果不是则构建完整URL
    if (!videoUri.startsWith('http')) {
      // 这里需要根据你的代理服务器调整
      // 如果代理服务器支持视频转发
      videoUrl = `https://geminikey.top/v1/video-proxy?uri=${encodeURIComponent(videoUri)}&key=${apiKey || process.env.API_KEY}`;
    } else if (videoUri.includes('googleapis.com')) {
      // 如果是Google原始链接，可以通过代理转发
      videoUrl = `https://geminikey.top/v1/video-proxy?uri=${encodeURIComponent(videoUri)}`;
    }
    
    const videoResponse = await fetch(videoUrl);
    
    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Gemini Video Generation Error:", error);
    throw error;
  }
};
