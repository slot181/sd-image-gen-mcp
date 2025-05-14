#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
// --- Configuration ---
import { SD_WEBUI_URL, AUTH_USER, AUTH_PASS, REQUEST_TIMEOUT, } from './config.js';
// --- Tool Imports ---
import { generateImageSchema, handleGenerateImage } from './tools/generateImage.js';
import { getModelsSchema, handleGetModels } from './tools/getModels.js';
import { setModelSchema, handleSetModel } from './tools/setModel.js';
import { getUpscalersSchema, handleGetUpscalers } from './tools/getUpscalers.js';
import { getSamplersSchema, handleGetSamplers } from './tools/getSamplers.js';
import { getLorasSchema, handleGetLoras } from './tools/getLoras.js';
import { upscaleImagesSchema, handleUpscaleImages } from './tools/upscaleImages.js';
// --- Initialization ---
// Validate essential configuration (optional, can be expanded)
if (!SD_WEBUI_URL) {
    console.error('[sd-image-gen-mcp] Error: Stable Diffusion WebUI URL (SD_WEBUI_URL) is not configured.');
    process.exit(1);
}
// Create Axios instance for SD WebUI API calls
const axiosConfig = {
    baseURL: SD_WEBUI_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: REQUEST_TIMEOUT,
};
if (AUTH_USER && AUTH_PASS) {
    axiosConfig.auth = { username: AUTH_USER, password: AUTH_PASS };
}
const axiosInstance = axios.create(axiosConfig);
// Create the MCP Server instance
const server = new Server({ name: 'sd-image-gen-mcp', version: '1.1.3' }, // Updated version after refactor
{ capabilities: { tools: {} } });
// --- Tool Definitions (using imported Zod schemas for structure) ---
// The actual JSON schema for ListTools will be derived from these Zod schemas by the SDK,
// or we can manually construct them if more control over the ListTools output is needed.
// For simplicity, we'll rely on the SDK's Zod-to-JSON-Schema conversion if available,
// or manually define them like in gemini-integrator-mcp if needed for exact ListTools output.
// For now, let's define them manually for ListTools to match gemini-integrator-mcp style.
const toolDefinitions = [
    {
        name: 'generate_sd_image',
        description: 'Generate an image using Stable Diffusion',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'The prompt describing the desired image' },
                negative_prompt: { type: 'string', description: 'Specify elements to exclude. Default: (standard list of negative embeddings)' },
                steps: { type: 'number', description: 'Number of sampling steps (default: 20)', minimum: 1, maximum: 150 },
                width: { type: 'number', description: 'Image width (default: 1024)', minimum: 512, maximum: 2048 },
                height: { type: 'number', description: 'Image height (default: 1024)', minimum: 512, maximum: 2048 },
                cfg_scale: { type: 'number', description: 'CFG scale (default: 3.5)', minimum: 1, maximum: 30 },
                sampler_name: { type: 'string', description: 'Sampling algorithm (default: Euler a)' },
                scheduler_name: { type: 'string', description: 'Scheduler algorithm (default: Automatic)' },
                seed: { type: 'number', description: 'Random seed (-1 for random)', minimum: -1 },
                batch_size: { type: 'number', description: 'Number of images to generate (default: 1)', minimum: 1, maximum: 4 },
                restore_faces: { type: 'boolean', description: 'Enable face restoration (default: false)' },
                tiling: { type: 'boolean', description: 'Generate tileable images (default: false)' },
                output_path: { type: 'string', description: 'Custom output path for the generated image(s)' },
                distilled_cfg_scale: { type: 'number', description: 'Distilled CFG scale (default: 3.5)', minimum: 1, maximum: 30 },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'get_sd_models',
        description: 'Retrieves a list of available Stable Diffusion models.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'set_sd_model',
        description: 'Set the active Stable Diffusion model',
        inputSchema: {
            type: 'object',
            properties: { model_name: { type: 'string', description: 'Name of the model to set as active' } },
            required: ['model_name'],
        },
    },
    {
        name: 'get_sd_upscalers',
        description: 'Retrieves a list of available image upscaler models.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_sd_samplers',
        description: 'Get list of available samplers',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_sd_loras',
        description: 'Get list of available LoRA models',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'upscale_sd_images',
        description: 'Upscale one or more images using Stable Diffusion',
        inputSchema: {
            type: 'object',
            properties: {
                images: { type: 'array', items: { type: 'string' }, description: 'Array of image file paths to upscale' },
                resize_mode: { type: 'number', enum: [0, 1], description: '0 for multiplier (default), 1 for dimensions' },
                upscaling_resize: { type: 'number', description: 'Upscale multiplier (default: 2)' },
                upscaling_resize_w: { type: 'number', description: 'Target width (default: 2048)' },
                upscaling_resize_h: { type: 'number', description: 'Target height (default: 2048)' },
                upscaler_1: { type: 'string', description: 'Primary upscaler (default: R-ESRGAN 4x+)' },
                upscaler_2: { type: 'string', description: 'Secondary upscaler (default: None)' },
                output_path: { type: 'string', description: 'Custom output directory for upscaled image(s)' },
            },
            required: ['images'],
        },
    },
];
// --- Request Handlers ---
// Handle ListTools request
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
}));
// Handle CallTool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`[sd-image-gen-mcp] Received call for tool: ${name} with args:`, JSON.stringify(args));
    // Define a map for Zod schemas for validation
    const toolValidationSchemas = {
        'generate_sd_image': generateImageSchema,
        'get_sd_models': getModelsSchema,
        'set_sd_model': setModelSchema,
        'get_sd_upscalers': getUpscalersSchema,
        'get_sd_samplers': getSamplersSchema,
        'get_sd_loras': getLorasSchema,
        'upscale_sd_images': upscaleImagesSchema,
    };
    const schema = toolValidationSchemas[name];
    if (!schema) {
        throw new McpError(ErrorCode.MethodNotFound, `Schema not found for tool '${name}'.`);
    }
    const validationResult = schema.safeParse(args || {});
    if (!validationResult.success) {
        const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        console.error(`[sd-image-gen-mcp] Invalid arguments for tool '${name}': ${errorDetails}`);
        throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for tool '${name}': ${errorDetails}`);
    }
    const validatedArgs = validationResult.data;
    console.log(`[sd-image-gen-mcp] Arguments validated successfully for tool: ${name}`);
    try {
        switch (name) {
            case 'generate_sd_image':
                return await handleGenerateImage(validatedArgs, axiosInstance);
            case 'get_sd_models':
                return await handleGetModels(validatedArgs, axiosInstance);
            case 'set_sd_model':
                return await handleSetModel(validatedArgs, axiosInstance);
            case 'get_sd_upscalers':
                return await handleGetUpscalers(validatedArgs, axiosInstance);
            case 'get_sd_samplers':
                return await handleGetSamplers(validatedArgs, axiosInstance);
            case 'get_sd_loras':
                return await handleGetLoras(validatedArgs, axiosInstance);
            case 'upscale_sd_images':
                return await handleUpscaleImages(validatedArgs, axiosInstance);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Tool '${name}' not found or handler not implemented.`);
        }
    }
    catch (error) {
        console.error(`[sd-image-gen-mcp] Error executing tool '${name}':`, error);
        if (error instanceof McpError) {
            throw error;
        }
        else if (axios.isAxiosError(error)) {
            const message = error.response
                ? `API error: ${error.response.status} ${JSON.stringify(error.response.data?.error || error.response.data || error.message)}`
                : error.request
                    ? `No response from API: ${error.message}`
                    : `Axios request error: ${error.message}`;
            throw new McpError(ErrorCode.InternalError, message);
        }
        else if (error instanceof Error) {
            throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error.message}`);
        }
        else {
            throw new McpError(ErrorCode.InternalError, `Unknown error executing tool ${name}.`);
        }
    }
});
// --- Server Connection & Global Error Handling ---
process.on('SIGINT', async () => {
    console.log('[sd-image-gen-mcp] Received SIGINT. Shutting down server...');
    await server.close();
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[sd-image-gen-mcp] Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally exit or log more details
});
process.on('uncaughtException', (err, origin) => {
    console.error(`[sd-image-gen-mcp] Uncaught Exception: ${err.message} at ${origin}. Stack: ${err.stack}`);
    // Graceful shutdown attempt, then exit
    server.close().finally(() => process.exit(1));
});
async function startServer() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('[sd-image-gen-mcp] Stable Diffusion Image Gen MCP Server started successfully.');
    }
    catch (error) {
        console.error('[sd-image-gen-mcp] Error starting server:', error);
        process.exit(1);
    }
}
console.log('[sd-image-gen-mcp] Attempting to start Stable Diffusion Image Gen MCP Server...');
startServer();
