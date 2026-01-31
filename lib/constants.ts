export const COMIC_STYLES = [
  {
    id: "american-modern",
    name: "American Modern",
    prompt: "contemporary American superhero comic style, bold vibrant colors, dynamic heroic poses, detailed muscular anatomy, cinematic action scenes, modern digital art",
  },
  {
    id: "manga",
    name: "Manga",
    prompt: "Japanese manga style, clean precise black linework, screen tone shading, expressive eyes, dynamic speed lines, black and white with impact effects",
  },
  {
    id: "noir",
    name: "Noir",
    prompt: "film noir style, high contrast black and white, deep dramatic shadows, 1940s detective aesthetic, heavy bold inking, moody atmospheric lighting",
  },
  {
    id: "vintage",
    name: "Vintage",
    prompt: "Golden Age 1950s comic style, visible halftone Ben-Day dots, limited retro color palette, nostalgic warm tones, classic adventure comics",
  },
] as const;

// AI Image Generation Models
export const FAST_MODEL = "google/flash-image-2.5";
export const PRO_MODEL = "google/gemini-3-pro-image";

export const FAST_DIMENSIONS = { width: 864, height: 1184 };
export const PRO_DIMENSIONS = { width: 896, height: 1200 };

// Estimated generation times (in seconds)
export const FAST_MODEL_ESTIMATED_SECONDS = 15;
export const PRO_MODEL_ESTIMATED_SECONDS = 30;

export function getEstimatedSeconds(modelMode: "fast" | "pro"): number {
  return modelMode === "pro" ? PRO_MODEL_ESTIMATED_SECONDS : FAST_MODEL_ESTIMATED_SECONDS;
}