import { z } from 'zod';
// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getLorasSchema = z.object({});
// --- Main Handler Function ---
export async function handleGetLoras(_args, // Args are not used but kept for consistency
axiosInstance) {
    const response = await axiosInstance.get('/sdapi/v1/loras');
    // The original code directly stringified response.data.
    // It's better to ensure it's an array of LoraInfo for type safety if possible,
    // or at least an array of objects.
    const loras = Array.isArray(response.data) ? response.data : [];
    return { content: [{ type: 'text', text: JSON.stringify(loras) }] };
}
