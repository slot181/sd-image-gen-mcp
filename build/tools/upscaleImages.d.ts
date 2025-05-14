import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface UpscaleImagesArgs {
    images: string[];
    resize_mode?: number;
    upscaling_resize?: number;
    upscaling_resize_w?: number;
    upscaling_resize_h?: number;
    upscaler_1?: string;
    upscaler_2?: string;
    output_path?: string;
}
export declare const upscaleImagesSchema: z.ZodObject<{
    images: z.ZodArray<z.ZodString, "many">;
    resize_mode: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    upscaling_resize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    upscaling_resize_w: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    upscaling_resize_h: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    upscaler_1: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    upscaler_2: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    output_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    images: string[];
    resize_mode: number;
    upscaling_resize: number;
    upscaling_resize_w: number;
    upscaling_resize_h: number;
    upscaler_1: string;
    upscaler_2: string;
    output_path?: string | undefined;
}, {
    images: string[];
    output_path?: string | undefined;
    resize_mode?: number | undefined;
    upscaling_resize?: number | undefined;
    upscaling_resize_w?: number | undefined;
    upscaling_resize_h?: number | undefined;
    upscaler_1?: string | undefined;
    upscaler_2?: string | undefined;
}>;
export type ValidatedUpscaleImagesArgs = z.infer<typeof upscaleImagesSchema>;
export declare function handleUpscaleImages(args: ValidatedUpscaleImagesArgs, axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
