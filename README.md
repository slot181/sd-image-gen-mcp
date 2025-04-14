# sd-image-gen-mcp Server

A MCP server that provides text-to-image generation capabilities using Stable Diffusion WebUI API (ForgeUI/AUTOMATIC-1111). It also supports optional image uploading to a Cloudflare ImgBed instance.

## Installation

### Prerequisites
- Node.js (v18 or later recommended)
- npm
- Access to a Stable Diffusion WebUI instance with API enabled
- The WebUI must have `--api` flag enabled when starting
- (Optional) Access to a [Cloudflare ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed) instance for image hosting.

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/Ichigo3766/image-gen-mcp.git
    cd sd-image-gen-mcp
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```
    This will install necessary packages including `axios`, `sharp`, and `form-data`.

3.  Build the server:
    ```bash
    npm run build
    ```

4.  Configure the server:

    You can configure the server using **command-line arguments (`-e KEY VALUE`)** or **environment variables**. Command-line arguments take precedence over environment variables, which in turn take precedence over the default values defined in the code.

    **Example using command-line arguments (Recommended for MCP integration):**

    Add the server configuration to your MCP client's settings (e.g., in VS Code settings.json):

    ```json
    {
      "mcpServers": {
        "sd-image-gen": { // Choose a name for your server instance
          "command": "node",
          "args": [
            "/path/to/sd-image-gen-mcp/build/index.js", // <-- Make sure this path is correct
            "-e", "SD_WEBUI_URL", "http://your-sd-webui-url:7860",
            "-e", "SD_OUTPUT_DIR", "/path/to/output/directory",
            // Optional Auth
            // "-e", "SD_AUTH_USER", "your-username",
            // "-e", "SD_AUTH_PASS", "your-password",
            // Optional Upscaling Defaults
            // "-e", "SD_RESIZE_MODE", "0",
            // "-e", "SD_UPSCALE_MULTIPLIER", "4",
            // "-e", "SD_UPSCALE_WIDTH": "512",
            // "-e", "SD_UPSCALE_HEIGHT": "512",
            // "-e", "SD_UPSCALER_1": "R-ESRGAN 4x+",
            // "-e", "SD_UPSCALER_2": "None",
            // Optional ImgBed Upload
            // "-e", "CF_IMGBED_UPLOAD_URL", "https://your-imgbed-url/upload",
            // "-e", "CF_IMGBED_API_KEY": "your-imgbed-api-key",
            // Optional Timeout
            // "-e", "REQUEST_TIMEOUT", "300000" // 5 minutes in milliseconds
          ],
          "env": {
             // Environment variables can also be set here, but CLI args take priority
          }
        }
      }
    }
    ```

    **Example using environment variables:**

    Set the following environment variables before running the server:

    ```bash
    export SD_WEBUI_URL="http://your-sd-webui-url:7860"
    export SD_OUTPUT_DIR="/path/to/output/directory"
    # Optional Auth
    # export SD_AUTH_USER="your-username"
    # export SD_AUTH_PASS="your-password"
    # Optional Upscaling Defaults
    # export SD_RESIZE_MODE="0"
    # export SD_UPSCALE_MULTIPLIER="4"
    # export SD_UPSCALE_WIDTH="512"
    # export SD_UPSCALE_HEIGHT="512"
    # export SD_UPSCALER_1="R-ESRGAN 4x+"
    # export SD_UPSCALER_2="None"
    # Optional ImgBed Upload
    # export CF_IMGBED_UPLOAD_URL="https://your-imgbed-url/upload"
    # export CF_IMGBED_API_KEY="your-imgbed-api-key"
    # Optional Timeout
    # export REQUEST_TIMEOUT="300000" # 5 minutes in milliseconds

    node /path/to/sd-image-gen-mcp/build/index.js
    ```

    **Configuration Parameters:**

    *   `SD_WEBUI_URL` (Required): URL of your Stable Diffusion WebUI instance (e.g., `http://127.0.0.1:7860`).
    *   `SD_OUTPUT_DIR` (Optional): Directory where generated images will be saved locally. Defaults to `./output` relative to the server's running directory.
    *   `SD_AUTH_USER` (Optional): Username for WebUI basic authentication, if enabled.
    *   `SD_AUTH_PASS` (Optional): Password for WebUI basic authentication, if enabled.
    *   `REQUEST_TIMEOUT` (Optional): Timeout in milliseconds for requests to the SD WebUI API. Defaults to `300000` (5 minutes).
    *   `CF_IMGBED_UPLOAD_URL` (Optional): The upload endpoint URL for your Cloudflare ImgBed instance. If set along with `CF_IMGBED_API_KEY`, generated images will be uploaded.
    *   `CF_IMGBED_API_KEY` (Optional): The API key (authCode) for your Cloudflare ImgBed instance.
    *   `SD_RESIZE_MODE` (Optional): Default upscaling mode (0=multiplier, 1=dimensions). Defaults to `0`.
    *   `SD_UPSCALE_MULTIPLIER` (Optional): Default upscale multiplier when `SD_RESIZE_MODE` is 0. Defaults to `4`.
    *   `SD_UPSCALE_WIDTH` (Optional): Default target width when `SD_RESIZE_MODE` is 1. Defaults to `512`.
    *   `SD_UPSCALE_HEIGHT` (Optional): Default target height when `SD_RESIZE_MODE` is 1. Defaults to `512`.
    *   `SD_UPSCALER_1` (Optional): Default primary upscaler model name. Defaults to `"R-ESRGAN 4x+"`.
    *   `SD_UPSCALER_2` (Optional): Default secondary upscaler model name. Defaults to `"None"`.

## Features

### Tools

-   **`generate_image`**: Generate images using Stable Diffusion.
    -   **Parameters**:
        -   `prompt` (required): Text description of the desired image.
        -   `negative_prompt`: Things to exclude from the image. (Defaults to a general list of negative terms if not provided).
        -   `steps`: Number of sampling steps (default: 20, range: 1-150).
        -   `width`: Image width (default: 1024, range: 512-2048).
        -   `height`: Image height (default: 1024, range: 512-2048).
        -   `cfg_scale`: CFG scale (default: 1, range: 1-30).
        -   `sampler_name`: Sampling algorithm (default: "Euler a").
        -   `scheduler_name`: Scheduler algorithm (default: "Automatic").
        -   `seed`: Random seed (-1 for random).
        -   `batch_size`: Number of images to generate (default: 1, max: 4).
        -   `restore_faces`: Enable face restoration (boolean).
        -   `tiling`: Generate tileable images (boolean).
        -   `output_path`: Custom local output directory for the generated image(s), overrides `SD_OUTPUT_DIR`.
    -   **Returns**: A JSON string representing an array of generated image results. Each result object contains:
        -   `path`: The local file path where the image was saved.
        -   `parameters`: The generation parameters string obtained from the image metadata.
        -   `url`: The public URL of the image if uploaded to Cloudflare ImgBed (requires `CF_IMGBED_UPLOAD_URL` and `CF_IMGBED_API_KEY` to be configured), otherwise `null`.

-   **`get_sd_models`**: Get list of available Stable Diffusion checkpoint models.
    -   No parameters required.
    -   Returns a JSON string array of model names (titles).

-   **`set_sd_model`**: Set the active Stable Diffusion checkpoint model.
    -   **Parameters**:
        -   `model_name` (required): Name of the model to set as active.

-   **`get_sd_upscalers`**: Get list of available upscaler models.
    -   No parameters required.
    -   Returns a JSON string array of upscaler names.

-   **`upscale_images`**: Upscale one or more images using Stable Diffusion's "Extras" feature.
    -   **Parameters**:
        -   `images` (required): Array of local image file paths to upscale.
        -   `resize_mode`: Upscaling mode (0 for multiplier, 1 for dimensions). Defaults to `SD_RESIZE_MODE`.
        -   `upscaling_resize`: Upscale multiplier when `resize_mode=0`. Defaults to `SD_UPSCALE_MULTIPLIER`.
        -   `upscaling_resize_w`: Target width in pixels when `resize_mode=1`. Defaults to `SD_UPSCALE_WIDTH`.
        -   `upscaling_resize_h`: Target height in pixels when `resize_mode=1`. Defaults to `SD_UPSCALE_HEIGHT`.
        -   `upscaler_1`: Primary upscaler model name. Defaults to `SD_UPSCALER_1`.
        -   `upscaler_2`: Secondary upscaler model name. Defaults to `SD_UPSCALER_2`.
        -   `output_path`: Custom local output directory for upscaled images, overrides `SD_OUTPUT_DIR`.
    -   **Returns**: A JSON string representing an array of result objects, each containing the `path` to the upscaled image file.

## Development

For development with auto-rebuild on file changes:
```bash
npm run watch
```
This will compile TypeScript files and restart the server when changes are detected in the `src` directory.

## Error Handling

Common issues and solutions:
1.  **Connection Errors**:
    *   Ensure your Stable Diffusion WebUI is running and accessible from where the MCP server is running.
    *   Verify the WebUI was started with the `--api` flag.
    *   Check if the `SD_WEBUI_URL` is correct.
    *   If using authentication (`SD_AUTH_USER`, `SD_AUTH_PASS`), ensure credentials are correct.
2.  **File System Errors**:
    *   Verify the output directory (`SD_OUTPUT_DIR` or `output_path` parameter) exists and the server process has write permissions.
    *   When upscaling, ensure the input image files specified in the `images` array exist and are readable by the server process.
3.  **Timeout Errors**:
    *   Image generation can take time. If you encounter timeouts, consider increasing the `REQUEST_TIMEOUT` value (in milliseconds).
4.  **ImgBed Upload Errors**:
    *   Ensure `CF_IMGBED_UPLOAD_URL` and `CF_IMGBED_API_KEY` are correctly set if you expect uploads to work.
    *   Check the ImgBed server logs for potential issues on its end.
    *   Check the `sd-image-gen-mcp` server logs for detailed error messages related to the upload attempt.

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
