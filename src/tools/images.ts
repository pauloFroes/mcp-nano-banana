import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  generateContent,
  readImageAsBase64,
  extractResult,
  saveBase64Image,
  toolResult,
  toolResultWithImage,
  toolError,
} from "../client.js";

const MODEL_ENUM = z
  .enum(["flash", "pro"])
  .default("flash")
  .describe(
    'Model to use. "flash" = gemini-2.5-flash (fast, cheap, 1K max). "pro" = gemini-3-pro (high quality, up to 4K).',
  );

const ASPECT_RATIO_ENUM = z
  .enum([
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "21:9",
    "4:5",
    "5:4",
  ])
  .default("1:1")
  .describe("Aspect ratio of the generated image");

const IMAGE_SIZE_ENUM = z
  .enum(["1K", "2K", "4K"])
  .default("1K")
  .describe(
    'Image resolution. "1K" = 1024px, "2K" = 2048px, "4K" = 4096px. 2K/4K only available with "pro" model.',
  );

const OUTPUT_DIR_SCHEMA = z
  .string()
  .default(".")
  .describe(
    "Directory where generated images will be saved. Defaults to current working directory.",
  );

export function registerImageTools(server: McpServer) {
  // --- Text-to-Image ---
  server.registerTool(
    "generate_image",
    {
      title: "Generate Image",
      description:
        "Generate an image from a text prompt using Google Gemini (Nano Banana). Returns the generated image and saves it as a PNG file.",
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe(
            "Text prompt describing the image to generate. English prompts produce best results.",
          ),
        model: MODEL_ENUM,
        aspect_ratio: ASPECT_RATIO_ENUM,
        image_size: IMAGE_SIZE_ENUM,
        output_dir: OUTPUT_DIR_SCHEMA,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ prompt, model, aspect_ratio, image_size, output_dir }) => {
      try {
        const response = await generateContent({
          model,
          parts: [{ text: prompt }],
          responseModalities: ["TEXT", "IMAGE"],
          aspectRatio: aspect_ratio,
          imageSize: image_size,
        });

        const result = extractResult(response, output_dir);

        if (!result.imagePath) {
          return toolError(
            "No image was generated. The model may have refused the prompt due to safety filters. Try rephrasing.",
          );
        }

        // Return image inline + metadata
        const candidates = response.candidates!;
        const imagePart = candidates[0].content.parts.find(
          (p) => p.inlineData?.data,
        );

        return toolResultWithImage(
          {
            saved_to: result.imagePath,
            model,
            aspect_ratio,
            image_size,
            description: result.text,
          },
          imagePart!.inlineData!.data,
        );
      } catch (error) {
        return toolError(
          `Failed to generate image: ${(error as Error).message}`,
        );
      }
    },
  );

  // --- Image-to-Image (Edit) ---
  server.registerTool(
    "edit_image",
    {
      title: "Edit Image",
      description:
        "Edit or transform an existing image using a text instruction. Supports style transfer, object manipulation, background changes, and more.",
      inputSchema: {
        image_path: z
          .string()
          .min(1)
          .describe("Absolute path to the source image file to edit"),
        instruction: z
          .string()
          .min(1)
          .describe(
            'Text instruction describing the desired edit (e.g., "make it look like a watercolor painting", "remove the background", "add sunglasses")',
          ),
        model: MODEL_ENUM,
        aspect_ratio: ASPECT_RATIO_ENUM.optional().describe(
          "Aspect ratio override. If omitted, preserves original proportions.",
        ),
        image_size: IMAGE_SIZE_ENUM,
        output_dir: OUTPUT_DIR_SCHEMA,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({
      image_path,
      instruction,
      model,
      aspect_ratio,
      image_size,
      output_dir,
    }) => {
      try {
        const img = readImageAsBase64(image_path);

        const response = await generateContent({
          model,
          parts: [
            { inlineData: { mimeType: img.mimeType, data: img.data } },
            { text: instruction },
          ],
          responseModalities: ["TEXT", "IMAGE"],
          aspectRatio: aspect_ratio,
          imageSize: image_size,
        });

        const result = extractResult(response, output_dir);

        if (!result.imagePath) {
          return toolError(
            "No image was generated. The model may have refused the edit. Try a different instruction.",
          );
        }

        const candidates = response.candidates!;
        const imagePart = candidates[0].content.parts.find(
          (p) => p.inlineData?.data,
        );

        return toolResultWithImage(
          {
            saved_to: result.imagePath,
            source: image_path,
            instruction,
            model,
            description: result.text,
          },
          imagePart!.inlineData!.data,
        );
      } catch (error) {
        return toolError(
          `Failed to edit image: ${(error as Error).message}`,
        );
      }
    },
  );

  // --- Multi-image Composition ---
  server.registerTool(
    "compose_images",
    {
      title: "Compose Images",
      description:
        "Combine multiple source images into a new image using a text instruction. Supports blending, collage, style mixing, and creative composition with up to 9 images (14 with pro model).",
      inputSchema: {
        image_paths: z
          .array(z.string())
          .min(1)
          .max(14)
          .describe(
            "Array of absolute paths to source image files (1-9 for flash, up to 14 for pro)",
          ),
        instruction: z
          .string()
          .min(1)
          .describe(
            'Text instruction describing how to combine the images (e.g., "blend these photos into a panorama", "create a collage with all images")',
          ),
        model: MODEL_ENUM,
        aspect_ratio: ASPECT_RATIO_ENUM,
        image_size: IMAGE_SIZE_ENUM,
        output_dir: OUTPUT_DIR_SCHEMA,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({
      image_paths,
      instruction,
      model,
      aspect_ratio,
      image_size,
      output_dir,
    }) => {
      try {
        const parts = image_paths.map((path) => {
          const img = readImageAsBase64(path);
          return {
            inlineData: { mimeType: img.mimeType, data: img.data },
          };
        });

        const response = await generateContent({
          model,
          parts: [...parts, { text: instruction }],
          responseModalities: ["TEXT", "IMAGE"],
          aspectRatio: aspect_ratio,
          imageSize: image_size,
        });

        const result = extractResult(response, output_dir);

        if (!result.imagePath) {
          return toolError(
            "No image was generated from composition. Try a different instruction.",
          );
        }

        const candidates = response.candidates!;
        const imagePart = candidates[0].content.parts.find(
          (p) => p.inlineData?.data,
        );

        return toolResultWithImage(
          {
            saved_to: result.imagePath,
            sources: image_paths,
            instruction,
            model,
            description: result.text,
          },
          imagePart!.inlineData!.data,
        );
      } catch (error) {
        return toolError(
          `Failed to compose images: ${(error as Error).message}`,
        );
      }
    },
  );

  // --- Image-to-Text (Describe) ---
  server.registerTool(
    "describe_image",
    {
      title: "Describe Image",
      description:
        "Analyze and describe the content of an image using Gemini vision. Returns a detailed text description.",
      inputSchema: {
        image_path: z
          .string()
          .min(1)
          .describe("Absolute path to the image file to describe"),
        prompt: z
          .string()
          .default("Describe this image in detail.")
          .describe(
            "Custom prompt for the description. Defaults to a general detailed description.",
          ),
        model: MODEL_ENUM,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ image_path, prompt, model }) => {
      try {
        const img = readImageAsBase64(image_path);

        const response = await generateContent({
          model,
          parts: [
            { inlineData: { mimeType: img.mimeType, data: img.data } },
            { text: prompt },
          ],
          responseModalities: ["TEXT"],
        });

        if (
          !response.candidates ||
          response.candidates.length === 0
        ) {
          return toolError("No description was generated.");
        }

        const textParts = response.candidates[0].content.parts
          .filter((p) => p.text)
          .map((p) => p.text!)
          .join("\n");

        return toolResult({
          image_path,
          description: textParts,
          model,
        });
      } catch (error) {
        return toolError(
          `Failed to describe image: ${(error as Error).message}`,
        );
      }
    },
  );
}
