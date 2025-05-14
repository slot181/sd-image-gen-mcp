import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'; // For error handling
// --- Zod Schema for Input Validation ---
export const setModelSchema = z.object({
    model_name: z.string().min(1, "Model name cannot be empty"),
});
// --- Main Handler Function ---
export async function handleSetModel(args, axiosInstance) {
    try {
        // Call the API to set the model.
        // The original code had a longer timeout specifically for this,
        // but axiosInstance already has a global timeout from config.
        // If a specific longer timeout is needed here, a new Axios instance
        // or a temporary override in the request config would be required.
        // For now, using the global timeout.
        await axiosInstance.post('/sdapi/v1/options', {
            sd_model_checkpoint: args.model_name
        });
        return { content: [{ type: 'text', text: `Model successfully set to: ${args.model_name}` }] };
    }
    catch (error) {
        console.error("[sd-image-gen-mcp/setModel] Error setting SD model via API:", error);
        let errorMessage = 'Unknown error occurred while setting model.';
        if (error.isAxiosError) { // Check if it's an AxiosError
            if (error.response) {
                errorMessage = `API returned status ${error.response.status}. Details: ${JSON.stringify(error.response.data)}`;
            }
            else if (error.request) {
                if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                    errorMessage = `Request timed out while setting model. The model might still be loading in the background. Error: ${error.message}`;
                }
                else {
                    errorMessage = `No response received from SD API server. Error: ${error.message}`;
                }
            }
            else {
                errorMessage = error.message || 'Failed to send request to SD API.';
            }
        }
        else if (error instanceof Error) {
            errorMessage = error.message;
        }
        // It's good practice to throw McpError for consistency with the SDK
        throw new McpError(ErrorCode.InternalError, `Error calling SD API to set model: ${errorMessage}`);
    }
}
