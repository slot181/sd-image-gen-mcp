import { AxiosInstance } from 'axios';
import { z } from 'zod';

// --- Interfaces (if specific structure is known, otherwise use 'any') ---
export interface SamplerInfo {
  name: string;
  aliases: string[];
  options: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getSamplersSchema = z.object({});

// Type alias for validated arguments (empty in this case)
export type ValidatedGetSamplersArgs = z.infer<typeof getSamplersSchema>;

// --- Main Handler Function ---
export async function handleGetSamplers(
  _args: ValidatedGetSamplersArgs, // Args are not used but kept for consistency
  axiosInstance: AxiosInstance
): Promise<{ content: { type: string; text: string }[] }> {
  const response = await axiosInstance.get('/sdapi/v1/samplers');
  // Assuming response.data is an array of objects like [{ name: "Euler a", aliases: [], options: {} }, ...]
  const samplers = Array.isArray(response.data)
    ? response.data.map((s: any) => s?.name).filter(Boolean) // eslint-disable-line @typescript-eslint/no-explicit-any
    : [];
  return { content: [{ type: 'text', text: JSON.stringify(samplers) }] };
}
