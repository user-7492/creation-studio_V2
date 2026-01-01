import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

// Helper to get a fresh instance with dynamic key
const getAI = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });

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
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
        throw new Error("No video URI returned");
    }

    // Fetch the actual video bytes using the URI + API Key
    // Use the custom key if provided, otherwise fallback to env
    const keyToUse = apiKey || process.env.API_KEY;
    const videoResponse = await fetch(`${videoUri}&key=${keyToUse}`);
    
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
