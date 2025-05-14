import { AxiosInstance } from 'axios';
import { z } from 'zod';
export interface SetModelArgs {
    model_name: string;
}
export declare const setModelSchema: z.ZodObject<{
    model_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    model_name: string;
}, {
    model_name: string;
}>;
export type ValidatedSetModelArgs = z.infer<typeof setModelSchema>;
export declare function handleSetModel(args: ValidatedSetModelArgs, axiosInstance: AxiosInstance): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
