import axios, { AxiosInstance } from 'axios'; // Import main axios for downloading
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto'; // For generating temp filenames
import { z } from 'zod';
import {
  DEFAULT_OUTPUT_DIR,
  SD_RESIZE_MODE,
  SD_UPSCALE_MULTIPLIER,
  SD_UPSCALE_WIDTH,
  SD_UPSCALE_HEIGHT,
  SD_UPSCALER_1,
  SD_UPSCALER_2,
  CF_IMGBED_UPLOAD_URL, // For checking if upload is configured
  CF_IMGBED_API_KEY   // For checking if upload is configured
} from '../config.js';
import { ensureDirectoryExists } from '../utils/fileUtils.js';
import { uploadToCfImgbed } from '../utils/cfUtils.js'; // Import the upload function

// --- Interfaces ---
export interface UpscaleImagesArgs {
  images: string[]; // Array of image file paths
  resize_mode?: string; // Changed to string
  upscaling_resize?: number; // Multiplier
  upscaling_resize_w?: number; // Target width
  upscaling_resize_h?: number; // Target height
  upscaler_1?: string;
  upscaler_2?: string;
  output_path?: string;
}

interface UpscaleImagePayload {
  resize_mode: number;
  show_extras_results: boolean;
  gfpgan_visibility: number;
  codeformer_visibility: number;
  codeformer_weight: number;
  upscaling_resize: number;
  upscaling_resize_w: number;
  upscaling_resize_h: number;
  upscaling_crop: boolean;
  upscaler_1: string;
  upscaler_2: string;
  extras_upscaler_2_visibility: number;
  upscale_first: boolean;
  imageList: Array<{
    data: string; // base64 encoded image
    name: string;
  }>;
}

// --- Zod Schema for Input Validation ---
export const upscaleImagesSchema = z.object({
  images: z.array(z.string().min(1, "Image path cannot be empty")).min(1, "At least one image path is required"),
  resize_mode: z.enum(["0", "1"]).optional().default(SD_RESIZE_MODE.toString() as "0" | "1"), // Changed to string enum
  upscaling_resize: z.number().min(1).optional().default(SD_UPSCALE_MULTIPLIER), // Multiplier
  upscaling_resize_w: z.number().int().min(1).optional().default(SD_UPSCALE_WIDTH), // Target width
  upscaling_resize_h: z.number().int().min(1).optional().default(SD_UPSCALE_HEIGHT), // Target height
  upscaler_1: z.string().optional().default(SD_UPSCALER_1),
  upscaler_2: z.string().optional().default(SD_UPSCALER_2),
  output_path: z.string().optional(),
});

// Type alias for validated arguments
export type ValidatedUpscaleImagesArgs = z.infer<typeof upscaleImagesSchema>;

// --- Helper Function for sanitizing filename components ---
function sanitizeFilenameComponent(name: string, maxLength: number = 50): string {
  if (!name) {
    return `random_${randomUUID().substring(0, 8)}`;
  }
  let sanitized = name.substring(0, maxLength);
  // Allow letters, numbers, underscore, hyphen, dot. Replace others with underscore.
  sanitized = sanitized.replace(/[^\p{L}\p{N}._-]/gu, '_').replace(/\s+/g, '_');
  sanitized = sanitized.replace(/__+/g, '_'); // Collapse multiple underscores
  sanitized = sanitized.replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores

  // Ensure it's not empty or just dots/underscores
  return sanitized.replace(/^\.+$/, `random_${randomUUID().substring(0,8)}`) || `component_${randomUUID().substring(0,8)}`;
}

// --- Main Handler Function ---
export async function handleUpscaleImages(
  args: ValidatedUpscaleImagesArgs,
  axiosInstance: AxiosInstance
): Promise<{ content: { type: string; text: string }[] }> {
  const outputDir = args.output_path ? path.normalize(args.output_path.trim()) : DEFAULT_OUTPUT_DIR;
  const tmpDir = path.join(DEFAULT_OUTPUT_DIR, 'tmp');
  await ensureDirectoryExists(outputDir); // Ensure main output dir exists
  // tmpDir will be ensured by ensureDirectoryExists if used

  const processedImagePaths: string[] = [];
  const tempFilesToDelete: string[] = [];

  try {
    for (const imagePathOrUrl of args.images) {
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        await ensureDirectoryExists(tmpDir); // Ensure tmp dir exists before writing
        console.log(`[upscaleImages] Downloading image from URL: ${imagePathOrUrl}`);
        const response = await axios.get(imagePathOrUrl, { responseType: 'arraybuffer' });
        
        let baseTempName = `download`;
        let tempExt = '.tmp';
        try {
          const urlObj = new URL(imagePathOrUrl);
          const originalUrlFilename = path.basename(urlObj.pathname);
          if (originalUrlFilename && originalUrlFilename !== '/') {
            tempExt = path.extname(originalUrlFilename) || tempExt;
            baseTempName = sanitizeFilenameComponent(path.parse(originalUrlFilename).name, 30); // Truncate base name
          }
        } catch (e) {
          console.warn(`[upscaleImages] Could not parse filename/ext from URL ${imagePathOrUrl}, using defaults.`);
        }
        const tempFilename = `${baseTempName}_${randomUUID().substring(0,8)}${tempExt}`;
        const tempFilePath = path.join(tmpDir, tempFilename);

        await fs.promises.writeFile(tempFilePath, Buffer.from(response.data));
        processedImagePaths.push(tempFilePath);
        tempFilesToDelete.push(tempFilePath);
        console.log(`[upscaleImages] Downloaded to temporary file: ${tempFilePath}`);
      } else {
        // Check if local file exists before adding
        try {
            await fs.promises.access(imagePathOrUrl, fs.constants.F_OK);
            processedImagePaths.push(imagePathOrUrl);
        } catch (err) {
            console.warn(`[upscaleImages] Local file not found or inaccessible: ${imagePathOrUrl}. Skipping.`);
            // Optionally, throw an error or handle this case as per requirements
        }
      }
    }

    if (processedImagePaths.length === 0) {
        throw new Error("No valid images to process after checking paths and URLs.");
    }

    const encodedImages = await Promise.all(
      processedImagePaths.map(async (filePath) => {
        const data = await fs.promises.readFile(filePath);
        return {
          data: data.toString('base64'),
          name: path.basename(filePath),
        };
      })
    );

    const payload: UpscaleImagePayload = {
    resize_mode: parseInt(args.resize_mode), // Convert string to number
    show_extras_results: true, // Default as in original
    gfpgan_visibility: 0,    // Default as in original
    codeformer_visibility: 0,// Default as in original
    codeformer_weight: 0,    // Default as in original
    upscaling_resize: args.upscaling_resize,
    upscaling_resize_w: args.upscaling_resize_w,
    upscaling_resize_h: args.upscaling_resize_h,
    upscaling_crop: true,    // Default as in original
    upscaler_1: args.upscaler_1,
    upscaler_2: args.upscaler_2,
    extras_upscaler_2_visibility: 0, // Default as in original
    upscale_first: false,    // Default as in original
    imageList: encodedImages,
  };

  const response = await axiosInstance.post('/sdapi/v1/extra-batch-images', payload);
  if (!response.data.images?.length) {
    throw new Error('No images upscaled by SD API');
  }

    const results = [];
    for (let i = 0; i < response.data.images.length; i++) {
      const imageData = response.data.images[i]; // This is base64 string
      // Ensure original filename is used for the upscaled version, based on processedImagePaths
      const originalProcessedPath = processedImagePaths[i]; 
      const baseOriginalName = path.parse(originalProcessedPath).name; // Get name without extension
      const originalExt = path.parse(originalProcessedPath).ext;       // Get extension
      
      // Sanitize and truncate the base name for the output file
      const sanitizedBaseOutputName = sanitizeFilenameComponent(baseOriginalName, 50);
      const outputFilename = `upscaled_${sanitizedBaseOutputName}${originalExt}`;
      const outputPath = path.join(outputDir, outputFilename);
      
      const imageBuffer = Buffer.from(imageData, 'base64');

    await fs.promises.writeFile(outputPath, imageBuffer);

    let uploadedUrl: string | null = null;
    // Check if ImgBed is configured before attempting upload
    if (CF_IMGBED_UPLOAD_URL && CF_IMGBED_API_KEY) {
      // For remote, we can use a slightly longer sanitized name if desired, but stick to outputFilename for consistency here
      // Or, create a separate remoteSanitizedBaseOutputName with a larger maxLength for uploadToCfImgbed if needed.
      // For now, using the same `outputFilename` for the upload.
      uploadedUrl = await uploadToCfImgbed(imageBuffer, outputFilename);
    }

    results.push({
        path: outputPath,
        url: uploadedUrl, // Add the URL to the result
      });
    }

    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  } finally {
    // Cleanup temporary files
    for (const tempFile of tempFilesToDelete) {
      try {
        await fs.promises.unlink(tempFile);
        console.log(`[upscaleImages] Deleted temporary file: ${tempFile}`);
      } catch (err) {
        console.warn(`[upscaleImages] Failed to delete temporary file ${tempFile}:`, err);
      }
    }
  }
}
