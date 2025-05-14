import axios from 'axios';
import FormData from 'form-data';
import { CF_IMGBED_UPLOAD_URL, CF_IMGBED_API_KEY } from '../config.js';

export async function uploadToCfImgbed(imageData: Buffer, filename: string): Promise<string | null> {
  if (!CF_IMGBED_UPLOAD_URL || !CF_IMGBED_API_KEY) {
    console.warn('[sd-image-gen-mcp/cfUtils] CF ImgBed URL or API Key not configured. Skipping upload.');
    return null;
  }

  const form = new FormData();
  form.append('file', imageData, filename);

  // Check if the base URL already contains query parameters
  const separator = CF_IMGBED_UPLOAD_URL.includes('?') ? '&' : '?';
  const uploadUrlWithAuth = `${CF_IMGBED_UPLOAD_URL}${separator}authCode=${CF_IMGBED_API_KEY}`;

  try {
    console.info(`[sd-image-gen-mcp/cfUtils] Uploading image '${filename}' to CF ImgBed...`);
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
      console.info(`[sd-image-gen-mcp/cfUtils] Image uploaded successfully: ${fullUrl}`);
      return fullUrl;
    } else {
      // Log detailed info when the expected format is not found
      console.error(`[sd-image-gen-mcp/cfUtils] Unexpected response format from ImgBed. Status: ${response.status}. Headers: ${JSON.stringify(response.headers)}. Data: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    let errorMessage = 'Unknown error during ImgBed upload.';
    if (axios.isAxiosError(error)) {
      // Log detailed Axios error information
      const responseInfo = error.response ? ` Status: ${error.response.status}. Headers: ${JSON.stringify(error.response.headers)}. Data: ${JSON.stringify(error.response.data)}` : ' No response received.';
      const requestInfo = error.request ? ` Request data: ${JSON.stringify(error.config?.data)}.` : ' No request object found.'; // Be careful logging request data
      errorMessage = `Axios error: ${error.message}.${responseInfo}${requestInfo}`;
    } else if (error instanceof Error) {
      errorMessage = `Generic error: ${error.message}. Stack: ${error.stack}`;
    } else {
      errorMessage = `Caught non-Error object: ${String(error)}`;
    }
    console.error(`[sd-image-gen-mcp/cfUtils] Failed to upload image to ImgBed: ${errorMessage}`);
    return null;
  }
}
