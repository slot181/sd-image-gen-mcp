import { z } from 'zod';
// --- Zod Schema for Input Validation (No specific inputs for this tool) ---
export const getModelsSchema = z.object({});
// --- Main Handler Function ---
export async function handleGetModels(_args, // Args are not used but kept for consistency
axiosInstance) {
    const response = await axiosInstance.get('/sdapi/v1/sd-models');
    const models = response.data;
    // We return only the titles as per the original logic
    return { content: [{ type: 'text', text: JSON.stringify(models.map(m => m.title)) }] };
}
