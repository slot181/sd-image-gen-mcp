import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface UpscalerInfo {
    name: string;
    model_name: string;
    model_path: string;
    model_url: string;
    scale: number;
}
export declare const getUpscalersSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ValidatedGetUpscalersArgs = z.infer<typeof getUpscalersSchema>;
export declare function handleGetUpscalers(_args: ValidatedGetUpscalersArgs, // Args are not used but kept for consistency
axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
