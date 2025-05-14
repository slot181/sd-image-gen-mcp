import { z } from 'zod';
// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getUpscalersSchema = z.object({});
// --- Main Handler Function ---
export async function handleGetUpscalers(_args, // Args are not used but kept for consistency
axiosInstance) {
    const response = await axiosInstance.get('/sdapi/v1/upscalers');
    const upscalers = response.data;
    // We return only the names as per the original logic
    return { content: [{ type: 'text', text: JSON.stringify(upscalers.map(u => u.name)) }] };
}
