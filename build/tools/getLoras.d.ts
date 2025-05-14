import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface LoraInfo {
    name: string;
    alias: string;
    path: string;
    metadata?: Record<string, any>;
}
export declare const getLorasSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ValidatedGetLorasArgs = z.infer<typeof getLorasSchema>;
export declare function handleGetLoras(_args: ValidatedGetLorasArgs, // Args are not used but kept for consistency
axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
