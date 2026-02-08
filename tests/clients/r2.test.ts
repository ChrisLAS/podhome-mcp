import { describe, it, expect, beforeEach, vi } from 'vitest';
import { R2Client } from '../../src/clients/r2.js';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  HeadObjectCommand: vi.fn().mockImplementation((params) => params),
  GetObjectCommand: vi.fn().mockImplementation((params) => params)
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com')
}));

describe('R2Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-secret-key';
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws error when CLOUDFLARE_ACCOUNT_ID is not set', () => {
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      expect(() => new R2Client()).toThrow('CLOUDFLARE_ACCOUNT_ID environment variable is required');
    });

    it('throws error when CLOUDFLARE_R2_ACCESS_KEY_ID is not set', () => {
      delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
      expect(() => new R2Client()).toThrow('CLOUDFLARE_R2_ACCESS_KEY_ID environment variable is required');
    });

    it('throws error when CLOUDFLARE_R2_SECRET_ACCESS_KEY is not set', () => {
      delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      expect(() => new R2Client()).toThrow('CLOUDFLARE_R2_SECRET_ACCESS_KEY environment variable is required');
    });

    it('creates S3 client with correct configuration', () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      
      new R2Client();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'auto',
        endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key'
        }
      });
    });
  });

  describe('getPublicUrl', () => {
    it('returns public URL with custom domain', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 45234567,
        LastModified: new Date('2026-02-08T15:30:00Z')
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-podcast-audio',
        object_key: 'episodes/episode-42.mp3',
        custom_domain: 'cdn.mypodcast.com'
      });

      expect(result.public_url).toBe('https://cdn.mypodcast.com/episodes/episode-42.mp3');
      expect(result.bucket).toBe('my-podcast-audio');
      expect(result.object_key).toBe('episodes/episode-42.mp3');
      expect(result.size_bytes).toBe(45234567);
    });

    it('returns public URL with R2 public bucket format', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 1048576,
        LastModified: new Date('2026-02-08T10:00:00Z')
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-podcast-audio',
        object_key: 'episodes/episode-1.mp3'
      });

      expect(result.public_url).toBe('https://my-podcast-audio.test-account-id.r2.cloudflarestorage.com/episodes/episode-1.mp3');
    });

    it('uses environment variable R2_PUBLIC_DOMAIN when custom_domain not provided', async () => {
      process.env.R2_PUBLIC_DOMAIN = 'env-cdn.example.com';
      
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 2097152,
        LastModified: new Date('2026-02-08T12:00:00Z')
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-bucket',
        object_key: 'file.mp3'
      });

      expect(result.public_url).toBe('https://env-cdn.example.com/file.mp3');
    });

    it('prioritizes custom_domain over environment variable', async () => {
      process.env.R2_PUBLIC_DOMAIN = 'env-cdn.example.com';
      
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date()
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-bucket',
        object_key: 'file.mp3',
        custom_domain: 'override.example.com'
      });

      expect(result.public_url).toBe('https://override.example.com/file.mp3');
    });

    it('throws error when file not found', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const error = new Error('NotFound');
      error.name = 'NotFound';
      const mockSend = vi.fn().mockRejectedValue(error);
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      await expect(
        client.getPublicUrl({
          bucket: 'my-bucket',
          object_key: 'nonexistent.mp3'
        })
      ).rejects.toThrow('File not found in R2: my-bucket/nonexistent.mp3');
    });

    it('re-throws other errors', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockRejectedValue(new Error('Network error'));
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      await expect(
        client.getPublicUrl({
          bucket: 'my-bucket',
          object_key: 'file.mp3'
        })
      ).rejects.toThrow('Network error');
    });

    it('handles zero content length', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 0,
        LastModified: new Date('2026-02-08T15:30:00Z')
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-bucket',
        object_key: 'empty.mp3'
      });

      expect(result.size_bytes).toBe(0);
    });

    it('uses current date when LastModified is missing', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const beforeTest = new Date();
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 1024
        // No LastModified
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-bucket',
        object_key: 'file.mp3'
      });
      const afterTest = new Date();

      const lastModified = new Date(result.last_modified);
      expect(lastModified.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(lastModified.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });

    it('handles complex object keys with paths', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 5242880,
        LastModified: new Date()
      });
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const result = await client.getPublicUrl({
        bucket: 'my-podcast-audio',
        object_key: 'shows/linux-unplugged/season1/ep42-final.mp3',
        custom_domain: 'cdn.mypodcast.com'
      });

      expect(result.public_url).toBe('https://cdn.mypodcast.com/shows/linux-unplugged/season1/ep42-final.mp3');
    });
  });

  describe('generatePresignedUrl', () => {
    it('generates presigned URL with default expiration', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const mockSend = vi.fn();
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      const url = await client.generatePresignedUrl('my-bucket', 'file.mp3');

      expect(url).toBe('https://presigned-url.example.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('generates presigned URL with custom expiration', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const mockSend = vi.fn();
      (S3Client as any).mockImplementation(() => ({
        send: mockSend
      }));

      const client = new R2Client();
      await client.generatePresignedUrl('my-bucket', 'file.mp3', 3600); // 1 hour

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ Bucket: 'my-bucket', Key: 'file.mp3' }),
        { expiresIn: 3600 }
      );
    });
  });
});
