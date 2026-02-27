import { API_KEY, BASE_URL } from "./auth.js";
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

// --- Model mapping ---

const MODELS = {
  flash: "gemini-2.5-flash-image",
  pro: "gemini-3-pro-image-preview",
} as const;

export type ModelChoice = keyof typeof MODELS;

export function resolveModel(choice: ModelChoice): string {
  return MODELS[choice];
}

// --- API Error ---

export class GeminiApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

// --- Core API request ---

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

export interface GenerateOptions {
  model: ModelChoice;
  parts: GeminiPart[];
  responseModalities: string[];
  aspectRatio?: string;
  imageSize?: string;
}

export async function generateContent(
  options: GenerateOptions,
): Promise<GeminiResponse> {
  const modelId = resolveModel(options.model);
  const url = `${BASE_URL}/models/${modelId}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    responseModalities: options.responseModalities,
  };

  if (
    options.responseModalities.includes("IMAGE") &&
    (options.aspectRatio || options.imageSize)
  ) {
    const imageConfig: Record<string, string> = {};
    if (options.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;
    if (options.imageSize) imageConfig.imageSize = options.imageSize;
    generationConfig.imageConfig = imageConfig;
  }

  const body = {
    contents: [{ role: "user", parts: options.parts }],
    generationConfig,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg =
      (error as Record<string, unknown>).message ||
      (error as { error?: { message?: string } }).error?.message ||
      response.statusText;

    if (response.status === 429) {
      throw new GeminiApiError(
        429,
        "Rate limit exceeded. Gemini image generation is limited to ~2-5 requests per minute. Try again in a moment.",
      );
    }

    throw new GeminiApiError(
      response.status,
      `Gemini API error (${response.status}): ${msg}`,
    );
  }

  return (await response.json()) as GeminiResponse;
}

// --- Image file helpers ---

export function readImageAsBase64(filePath: string): {
  data: string;
  mimeType: string;
} {
  const buffer = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  const mimeType = mimeMap[ext] || "image/png";
  return { data: buffer.toString("base64"), mimeType };
}

export function saveBase64Image(
  base64: string,
  outputDir: string,
): string {
  const timestamp = Date.now();
  const filename = `nano-banana-${timestamp}.png`;
  const filePath = join(outputDir, filename);
  const buffer = Buffer.from(base64, "base64");
  writeFileSync(filePath, buffer);
  return filePath;
}

// --- Response extraction ---

export interface ExtractedResult {
  text: string | null;
  imagePath: string | null;
}

export function extractResult(
  response: GeminiResponse,
  outputDir: string,
): ExtractedResult {
  const result: ExtractedResult = { text: null, imagePath: null };

  if (!response.candidates || response.candidates.length === 0) {
    if (response.error) {
      throw new GeminiApiError(
        response.error.code || 500,
        response.error.message,
      );
    }
    return result;
  }

  const parts = response.candidates[0].content.parts;
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.text) {
      textParts.push(part.text);
    }
    if (part.inlineData?.data) {
      result.imagePath = saveBase64Image(part.inlineData.data, outputDir);
    }
  }

  if (textParts.length > 0) {
    result.text = textParts.join("\n");
  }

  return result;
}

// --- Tool result helpers ---

export function toolResult(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

export function toolResultWithImage(data: unknown, base64: string) {
  return {
    content: [
      { type: "image" as const, data: base64, mimeType: "image/png" },
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

export function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}
