import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { DEFAULT_OUTPUT_DIR, SD_RESIZE_MODE, SD_UPSCALE_MULTIPLIER, SD_UPSCALE_WIDTH, SD_UPSCALE_HEIGHT, SD_UPSCALER_1, SD_UPSCALER_2 } from '../config.js';
import { ensureDirectoryExists } from '../utils/fileUtils.js';
// --- Zod Schema for Input Validation ---
export const upscaleImagesSchema = z.object({
    images: z.array(z.string().min(1, "Image path cannot be empty")).min(1, "At least one image path is required"),
    resize_mode: z.number().int().min(0).max(1).optional().default(SD_RESIZE_MODE),
    upscaling_resize: z.number().min(1).optional().default(SD_UPSCALE_MULTIPLIER), // Multiplier
    upscaling_resize_w: z.number().int().min(1).optional().default(SD_UPSCALE_WIDTH), // Target width
    upscaling_resize_h: z.number().int().min(1).optional().default(SD_UPSCALE_HEIGHT), // Target height
    upscaler_1: z.string().optional().default(SD_UPSCALER_1),
    upscaler_2: z.string().optional().default(SD_UPSCALER_2),
    output_path: z.string().optional(),
});
// --- Helper Function (Consider moving to utils later) ---
// Removed ensureDirectoryExists as it will be imported
// --- Main Handler Function ---
export async function handleUpscaleImages(args, axiosInstance) {
    const outputDir = args.output_path ? path.normalize(args.output_path.trim()) : DEFAULT_OUTPUT_DIR;
    await ensureDirectoryExists(outputDir);
    const encodedImages = await Promise.all(args.images.map(async (imagePath) => {
        const data = await fs.promises.readFile(imagePath);
        return {
            data: data.toString('base64'),
            name: path.basename(imagePath),
        };
    }));
    const payload = {
        resize_mode: args.resize_mode,
        show_extras_results: true, // Default as in original
        gfpgan_visibility: 0, // Default as in original
        codeformer_visibility: 0, // Default as in original
        codeformer_weight: 0, // Default as in original
        upscaling_resize: args.upscaling_resize,
        upscaling_resize_w: args.upscaling_resize_w,
        upscaling_resize_h: args.upscaling_resize_h,
        upscaling_crop: true, // Default as in original
        upscaler_1: args.upscaler_1,
        upscaler_2: args.upscaler_2,
        extras_upscaler_2_visibility: 0, // Default as in original
        upscale_first: false, // Default as in original
        imageList: encodedImages,
    };
    const response = await axiosInstance.post('/sdapi/v1/extra-batch-images', payload);
    if (!response.data.images?.length) {
        throw new Error('No images upscaled by SD API');
    }
    const results = [];
    for (let i = 0; i < response.data.images.length; i++) {
        const imageData = response.data.images[i]; // This is base64 string
        // Ensure original filename is used for the upscaled version
        const originalFilename = path.basename(args.images[i]);
        const outputPath = path.join(outputDir, `upscaled_${originalFilename}`);
        await fs.promises.writeFile(outputPath, Buffer.from(imageData, 'base64'));
        results.push({ path: outputPath });
    }
    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}
