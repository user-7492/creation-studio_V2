export enum AspectRatio {
  Square = "1:1",
  Portrait = "3:4",
  Landscape = "4:3",
  Wide = "16:9",
  Tall = "9:16"
}

export type MediaType = 'image' | 'video';

export interface GeneratedItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  type: MediaType;
}

export enum GenerationMode {
  Video = "video",
  Image = "image",
  DigitalHuman = "digital_human",
  Motion = "motion"
}

export interface StylePreset {
  id: string;
  name: string;
  promptSuffix: string;
  previewUrl: string;
}
