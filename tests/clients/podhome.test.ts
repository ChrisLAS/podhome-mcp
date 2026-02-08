import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { PodhomeClient } from '../../src/clients/podhome.js';

describe('PodhomeClient', () => {
  const server = setupServer();
  const originalEnv = process.env;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.PODHOME_API_KEY = 'test-api-key';
    process.env.PODHOME_BASE_URL = 'https://api.test.podhome.fm';
    server.resetHandlers();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('throws error when PODHOME_API_KEY is not set', () => {
      delete process.env.PODHOME_API_KEY;
      expect(() => new PodhomeClient()).toThrow('PODHOME_API_KEY environment variable is required');
    });

    it('uses default base URL when PODHOME_BASE_URL is not set', () => {
      delete process.env.PODHOME_BASE_URL;
      const client = new PodhomeClient();
      expect(client).toBeDefined();
    });

    it('accepts custom base URL from environment', () => {
      process.env.PODHOME_BASE_URL = 'https://custom.podhome.fm';
      const client = new PodhomeClient();
      expect(client).toBeDefined();
    });
  });

  describe('createEpisode', () => {
    it('creates episode successfully', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            file_url: 'https://cdn.example.com/audio.mp3',
            title: 'Test Episode',
            use_podhome_ai: false,
            enhance_audio: false
          });

          return HttpResponse.json({ episodeId: '550e8400-e29b-41d4-a716-446655440000' });
        })
      );

      const client = new PodhomeClient();
      const result = await client.createEpisode({
        file_url: 'https://cdn.example.com/audio.mp3',
        title: 'Test Episode'
      });

      expect(result.episodeId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('creates episode with all optional fields', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            file_url: 'https://cdn.example.com/audio.mp3',
            title: 'Full Test Episode',
            description: 'A test description',
            episode_nr: 42,
            season_nr: 1,
            link: 'https://example.com/episode-42',
            publish_date: '2026-03-01T10:00:00Z',
            use_podhome_ai: true,
            suggest_chapters: true,
            suggest_details: true,
            suggest_clips: true,
            enhance_audio: true
          });

          return HttpResponse.json({ episodeId: '660e8400-e29b-41d4-a716-446655440001' });
        })
      );

      const client = new PodhomeClient();
      const result = await client.createEpisode({
        file_url: 'https://cdn.example.com/audio.mp3',
        title: 'Full Test Episode',
        description: 'A test description',
        episode_nr: 42,
        season_nr: 1,
        link: 'https://example.com/episode-42',
        publish_date: '2026-03-01T10:00:00Z',
        use_podhome_ai: true,
        suggest_chapters: true,
        suggest_details: true,
        suggest_clips: true,
        enhance_audio: true
      });

      expect(result.episodeId).toBe('660e8400-e29b-41d4-a716-446655440001');
    });

    it('handles 400 validation error', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ error: 'Invalid file_url' }, { status: 400 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.createEpisode({ file_url: 'invalid', title: 'Test' })
      ).rejects.toThrow('Validation error: Invalid file_url');
    });

    it('handles 401 unauthorized error', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.createEpisode({ file_url: 'https://example.com/audio.mp3', title: 'Test' })
      ).rejects.toThrow('Invalid API key. Check PODHOME_API_KEY environment variable');
    });

    it('handles 500 server error', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.createEpisode({ file_url: 'https://example.com/audio.mp3', title: 'Test' })
      ).rejects.toThrow('Podhome API error: Internal server error');
    });

    it('includes correct headers', async () => {
      let capturedHeaders: Headers | null = null;
      
      server.use(
        http.post('https://api.test.podhome.fm/api/createepisode', async ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({ episodeId: 'test-id' });
        })
      );

      const client = new PodhomeClient();
      await client.createEpisode({
        file_url: 'https://example.com/audio.mp3',
        title: 'Test'
      });

      expect(capturedHeaders?.get('Content-Type')).toBe('application/json');
      expect(capturedHeaders?.get('X-API-KEY')).toBe('test-api-key');
    });
  });

  describe('publishEpisode', () => {
    it('publishes episode immediately by default', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/scheduleepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            publish_now: true
          });

          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            publish_date: '2026-02-08T15:30:00Z',
            status: 'Published'
          });
        })
      );

      const client = new PodhomeClient();
      const result = await client.publishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.status).toBe('Published');
      expect(result.publish_date).toBe('2026-02-08T15:30:00Z');
    });

    it('schedules episode for future date', async () => {
      server.use(
        http.post('https://api.test.podhome.fm/api/scheduleepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            publish_now: false,
            publish_date: '2026-03-01T10:00:00Z'
          });

          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            publish_date: '2026-03-01T10:00:00Z',
            status: 'Scheduled'
          });
        })
      );

      const client = new PodhomeClient();
      const result = await client.publishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_now: false,
        publish_date: '2026-03-01T10:00:00Z'
      });

      expect(result.status).toBe('Scheduled');
    });
  });

  describe('listEpisodes', () => {
    it('lists all episodes without filters', async () => {
      server.use(
        http.get('https://api.test.podhome.fm/api/episodes', () => {
          return HttpResponse.json([
            {
              episode_id: '550e8400-e29b-41d4-a716-446655440000',
              title: 'Episode 1',
              description: 'Desc',
              status: 'Published',
              publish_date: '2026-02-08T15:30:00Z',
              duration: '2700',
              enclosure_url: 'https://example.com/1.mp3',
              link: 'https://example.com/1',
              image_url: 'https://example.com/1.jpg'
            },
            {
              episode_id: '660e8400-e29b-41d4-a716-446655440001',
              title: 'Episode 2',
              description: 'Desc',
              status: 'Draft',
              publish_date: '',
              duration: '1800',
              enclosure_url: 'https://example.com/2.mp3',
              link: 'https://example.com/2',
              image_url: 'https://example.com/2.jpg'
            }
          ]);
        })
      );

      const client = new PodhomeClient();
      const episodes = await client.listEpisodes();

      expect(episodes).toHaveLength(2);
      expect(episodes[0].title).toBe('Episode 1');
      expect(episodes[1].status).toBe('Draft');
    });

    it('lists episodes with status filter', async () => {
      let requestUrl: string | null = null;
      
      server.use(
        http.get('https://api.test.podhome.fm/api/episodes', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json([]);
        })
      );

      const client = new PodhomeClient();
      await client.listEpisodes({ status: 2 }); // Published

      expect(requestUrl).toContain('status=2');
    });

    it('lists episodes with include options', async () => {
      let requestUrl: string | null = null;
      
      server.use(
        http.get('https://api.test.podhome.fm/api/episodes', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json([]);
        })
      );

      const client = new PodhomeClient();
      await client.listEpisodes({
        include_transcript: true,
        include_chapters: true,
        include_downloads: true,
        include_people: true
      });

      expect(requestUrl).toContain('includeTranscript=true');
      expect(requestUrl).toContain('includeChapters=true');
      expect(requestUrl).toContain('includeDownloads=true');
      expect(requestUrl).toContain('includePeople=true');
    });
  });

  describe('getEpisode', () => {
    it('gets episode by ID', async () => {
      server.use(
        http.get('https://api.test.podhome.fm/api/episode/:id', ({ params }) => {
          expect(params.id).toBe('550e8400-e29b-41d4-a716-446655440000');
          
          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Test Episode',
            description: 'Description',
            status: 'Published',
            publish_date: '2026-02-08T15:30:00Z',
            episode_nr: 42,
            season_nr: 1,
            duration: '2700',
            enclosure_url: 'https://example.com/audio.mp3',
            link: 'https://example.com/episode',
            image_url: 'https://example.com/image.jpg'
          });
        })
      );

      const client = new PodhomeClient();
      const episode = await client.getEpisode('550e8400-e29b-41d4-a716-446655440000');

      expect(episode.title).toBe('Test Episode');
      expect(episode.episode_nr).toBe(42);
    });

    it('handles 404 not found', async () => {
      server.use(
        http.get('https://api.test.podhome.fm/api/episode/:id', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.getEpisode('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Episode not found');
    });

    it('includes optional data when requested', async () => {
      let requestUrl: string | null = null;
      
      server.use(
        http.get('https://api.test.podhome.fm/api/episode/:id', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            episode_id: 'test-id',
            title: 'Test',
            description: 'Desc',
            status: 'Published',
            publish_date: '',
            duration: '0',
            enclosure_url: '',
            link: '',
            image_url: ''
          });
        })
      );

      const client = new PodhomeClient();
      await client.getEpisode('test-id', true, true, true, true);

      expect(requestUrl).toContain('includeTranscript=true');
      expect(requestUrl).toContain('includeChapters=true');
      expect(requestUrl).toContain('includeDownloads=true');
      expect(requestUrl).toContain('includePeople=true');
    });
  });

  describe('updateEpisode', () => {
    it('updates episode metadata', async () => {
      server.use(
        http.put('https://api.test.podhome.fm/api/updateepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Updated Title',
            description: 'Updated Description'
          });

          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Updated Title',
            description: 'Updated Description'
          });
        })
      );

      const client = new PodhomeClient();
      const result = await client.updateEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Updated Title',
        description: 'Updated Description'
      });

      expect(result.title).toBe('Updated Title');
    });

    it('updates partial fields', async () => {
      server.use(
        http.put('https://api.test.podhome.fm/api/updateepisode', async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            episode_nr: 100
          });
          expect(body.title).toBeUndefined();

          return HttpResponse.json({
            episode_id: '550e8400-e29b-41d4-a716-446655440000',
            episode_nr: 100
          });
        })
      );

      const client = new PodhomeClient();
      const result = await client.updateEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        episode_nr: 100
      });

      expect(result.episode_nr).toBe(100);
    });
  });

  describe('deleteEpisode', () => {
    it('deletes episode successfully', async () => {
      server.use(
        http.delete('https://api.test.podhome.fm/api/deleteepisode/:id', ({ params }) => {
          expect(params.id).toBe('550e8400-e29b-41d4-a716-446655440000');
          return new HttpResponse(null, { status: 204 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.deleteEpisode('550e8400-e29b-41d4-a716-446655440000')
      ).resolves.not.toThrow();
    });

    it('handles 404 when episode not found', async () => {
      server.use(
        http.delete('https://api.test.podhome.fm/api/deleteepisode/:id', () => {
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        })
      );

      const client = new PodhomeClient();
      await expect(
        client.deleteEpisode('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Episode not found');
    });
  });

  describe('retry logic', () => {
    it('retries on network errors', async () => {
      let attempts = 0;
      server.use(
        http.get('https://api.test.podhome.fm/api/episodes', () => {
          attempts++;
          if (attempts < 2) {
            return HttpResponse.error();
          }
          return HttpResponse.json([]);
        })
      );

      const client = new PodhomeClient();
      const episodes = await client.listEpisodes();
      
      expect(episodes).toEqual([]);
      expect(attempts).toBe(2);
    });
  });
});
