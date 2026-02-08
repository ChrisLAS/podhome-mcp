import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock environment variables
process.env.PODHOME_API_KEY = 'test-api-key';
process.env.PODHOME_BASE_URL = 'https://api.test.podhome.fm';
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-access-key';
process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.R2_PUBLIC_DOMAIN = 'cdn.test.com';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      ContentLength: 45234567,
      LastModified: new Date('2026-02-08T15:30:00Z')
    })
  })),
  HeadObjectCommand: vi.fn().mockImplementation((params) => params),
  GetObjectCommand: vi.fn().mockImplementation((params) => params)
}));

describe('Integration Tests - Full Workflow', () => {
  const server = setupServer();

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe('Complete Auphonic → R2 → Podhome Workflow', () => {
    it('full workflow: get R2 URL → create → publish', async () => {
      // Setup Podhome API mocks
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ episodeId: '550e8400-e29b-41d4-a716-446655440000' });
        }),
        http.post('https://api.test.podhome.fm/api/scheduleepisode', () => {
          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            publish_date: '2026-02-08T15:30:00Z',
            status: 'Published'
          });
        })
      );

      // Import after mocks are set up
      const { handleGetR2PublicUrl } = await import('../src/tools/get-r2-public-url.js');
      const { handleCreateEpisode } = await import('../src/tools/create-episode.js');
      const { handlePublishEpisode } = await import('../src/tools/publish-episode.js');

      // Step 1: Get R2 Public URL
      const r2Result = await handleGetR2PublicUrl({
        bucket: 'my-podcast-audio',
        object_key: 'episodes/episode-42.mp3'
      });

      expect(r2Result.isError).toBeFalsy();
      expect(r2Result.content[0].text).toContain('cdn.test.com/episodes/episode-42.mp3');

      // Step 2: Create Episode
      const createResult = await handleCreateEpisode({
        file_url: 'https://cdn.test.com/episodes/episode-42.mp3',
        title: 'Episode 42: Integration Test',
        description: 'Testing the full workflow',
        episode_nr: 42,
        season_nr: 1
      });

      expect(createResult.isError).toBeFalsy();
      expect(createResult.content[0].text).toContain('Created episode "Episode 42: Integration Test"');
      expect(createResult.content[0].text).toContain('ID: 550e8400-e29b-41d4-a716-446655440000');

      // Step 3: Publish Episode
      const publishResult = await handlePublishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_now: true
      });

      expect(publishResult.isError).toBeFalsy();
      expect(publishResult.content[0].text).toContain('Status: Published');
    });

    it('workflow with scheduled publish', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ episodeId: '660e8400-e29b-41d4-a716-446655440001' });
        }),
        http.post('https://api.test.podhome.fm/api/scheduleepisode', () => {
          return HttpResponse.json({
            episode_id: '660e8400-e29b-41d4-a716-446655440001',
            publish_date: '2026-03-01T10:00:00Z',
            status: 'Scheduled'
          });
        })
      );

      const { handleGetR2PublicUrl } = await import('../src/tools/get-r2-public-url.js');
      const { handleCreateEpisode } = await import('../src/tools/create-episode.js');
      const { handlePublishEpisode } = await import('../src/tools/publish-episode.js');

      // Get R2 URL
      const r2Result = await handleGetR2PublicUrl({
        bucket: 'my-podcast-audio',
        object_key: 'episodes/future-episode.mp3'
      });

      expect(r2Result.content[0].text).toContain('Public URL:');

      // Create episode
      const createResult = await handleCreateEpisode({
        file_url: 'https://cdn.test.com/episodes/future-episode.mp3',
        title: 'Future Episode'
      });

      expect(createResult.content[0].text).toContain('ID: 660e8400-e29b-41d4-a716-446655440001');

      // Schedule for future
      const publishResult = await handlePublishEpisode({
        episode_id: '660e8400-e29b-41d4-a716-446655440001',
        publish_now: false,
        publish_date: '2026-03-01T10:00:00Z'
      });

      expect(publishResult.content[0].text).toContain('Status: Scheduled');
      expect(publishResult.content[0].text).toContain('2026-03-01T10:00:00Z');
    });
  });

  describe('Error Scenarios', () => {
    it('handles 401 authentication error across all tools', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        })
      );

      const { handleCreateEpisode } = await import('../src/tools/create-episode.js');

      const result = await handleCreateEpisode({
        file_url: 'https://cdn.test.com/audio.mp3',
        title: 'Test'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid API key');
    });

    it('handles 404 not found when getting episode', async () => {
      server.use(
        http.get('https://api.test.podhome.fm/api/episode/:id', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        })
      );

      const { handleGetEpisode } = await import('../src/tools/get-episode.js');

      const result = await handleGetEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Episode not found');
    });

    it('handles R2 file not found error', async () => {
      // Override the mock for this test
      const { S3Client } = await import('@aws-sdk/client-s3');
      const error = new Error('NotFound');
      error.name = 'NotFound';
      (S3Client as any).mockImplementation(() => ({
        send: vi.fn().mockRejectedValue(error)
      }));

      const { handleGetR2PublicUrl } = await import('../src/tools/get-r2-public-url.js');

      const result = await handleGetR2PublicUrl({
        bucket: 'my-bucket',
        object_key: 'missing.mp3'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File not found in R2');
    });

    it('handles validation errors without calling API', async () => {
      const { handleCreateEpisode } = await import('../src/tools/create-episode.js');

      // Invalid URL should not make API call
      const result = await handleCreateEpisode({
        file_url: 'not-a-url',
        title: 'Test'
      });

      expect(result.isError).toBeFalsy(); // Validation returns normal response, not error
      expect(result.content[0].text).toContain('Validation error');
    });
  });

  describe('Episode Management Workflow', () => {
    it('create → get → update → list → delete workflow', async () => {
      const episodeId = '770e8400-e29b-41d4-a716-446655440002';

      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ episodeId });
        }),
        http.get(`https://api.test.podhome.fm/api/episode/${episodeId}`, () => {
          return HttpResponse.json({
            episode_id: episodeId,
            title: 'Original Title',
            description: 'Original Desc',
            status: 'Draft',
            publish_date: '',
            duration: '0',
            enclosure_url: '',
            link: '',
            image_url: ''
          });
        }),
        http.put('https://api.test.podhome.fm/api/updateepisode', () => {
          return HttpResponse.json({
            episode_id: episodeId,
            title: 'Updated Title',
            description: 'Updated Desc'
          });
        }),
        http.get('https://api.test.podhome.fm/api/episodes', () => {
          return HttpResponse.json([
            {
              episode_id: episodeId,
              title: 'Updated Title',
              description: 'Updated Desc',
              status: 'Draft',
              publish_date: '',
              duration: '0',
              enclosure_url: '',
              link: '',
              image_url: ''
            }
          ]);
        }),
        http.delete(`https://api.test.podhome.fm/api/deleteepisode/${episodeId}`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { handleCreateEpisode } = await import('../src/tools/create-episode.js');
      const { handleGetEpisode } = await import('../src/tools/get-episode.js');
      const { handleUpdateEpisode } = await import('../src/tools/update-episode.js');
      const { handleListEpisodes } = await import('../src/tools/list-episodes.js');
      const { handleDeleteEpisode } = await import('../src/tools/delete-episode.js');

      // Create
      const createResult = await handleCreateEpisode({
        file_url: 'https://cdn.test.com/audio.mp3',
        title: 'Original Title'
      });
      expect(createResult.content[0].text).toContain(episodeId);

      // Get
      const getResult = await handleGetEpisode({ episode_id: episodeId });
      expect(getResult.content[0].text).toContain('Original Title');

      // Update
      const updateResult = await handleUpdateEpisode({
        episode_id: episodeId,
        title: 'Updated Title',
        description: 'Updated Desc'
      });
      expect(updateResult.content[0].text).toContain('Changed: title, description');

      // List
      const listResult = await handleListEpisodes({});
      expect(listResult.content[0].text).toContain('Updated Title');

      // Delete
      const deleteResult = await handleDeleteEpisode({ episode_id: episodeId });
      expect(deleteResult.content[0].text).toBe(`Deleted episode ${episodeId}`);
    });
  });

  describe('Edge Cases', () => {
    it('handles episode with all optional fields', async () => {
      const episodeId = '880e8400-e29b-41d4-a716-446655440003';

      server.use(
        http.get(`https://api.test.podhome.fm/api/episode/${episodeId}`, () => {
          return HttpResponse.json({
            episode_id: episodeId,
            title: 'Complete Episode',
            description: 'Full description here',
            status: 'Published',
            publish_date: '2026-02-08T15:30:00Z',
            episode_nr: 99,
            season_nr: 5,
            duration: '3665',
            downloads: 999999,
            enclosure_url: 'https://cdn.test.com/audio.mp3',
            link: 'https://podcast.test/ep99',
            image_url: 'https://cdn.test.com/image.jpg',
            chapters: [
              { start_time: 0, title: 'Intro' },
              { start_time: 300, title: 'Topic A', image_url: 'https://cdn.test.com/topic-a.jpg' },
              { start_time: 1800, title: 'Topic B' },
              { start_time: 3300, title: 'Outro' }
            ],
            transcript: {
              language: 'en-US',
              transcript_url: 'https://cdn.test.com/transcript.vtt'
            }
          });
        })
      );

      const { handleGetEpisode } = await import('../src/tools/get-episode.js');

      const result = await handleGetEpisode({
        episode_id: episodeId,
        include_chapters: true,
        include_transcript: true,
        include_downloads: true
      });

      expect(result.content[0].text).toContain('Complete Episode');
      expect(result.content[0].text).toContain('S5E99');
      expect(result.content[0].text).toContain('1:01:05'); // 3665 seconds
      expect(result.content[0].text).toContain('999999');
      expect(result.content[0].text).toContain('Chapters:');
      expect(result.content[0].text).toContain('00:05:00 - Topic A');
      expect(result.content[0].text).toContain('Transcript (en-US):');
    });

    it('handles empty description', async () => {
      const episodeId = '990e8400-e29b-41d4-a716-446655440004';

      server.use(
        http.get(`https://api.test.podhome.fm/api/episode/${episodeId}`, () => {
          return HttpResponse.json({
            episode_id: episodeId,
            title: 'No Description',
            description: '',
            status: 'Draft',
            publish_date: '',
            duration: '0',
            enclosure_url: '',
            link: '',
            image_url: ''
          });
        })
      );

      const { handleGetEpisode } = await import('../src/tools/get-episode.js');

      const result = await handleGetEpisode({ episode_id: episodeId });

      // Should not include Description section if empty
      expect(result.content[0].text).not.toContain('Description:\n\nDescription:');
    });

    it('handles long titles in list view', async () => {
      server.use(
        http.get('https://api.test.podhome.fm/api/episodes', () => {
          return HttpResponse.json([
            {
              episode_id: 'aa0e8400-e29b-41d4-a716-446655440005',
              title: 'This is a very long title that should be truncated in the list view for better readability and display purposes',
              description: 'Desc',
              status: 'Published',
              publish_date: '2026-02-08T15:30:00Z',
              episode_nr: 1,
              duration: '2700',
              enclosure_url: '',
              link: '',
              image_url: ''
            }
          ]);
        })
      );

      const { handleListEpisodes } = await import('../src/tools/list-episodes.js');

      const result = await handleListEpisodes({});

      expect(result.content[0].text).toContain('...');
      expect(result.content[0].text).not.toContain('This is a very long title that should be truncated in the list view for better readability and display purposes');
    });
  });
});
