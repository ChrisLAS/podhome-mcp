import { R2Client } from '../clients/r2.js';
import { formatFileSize } from '../utils.js';
import type { R2PublicUrlInput, R2PublicUrlOutput } from '../types.js';

export const getR2PublicUrlTool = {
  name: 'get_r2_public_url',
  description: 'Convert Auphonic\'s private R2 URL to a publicly accessible URL',
  inputSchema: {
    type: 'object',
    properties: {
      bucket: {
        type: 'string',
        description: 'R2 bucket name (from Auphonic service preset)'
      },
      object_key: {
        type: 'string',
        description: 'Object path in R2 (from Auphonic output)'
      },
      custom_domain: {
        type: 'string',
        description: 'Override R2_PUBLIC_DOMAIN env var'
      }
    },
    required: ['bucket', 'object_key']
  }
};

export async function handleGetR2PublicUrl(args: R2PublicUrlInput): Promise<{ content: Array<{ type: string; text: string }> }> {
  const client = new R2Client();
  const result: R2PublicUrlOutput = await client.getPublicUrl(args);

  const sizeMB = formatFileSize(result.size_bytes);

  return {
    content: [
      {
        type: 'text',
        text: `R2 File: ${result.object_key}
Bucket: ${result.bucket}
Size: ${sizeMB}
Public URL: ${result.public_url}`
      }
    ]
  };
}
