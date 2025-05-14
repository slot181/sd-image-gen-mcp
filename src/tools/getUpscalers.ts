import { AxiosInstance } from 'axios';
import { z } from 'zod';

// --- Interfaces ---
export interface UpscalerInfo {
  name: string;
  model_name: string; // Can be null
  model_path: string; // Can be null
  model_url: string;  // Can be null
  scale: number;
}

// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getUpscalersSchema = z.object({});

// Type alias for validated arguments (empty in this case)
export type ValidatedGetUpscalersArgs = z.infer<typeof getUpscalersSchema>;

// --- Main Handler Function ---
export async function handleGetUpscalers(
  _args: ValidatedGetUpscalersArgs, // Args are not used but kept for consistency
  axiosInstance: AxiosInstance
): Promise<{ content: { type: string; text: string }[] }> {
  const response = await axiosInstance.get('/sdapi/v1/upscalers');
  const upscalers = response.data as UpscalerInfo[];
  // We return only the names as per the original logic
  return { content: [{ type: 'text', text: JSON.stringify(upscalers.map(u => u.name)) }] };
}
