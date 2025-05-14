import { z } from 'zod';
// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getSamplersSchema = z.object({});
// --- Main Handler Function ---
export async function handleGetSamplers(_args, // Args are not used but kept for consistency
axiosInstance) {
    const response = await axiosInstance.get('/sdapi/v1/samplers');
    // Assuming response.data is an array of objects like [{ name: "Euler a", aliases: [], options: {} }, ...]
    const samplers = Array.isArray(response.data)
        ? response.data.map((s) => s?.name).filter(Boolean) // eslint-disable-line @typescript-eslint/no-explicit-any
        : [];
    return { content: [{ type: 'text', text: JSON.stringify(samplers) }] };
}
