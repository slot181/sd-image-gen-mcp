import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface ModelInfo {
    title: string;
    model_name: string;
    hash: string;
    sha256: string;
    filename: string;
    config: string;
}
export declare const getModelsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ValidatedGetModelsArgs = z.infer<typeof getModelsSchema>;
export declare function handleGetModels(_args: ValidatedGetModelsArgs, // Args are not used but kept for consistency
axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
