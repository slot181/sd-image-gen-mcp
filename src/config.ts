import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to parse command-line arguments (optional, but good practice)
// Example: node dist/index.js -e KEY VALUE
function parseCliArgs(argv: string[]): Record<string, string> {
    const args = argv.slice(2); // Skip node executable and script path
    const parsed: Record<string, string> = {};
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

// --- Stable Diffusion WebUI Configuration ---
export const SD_WEBUI_URL = cliArgs.SD_WEBUI_URL || process.env.SD_WEBUI_URL || 'http://127.0.0.1:7860';
export const AUTH_USER = cliArgs.SD_AUTH_USER || process.env.SD_AUTH_USER;
export const AUTH_PASS = cliArgs.SD_AUTH_PASS || process.env.SD_AUTH_PASS;
export const DEFAULT_OUTPUT_DIR = cliArgs.SD_OUTPUT_DIR || process.env.SD_OUTPUT_DIR || './output';
export const REQUEST_TIMEOUT = parseInt(cliArgs.REQUEST_TIMEOUT || process.env.REQUEST_TIMEOUT || "300000", 10); // Default 300 seconds (5 minutes)

// --- Upscaling Defaults ---
export const SD_RESIZE_MODE = parseInt(cliArgs.SD_RESIZE_MODE || process.env.SD_RESIZE_MODE || "0", 10);
export const SD_UPSCALE_MULTIPLIER = parseInt(cliArgs.SD_UPSCALE_MULTIPLIER || process.env.SD_UPSCALE_MULTIPLIER || "2", 10);
export const SD_UPSCALE_WIDTH = parseInt(cliArgs.SD_UPSCALE_WIDTH || process.env.SD_UPSCALE_WIDTH || "1024", 10);
export const SD_UPSCALE_HEIGHT = parseInt(cliArgs.SD_UPSCALE_HEIGHT || process.env.SD_UPSCALE_HEIGHT || "1024", 10);
export const SD_UPSCALER_1 = cliArgs.SD_UPSCALER_1 || process.env.SD_UPSCALER_1 || "R-ESRGAN 4x+";
export const SD_UPSCALER_2 = cliArgs.SD_UPSCALER_2 || process.env.SD_UPSCALER_2 || "None";

// --- Cloudflare ImgBed Configuration ---
export const CF_IMGBED_UPLOAD_URL = cliArgs.CF_IMGBED_UPLOAD_URL || process.env.CF_IMGBED_UPLOAD_URL;
export const CF_IMGBED_API_KEY = cliArgs.CF_IMGBED_API_KEY || process.env.CF_IMGBED_API_KEY;

// --- Validation (Optional, can be added if specific keys are critical) ---

if (!SD_WEBUI_URL) {
    console.error('[sd-image-gen-mcp] Error: Stable Diffusion WebUI URL (SD_WEBUI_URL) is not configured.');
    process.exit(1);
}
