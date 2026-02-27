import { API_KEY, BASE_URL } from "./auth.js";
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
// --- Model mapping ---
const MODELS = {
    flash: "gemini-2.5-flash-preview-image-generation",
    pro: "gemini-3-pro-image-preview",
};
export function resolveModel(choice) {
    return MODELS[choice];
}
// --- API Error ---
export class GeminiApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "GeminiApiError";
    }
}
export async function generateContent(options) {
    const modelId = resolveModel(options.model);
    const url = `${BASE_URL}/models/${modelId}:generateContent`;
    const generationConfig = {
        responseModalities: options.responseModalities,
    };
    if (options.responseModalities.includes("IMAGE") &&
        (options.aspectRatio || options.imageSize)) {
        const imageConfig = {};
        if (options.aspectRatio)
            imageConfig.aspectRatio = options.aspectRatio;
        if (options.imageSize)
            imageConfig.imageSize = options.imageSize;
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
        const msg = error.message ||
            error.error?.message ||
            response.statusText;
        if (response.status === 429) {
            throw new GeminiApiError(429, "Rate limit exceeded. Gemini image generation is limited to ~2-5 requests per minute. Try again in a moment.");
        }
        throw new GeminiApiError(response.status, `Gemini API error (${response.status}): ${msg}`);
    }
    return (await response.json());
}
// --- Image file helpers ---
export function readImageAsBase64(filePath) {
    const buffer = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    const mimeMap = {
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
export function saveBase64Image(base64, outputDir) {
    const timestamp = Date.now();
    const filename = `nano-banana-${timestamp}.png`;
    const filePath = join(outputDir, filename);
    const buffer = Buffer.from(base64, "base64");
    writeFileSync(filePath, buffer);
    return filePath;
}
export function extractResult(response, outputDir) {
    const result = { text: null, imagePath: null };
    if (!response.candidates || response.candidates.length === 0) {
        if (response.error) {
            throw new GeminiApiError(response.error.code || 500, response.error.message);
        }
        return result;
    }
    const parts = response.candidates[0].content.parts;
    const textParts = [];
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
export function toolResult(data) {
    return {
        content: [
            { type: "text", text: JSON.stringify(data, null, 2) },
        ],
    };
}
export function toolResultWithImage(data, base64) {
    return {
        content: [
            { type: "image", data: base64, mimeType: "image/png" },
            { type: "text", text: JSON.stringify(data, null, 2) },
        ],
    };
}
export function toolError(message) {
    return {
        isError: true,
        content: [{ type: "text", text: message }],
    };
}
