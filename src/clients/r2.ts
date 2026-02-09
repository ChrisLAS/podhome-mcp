import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2PublicUrlInput, R2PublicUrlOutput } from '../types.js';
import { readRequiredEnvOrFile } from '../utils.js';

export class R2Client {
  private client: S3Client;
  private accountId: string;
  private publicDomain?: string;

  constructor() {
    this.accountId = readRequiredEnvOrFile(
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCOUNT_ID_FILE',
      'CLOUDFLARE_ACCOUNT_ID'
    );
    const accessKeyId = readRequiredEnvOrFile(
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
      'CLOUDFLARE_R2_ACCESS_KEY_ID_FILE',
      'CLOUDFLARE_R2_ACCESS_KEY_ID'
    );
    const secretAccessKey = readRequiredEnvOrFile(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY_FILE',
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY'
    );
    this.publicDomain = process.env.R2_PUBLIC_DOMAIN;

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  async getPublicUrl(input: R2PublicUrlInput): Promise<R2PublicUrlOutput> {
    const { bucket, object_key, custom_domain } = input;

    // Verify object exists and get metadata
    const headCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: object_key
    });

    let headResponse;
    try {
      headResponse = await this.client.send(headCommand);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        throw new Error(`File not found in R2: ${bucket}/${object_key}`);
      }
      throw error;
    }

    // Construct public URL
    const domain = custom_domain || this.publicDomain;
    let publicUrl: string;

    if (domain) {
      // Option 1: Custom domain
      publicUrl = `https://${domain}/${object_key}`;
    } else {
      // Option 2: R2 public bucket URL
      publicUrl = `https://${bucket}.${this.accountId}.r2.cloudflarestorage.com/${object_key}`;
    }

    return {
      public_url: publicUrl,
      bucket,
      object_key,
      size_bytes: headResponse.ContentLength || 0,
      last_modified: headResponse.LastModified?.toISOString() || new Date().toISOString()
    };
  }

  async generatePresignedUrl(bucket: string, objectKey: string, expiresIn: number = 604800): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}
