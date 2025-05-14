import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface SamplerInfo {
    name: string;
    aliases: string[];
    options: Record<string, any>;
}
export declare const getSamplersSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ValidatedGetSamplersArgs = z.infer<typeof getSamplersSchema>;
export declare function handleGetSamplers(_args: ValidatedGetSamplersArgs, // Args are not used but kept for consistency
axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
