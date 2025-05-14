import { AxiosInstance } from 'axios';
import { z } from 'zod';

// --- Interfaces ---
export interface ModelInfo {
  title: string;
  model_name: string;
  hash: string;
  sha256: string;
  filename: string;
  config: string;
}

// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getModelsSchema = z.object({});

// Type alias for validated arguments (empty in this case)
export type ValidatedGetModelsArgs = z.infer<typeof getModelsSchema>;

// --- Main Handler Function ---
export async function handleGetModels(
  _args: ValidatedGetModelsArgs, // Args are not used but kept for consistency
  axiosInstance: AxiosInstance
): Promise<{ content: { type: string; text: string }[] }> {
  const response = await axiosInstance.get('/sdapi/v1/sd-models');
  const models = response.data as ModelInfo[];
  // We return only the titles as per the original logic
  return { content: [{ type: 'text', text: JSON.stringify(models.map(m => m.title)) }] };
}
