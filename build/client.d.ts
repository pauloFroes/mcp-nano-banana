declare const MODELS: {
    readonly flash: "gemini-2.5-flash-preview-image-generation";
    readonly pro: "gemini-3-pro-image-preview";
};
export type ModelChoice = keyof typeof MODELS;
export declare function resolveModel(choice: ModelChoice): string;
export declare class GeminiApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
interface GeminiPart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}
interface GeminiCandidate {
    content: {
        parts: GeminiPart[];
        role: string;
    };
}
interface GeminiResponse {
    candidates?: GeminiCandidate[];
    error?: {
        message: string;
        code: number;
    };
}
export interface GenerateOptions {
    model: ModelChoice;
    parts: GeminiPart[];
    responseModalities: string[];
    aspectRatio?: string;
    imageSize?: string;
}
export declare function generateContent(options: GenerateOptions): Promise<GeminiResponse>;
export declare function readImageAsBase64(filePath: string): {
    data: string;
    mimeType: string;
};
export declare function saveBase64Image(base64: string, outputDir: string): string;
export interface ExtractedResult {
    text: string | null;
    imagePath: string | null;
}
export declare function extractResult(response: GeminiResponse, outputDir: string): ExtractedResult;
export declare function toolResult(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function toolResultWithImage(data: unknown, base64: string): {
    content: ({
        type: "image";
        data: string;
        mimeType: string;
        text?: undefined;
    } | {
        type: "text";
        text: string;
        data?: undefined;
        mimeType?: undefined;
    })[];
};
export declare function toolError(message: string): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
};
export {};
