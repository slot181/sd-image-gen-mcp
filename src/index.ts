#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import FormData from 'form-data'; // <-- Import form-data

// Helper function to parse arguments in the format "-e KEY VALUE"
function parseCliArgs(argv: string[]): { [key: string]: string } {
  const args = argv.slice(2); // Skip node executable and script path
  const parsed: { [key: string]: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e' && i + 2 < args.length) {
      const key = args[i + 1];
      const value = args[i + 2];
      parsed[key] = value;
      i += 2; // Move index past the key and value
    }
  }
  return parsed;
}

const cliArgs = parseCliArgs(process.argv);

// Prioritize command-line args (-e), fall back to environment variables
const SD_WEBUI_URL = cliArgs.SD_WEBUI_URL || process.env.SD_WEBUI_URL || 'http://127.0.0.1:7860';
const AUTH_USER = cliArgs.SD_AUTH_USER || process.env.SD_AUTH_USER;
const AUTH_PASS = cliArgs.SD_AUTH_PASS || process.env.SD_AUTH_PASS;
const DEFAULT_OUTPUT_DIR = cliArgs.SD_OUTPUT_DIR || process.env.SD_OUTPUT_DIR || './output';
const REQUEST_TIMEOUT = parseInt(cliArgs.REQUEST_TIMEOUT || process.env.REQUEST_TIMEOUT || "300000", 10);

// Upscaling defaults
const SD_RESIZE_MODE = parseInt(cliArgs.SD_RESIZE_MODE || process.env.SD_RESIZE_MODE || "0", 10);
const SD_UPSCALE_MULTIPLIER = parseInt(cliArgs.SD_UPSCALE_MULTIPLIER || process.env.SD_UPSCALE_MULTIPLIER || "2", 10);
const SD_UPSCALE_WIDTH = parseInt(cliArgs.SD_UPSCALE_WIDTH || process.env.SD_UPSCALE_WIDTH || "1024", 10);
const SD_UPSCALE_HEIGHT = parseInt(cliArgs.SD_UPSCALE_HEIGHT || process.env.SD_UPSCALE_HEIGHT || "1024", 10);
const SD_UPSCALER_1 = cliArgs.SD_UPSCALER_1 || process.env.SD_UPSCALER_1 || "R-ESRGAN 4x+";
const SD_UPSCALER_2 = cliArgs.SD_UPSCALER_2 || process.env.SD_UPSCALER_2 || "None";

// Cloudflare ImgBed Configuration
const CF_IMGBED_UPLOAD_URL = cliArgs.CF_IMGBED_UPLOAD_URL || process.env.CF_IMGBED_UPLOAD_URL;
const CF_IMGBED_API_KEY = cliArgs.CF_IMGBED_API_KEY || process.env.CF_IMGBED_API_KEY;
interface GenerateImageArgs {
  prompt: string;
  negative_prompt?: string;
  steps?: number;
  width?: number;
  height?: number;
  cfg_scale?: number;
  sampler_name?: string;
  scheduler_name?: string;
  seed?: number;
  batch_size?: number;
  restore_faces?: boolean;
  tiling?: boolean;
  output_path?: string;
  distilled_cfg_scale?: number;
}

interface SDAPIPayload {
  prompt: string;
  negative_prompt: string;
  steps: number;
  width: number;
  height: number;
  cfg_scale: number;
  sampler_name: string;
  scheduler_name: string;
  seed: number;
  n_iter: number;
  restore_faces?: boolean;
  tiling?: boolean;
  distilled_cfg_scale?: number;
}

interface ModelInfo {
  title: string;
  model_name: string;
  hash: string;
  sha256: string;
  filename: string;
  config: string;
}

interface SetModelArgs {
  model_name: string;
}

interface UpscalerInfo {
  name: string;
  model_name: string;
  model_path: string;
  model_url: string;
  scale: number;
}

interface UpscaleImagesArgs {
  images: string[];
  resize_mode?: number;
  upscaling_resize?: number;
  upscaling_resize_w?: number;
  upscaling_resize_h?: number;
  upscaler_1?: string;
  upscaler_2?: string;
  output_path?: string;
}

interface UpscaleImagePayload {
  resize_mode: number;
  show_extras_results: boolean;
  gfpgan_visibility: number;
  codeformer_visibility: number;
  codeformer_weight: number;
  upscaling_resize: number;
  upscaling_resize_w: number;
  upscaling_resize_h: number;
  upscaling_crop: boolean;
  upscaler_1: string;
  upscaler_2: string;
  extras_upscaler_2_visibility: number;
  upscale_first: boolean;
  imageList: Array<{
    data: string;
    name: string;
  }>;
}

class ImageGenServer {
  private server: Server;
  private axiosInstance;

  // --- CF ImgBed Upload Function ---
  private async uploadToCfImgbed(imageData: Buffer, filename: string): Promise<string | null> {
    if (!CF_IMGBED_UPLOAD_URL || !CF_IMGBED_API_KEY) {
      console.warn('[sd-image-gen-mcp] CF ImgBed URL or API Key not configured. Skipping upload.');
      return null;
    }

    const form = new FormData();
    form.append('file', imageData, filename);

    // Check if the base URL already contains query parameters
    const separator = CF_IMGBED_UPLOAD_URL.includes('?') ? '&' : '?';
    const uploadUrlWithAuth = `${CF_IMGBED_UPLOAD_URL}${separator}authCode=${CF_IMGBED_API_KEY}`;

    try {
      console.info(`[sd-image-gen-mcp] Uploading image '${filename}' to CF ImgBed...`);
      const response = await axios.post(uploadUrlWithAuth, form, {
        headers: {
          ...form.getHeaders(), // Include headers from form-data
        },
        timeout: 60000, // 60 second timeout for upload
      });

      if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0 && response.data[0]?.src) {
        const imagePathSegment = response.data[0].src;
        // Construct the full URL based on the upload URL's origin
        const parsedUploadUrl = new URL(CF_IMGBED_UPLOAD_URL);
        const baseUrlStr = `${parsedUploadUrl.protocol}//${parsedUploadUrl.host}`;
        const fullUrl = new URL(imagePathSegment, baseUrlStr).toString();
        console.info(`[sd-image-gen-mcp] Image uploaded successfully: ${fullUrl}`);
        return fullUrl;
      } else {
        // Log detailed info when the expected format is not found
        console.error(`[sd-image-gen-mcp] Unexpected response format from ImgBed. Status: ${response.status}. Headers: ${JSON.stringify(response.headers)}. Data: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      let errorMessage = 'Unknown error during ImgBed upload.';
      if (axios.isAxiosError(error)) {
        // Log detailed Axios error information
        const responseInfo = error.response ? ` Status: ${error.response.status}. Headers: ${JSON.stringify(error.response.headers)}. Data: ${JSON.stringify(error.response.data)}` : ' No response received.';
        const requestInfo = error.request ? ` Request data: ${JSON.stringify(error.config?.data)}.` : ' No request object found.'; // Be careful logging request data if it contains sensitive info
        errorMessage = `Axios error: ${error.message}.${responseInfo}${requestInfo}`;
      } else if (error instanceof Error) {
        errorMessage = `Generic error: ${error.message}. Stack: ${error.stack}`;
      } else {
        errorMessage = `Caught non-Error object: ${String(error)}`;
      }
      console.error(`[sd-image-gen-mcp] Failed to upload image to ImgBed: ${errorMessage}`);
      return null;
    }
  }

  constructor() {
    this.server = new Server(
      { name: 'image-gen', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    const axiosConfig: any = {
      baseURL: SD_WEBUI_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: REQUEST_TIMEOUT
    };

    if (AUTH_USER && AUTH_PASS) {
      axiosConfig.auth = { username: AUTH_USER, password: AUTH_PASS };
    }

    this.axiosInstance = axios.create(axiosConfig);
    this.setupToolHandlers();

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_sd_image',
          description: 'Generate an image using Stable Diffusion',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The prompt describing the desired image' },
              negative_prompt: { type: 'string', description: 'Specify elements to exclude from the image. Input is only needed when explicitly requested by the user - in most cases, this field can be left empty.' },
              steps: { type: 'number', description: 'Number of sampling steps (default: 20)', minimum: 1, maximum: 150 },
              width: { type: 'number', description: 'Image width (default: 1024)', minimum: 512, maximum: 2048 },
              height: { type: 'number', description: 'Image height (default: 1024)', minimum: 512, maximum: 2048 },
              cfg_scale: { type: 'number', description: 'CFG scale (default: 3.5)', minimum: 1, maximum: 30 },
              sampler_name: { type: 'string', description: 'Sampling algorithm (default: Euler a)', default: 'Euler a' },
              scheduler_name: { type: 'string', description: 'Scheduler algorithm (default: Automatic)', default: 'Automatic' },
              seed: { type: 'number', description: 'Random seed (-1 for random)', minimum: -1 },
              batch_size: { type: 'number', description: 'Number of images to generate (default: 1)', minimum: 1, maximum: 4 },
              restore_faces: { type: 'boolean', description: 'Enable face restoration' },
              tiling: { type: 'boolean', description: 'Generate tileable images' },
              distilled_cfg_scale: { type: 'number', description: 'Distilled CFG scale (default: 3.5)', minimum: 1, maximum: 30 },
              output_path: { type: 'string', description: 'Custom output path for the generated image' }
            },
            required: ['prompt']
          }
        },
        {
          name: 'get_sd_samplers',
          description: 'Get list of available samplers',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_sd_loras',
          description: 'Get list of available LoRA models',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'get_sd_models',
          description: 'Retrieves a list of available Stable Diffusion models. This function is only executed when explicitly requested by the user and is not automatically called by default.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'set_sd_model',
          description: 'Set the active Stable Diffusion model',
          inputSchema: {
            type: 'object',
            properties: {
              model_name: { type: 'string', description: 'Name of the model to set as active' }
            },
            required: ['model_name']
          }
        },
        {
          name: 'get_sd_upscalers',
          description: 'Retrieves a list of available image upscaler models. This function is only executed when explicitly requested by the user and is not automatically called by default.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'upscale_sd_images',
          description: 'Upscale one or more images using Stable Diffusion',
          inputSchema: {
            type: 'object',
            properties: {
              images: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of image file paths to upscale'
              },
              resize_mode: {
                type: 'number',
                enum: [0, 1],
                description: '0 for multiplier mode (default), 1 for dimension mode'
              },
              upscaling_resize: {
                type: 'number',
                description: 'Upscale multiplier (default: 2) - used when resize_mode is 0'
              },
              upscaling_resize_w: {
                type: 'number',
                description: 'Target width in pixels (default: 1024) - used when resize_mode is 1'
              },
              upscaling_resize_h: {
                type: 'number',
                description: 'Target height in pixels (default: 1024) - used when resize_mode is 1'
              },
              upscaler_1: {
                type: 'string',
                description: 'Primary upscaler model (default: R-ESRGAN 4x+)'
              },
              upscaler_2: {
                type: 'string',
                description: 'Secondary upscaler model (default: None)'
              },
              output_path: {
                type: 'string',
                description: 'Custom output directory for upscaled images'
              }
            },
            required: ['images']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'generate_sd_image': {
            const args = request.params.arguments;
            if (!isGenerateImageArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }

            const outputDir = args.output_path ? path.normalize(args.output_path.trim()) : DEFAULT_OUTPUT_DIR;
            await this.ensureDirectoryExists(outputDir);

            const payload: SDAPIPayload = {
              prompt: args.prompt,
              negative_prompt: args.negative_prompt || 'worst quality,bad quality,bad hands,very displeasing,extra digit,fewer digits,jpeg artifacts,signature,username,reference,mutated,lineup,manga,comic,disembodied,futanari,yaoi,dickgirl,turnaround,2koma,4koma,monster,cropped,amputee,text,bad foreshortening,what,guro,logo,bad anatomy,bad perspective,bad proportions,artistic error,anatomical nonsense,amateur,out of frame,multiple views,disfigured,ugly,mutation,acnes,skin spots,skin blemishes,poorly drawn face,bathtub,shore,grass,buildings,stone,missing fingers,fused fingers,disconnected limbs,extra limb,extra arms,mutated hands,poorly drawn hands,malformed hands,mutated hands and fingers,missing limb,malformed limbs,deformed',
              steps: args.steps || 20,
              width: args.width || 1024,
              height: args.height || 1024,
              cfg_scale: args.cfg_scale || 3.5,
              sampler_name: args.sampler_name || 'Euler a',
              seed: args.seed ?? -1,
              n_iter: args.batch_size || 1,
              distilled_cfg_scale: args.distilled_cfg_scale || 3.5,
              scheduler_name: args.scheduler_name || 'Automatic',
              tiling: !!args.tiling,
              restore_faces: !!args.restore_faces
            };

            const response = await this.axiosInstance.post('/sdapi/v1/txt2img', payload);
            if (!response.data.images?.length) throw new Error('No images generated');

            const results = [];
            for (const imageData of response.data.images) {
              const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
              const pngInfoResponse = await this.axiosInstance.post('/sdapi/v1/png-info', { image: `data:image/png;base64,${imageData}` });
              
              const outputPath = path.join(outputDir, `sd_${randomUUID()}.png`);
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              let sharpInstance = sharp(imageBuffer);
              const infoString = pngInfoResponse.data.info;

              // Only add EXIF metadata if the info string is not empty
              if (typeof infoString === 'string' && infoString.trim() !== '') {
                try {
                  sharpInstance = sharpInstance.withMetadata({ exif: { IFD0: { ImageDescription: infoString } } });
                } catch (exifError) {
                   console.warn(`[sd-image-gen-mcp] Failed to prepare EXIF metadata: ${exifError instanceof Error ? exifError.message : String(exifError)}. Skipping EXIF for this image.`);
                   // Optionally re-throw if you want the whole operation to fail on EXIF error
                }
              } else {
                console.warn(`[sd-image-gen-mcp] Received empty or invalid info string from png-info endpoint. Skipping EXIF metadata.`);
              }

              await sharpInstance.toFile(outputPath);

              // --- Upload to CF ImgBed if configured ---
              let uploadedUrl: string | null = null;
              if (CF_IMGBED_UPLOAD_URL && CF_IMGBED_API_KEY) {
                 uploadedUrl = await this.uploadToCfImgbed(imageBuffer, path.basename(outputPath));
              }
              // --- End Upload ---

              results.push({
                 path: outputPath,
                 parameters: pngInfoResponse.data.info,
                 url: uploadedUrl // Add the URL field
              });
            }

            return { content: [{ type: 'text', text: JSON.stringify(results) }] };
          }

          case 'get_sd_models': {
            const response = await this.axiosInstance.get('/sdapi/v1/sd-models');
            const models = response.data as ModelInfo[];
            return { content: [{ type: 'text', text: JSON.stringify(models.map(m => m.title)) }] };
          }

          case 'set_sd_model': {
            const args = request.params.arguments;
            if (!isSetModelArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }

            try {
              // 调用 API，增加超时时间。Axios 会在非 2xx 状态时抛出错误。
              await this.axiosInstance.post('/sdapi/v1/options', {
                sd_model_checkpoint: args.model_name
              }, {
                // 设置超时时间为 10 分钟
                timeout: 600000
              });

              // 如果上面的调用没有抛出错误，则认为成功
              return { content: [{ type: 'text', text: `Model successfully set to: ${args.model_name}` }] };

            } catch (error: any) {
              // 处理 Axios 错误（包括非 2xx 状态、超时、网络问题等）
              console.error("Error setting SD model via API:", error);
              let errorMessage = 'Unknown error occurred';
               if (error.response) {
                // Axios error with response from server (e.g., 4xx, 5xx)
                errorMessage = `API returned status ${error.response.status}. Details: ${JSON.stringify(error.response.data)}`;
              } else if (error.request) {
                // Axios error where request was made but no response received (e.g., timeout)
                // Check for timeout specifically
                if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                   errorMessage = `Request timed out after 10 minutes while setting model. The model might still be loading in the background. Error: ${error.message}`;
                } else {
                   errorMessage = `No response received from SD API server. Error: ${error.message}`;
                }
              } else {
                // Other errors (e.g., setup error before request)
                errorMessage = error.message || 'Failed to send request to SD API.';
              }
              throw new McpError(ErrorCode.InternalError, `Error calling SD API to set model: ${errorMessage}`);
            }
          }

          case 'get_sd_upscalers': {
            const response = await this.axiosInstance.get('/sdapi/v1/upscalers');
            const upscalers = response.data as UpscalerInfo[];
            return { content: [{ type: 'text', text: JSON.stringify(upscalers.map(u => u.name)) }] };
          }

          case 'get_sd_samplers': {
            const response = await this.axiosInstance.get('/sdapi/v1/samplers');
            // Assuming response.data is an array of objects like [{ name: "Euler a", aliases: [], options: {} }, ...]
            const samplers = Array.isArray(response.data) ? response.data.map((s: any) => s?.name).filter(Boolean) : [];
            return { content: [{ type: 'text', text: JSON.stringify(samplers) }] };
          }

          case 'get_sd_loras': {
            const response = await this.axiosInstance.get('/sdapi/v1/loras');
            // Assuming response.data is an array of objects like [{ name: "lora_name", alias: "...", path: "...", metadata: {} }, ...]
            return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
          }

          case 'upscale_sd_images': {
            const args = request.params.arguments;
            if (!isUpscaleImagesArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
            }

            const outputDir = args.output_path ? path.normalize(args.output_path.trim()) : DEFAULT_OUTPUT_DIR;
            await this.ensureDirectoryExists(outputDir);

            // Read and encode all images
            const encodedImages = await Promise.all(args.images.map(async (imagePath) => {
              const data = await fs.promises.readFile(imagePath);
              return {
                data: data.toString('base64'),
                name: path.basename(imagePath)
              };
            }));

            const payload: UpscaleImagePayload = {
              resize_mode: args.resize_mode ?? SD_RESIZE_MODE,
              show_extras_results: true,
              gfpgan_visibility: 0,
              codeformer_visibility: 0,
              codeformer_weight: 0,
              upscaling_resize: args.upscaling_resize ?? SD_UPSCALE_MULTIPLIER,
              upscaling_resize_w: args.upscaling_resize_w ?? SD_UPSCALE_WIDTH,
              upscaling_resize_h: args.upscaling_resize_h ?? SD_UPSCALE_HEIGHT,
              upscaling_crop: true,
              upscaler_1: args.upscaler_1 ?? SD_UPSCALER_1,
              upscaler_2: args.upscaler_2 ?? SD_UPSCALER_2,
              extras_upscaler_2_visibility: 0,
              upscale_first: false,
              imageList: encodedImages
            };

            const response = await this.axiosInstance.post('/sdapi/v1/extra-batch-images', payload);
            if (!response.data.images?.length) throw new Error('No images upscaled');

            const results = [];
            for (let i = 0; i < response.data.images.length; i++) {
              const imageData = response.data.images[i];
              const outputPath = path.join(outputDir, `upscaled_${path.basename(args.images[i])}`);
              
              await fs.promises.writeFile(outputPath, Buffer.from(imageData, 'base64'));
              results.push({ path: outputPath });
            }

            return { content: [{ type: 'text', text: JSON.stringify(results) }] };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            error.response ? `API error: ${error.response.data?.error || error.message}` :
            error.request ? `No response: ${error.message}` : `Request error: ${error.message}`
          );
        }
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    });
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath, fs.constants.F_OK);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

function isGenerateImageArgs(value: unknown): value is GenerateImageArgs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  
  // Validate string fields
  if (typeof v.prompt !== 'string') return false;
  if (v.negative_prompt !== undefined && typeof v.negative_prompt !== 'string') return false;
  
  // Convert and validate numeric fields
  if (v.steps !== undefined) {
    const steps = Number(v.steps);
    if (isNaN(steps) || steps < 1 || steps > 150) return false;
    v.steps = steps;
  }
  
  if (v.batch_size !== undefined) {
    const batchSize = Number(v.batch_size);
    if (isNaN(batchSize) || batchSize < 1 || batchSize > 4) return false;
    v.batch_size = batchSize;
  }
  
  return true;
}

function isSetModelArgs(value: unknown): value is SetModelArgs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.model_name === 'string';
}

function isUpscaleImagesArgs(value: unknown): value is UpscaleImagesArgs {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;

  // Validate images array
  if (!Array.isArray(v.images) || !v.images.every(img => typeof img === 'string')) {
    return false;
  }

  // Validate optional numeric fields
  if (v.resize_mode !== undefined) {
    const mode = Number(v.resize_mode);
    if (isNaN(mode) || ![0, 1].includes(mode)) return false;
  }

  if (v.upscaling_resize !== undefined) {
    const resize = Number(v.upscaling_resize);
    if (isNaN(resize) || resize < 1) return false;
  }

  if (v.upscaling_resize_w !== undefined) {
    const width = Number(v.upscaling_resize_w);
    if (isNaN(width) || width < 1) return false;
  }

  if (v.upscaling_resize_h !== undefined) {
    const height = Number(v.upscaling_resize_h);
    if (isNaN(height) || height < 1) return false;
  }

  // Validate optional string fields
  if (v.upscaler_1 !== undefined && typeof v.upscaler_1 !== 'string') return false;
  if (v.upscaler_2 !== undefined && typeof v.upscaler_2 !== 'string') return false;
  if (v.output_path !== undefined && typeof v.output_path !== 'string') return false;

  return true;
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  setTimeout(() => process.exit(1), 500);
});

const server = new ImageGenServer();
server.run().catch(err => {
  console.error('Server failed:', err);
  process.exit(1);
});