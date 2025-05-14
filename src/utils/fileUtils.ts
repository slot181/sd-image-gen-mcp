import fs from 'fs';
import { mkdir } from 'fs/promises';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.promises.access(dirPath, fs.constants.F_OK);
  } catch {
    // Directory does not exist, create it
    await mkdir(dirPath, { recursive: true });
    console.log(`[sd-image-gen-mcp/fileUtils] Created directory: ${dirPath}`);
  }
}
