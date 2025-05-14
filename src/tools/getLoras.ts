import { AxiosInstance } from 'axios';
import { z } from 'zod';

// --- Interfaces (if specific structure is known, otherwise use 'any') ---
// Based on original code: [{ name: "lora_name", alias: "...", path: "...", metadata: {} }, ...]
export interface LoraInfo {
  name: string;
  alias: string;
  path: string;
  metadata?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getLorasSchema = z.object({});

// Type alias for validated arguments (empty in this case)
export type ValidatedGetLorasArgs = z.infer<typeof getLorasSchema>;

// --- Main Handler Function ---
export async function handleGetLoras(
  _args: ValidatedGetLorasArgs, // Args are not used but kept for consistency
  axiosInstance: AxiosInstance
): Promise<{ content: { type: string; text: string }[] }> {
  const response = await axiosInstance.get('/sdapi/v1/loras');
  // The original code directly stringified response.data.
  // It's better to ensure it's an array of LoraInfo for type safety if possible,
  // or at least an array of objects.
  const loras = Array.isArray(response.data) ? response.data : [];
  return { content: [{ type: 'text', text: JSON.stringify(loras) }] };
}
