import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface GenerateImageArgs {
    prompt: string;
    negative_prompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    cfg_scale?: number;
    sampler_name?: string;
    scheduler_name?: string;
    seed?: number;
    batch_size?: number;
    restore_faces?: boolean;
    tiling?: boolean;
    output_path?: string;
    distilled_cfg_scale?: number;
}
export declare const generateImageSchema: z.ZodObject<{
    prompt: z.ZodString;
    negative_prompt: z.ZodOptional<z.ZodString>;
    steps: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    cfg_scale: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    sampler_name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    scheduler_name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    seed: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    batch_size: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    restore_faces: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    tiling: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    output_path: z.ZodOptional<z.ZodString>;
    distilled_cfg_scale: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    steps: number;
    width: number;
    height: number;
    cfg_scale: number;
    sampler_name: string;
    scheduler_name: string;
    seed: number;
    batch_size: number;
    restore_faces: boolean;
    tiling: boolean;
    distilled_cfg_scale: number;
    negative_prompt?: string | undefined;
    output_path?: string | undefined;
}, {
    prompt: string;
    negative_prompt?: string | undefined;
    steps?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    cfg_scale?: number | undefined;
    sampler_name?: string | undefined;
    scheduler_name?: string | undefined;
    seed?: number | undefined;
    batch_size?: number | undefined;
    restore_faces?: boolean | undefined;
    tiling?: boolean | undefined;
    output_path?: string | undefined;
    distilled_cfg_scale?: number | undefined;
}>;
export type ValidatedGenerateImageArgs = z.infer<typeof generateImageSchema>;
export declare function handleGenerateImage(args: ValidatedGenerateImageArgs, axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
