import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetR2PublicUrl } from '../../src/tools/get-r2-public-url.js';
import { handleCreateEpisode } from '../../src/tools/create-episode.js';
import { handlePublishEpisode } from '../../src/tools/publish-episode.js';
import { handleListEpisodes } from '../../src/tools/list-episodes.js';
import { handleGetEpisode } from '../../src/tools/get-episode.js';
import { handleUpdateEpisode } from '../../src/tools/update-episode.js';
import { handleDeleteEpisode } from '../../src/tools/delete-episode.js';

// Mock the clients
vi.mock('../../src/clients/r2.js', () => ({
  R2Client: vi.fn().mockImplementation(() => ({
    getPublicUrl: vi.fn()
  }))
}));

vi.mock('../../src/clients/podhome.js', () => ({
  PodhomeClient: vi.fn().mockImplementation(() => ({
    createEpisode: vi.fn(),
    publishEpisode: vi.fn(),
    listEpisodes: vi.fn(),
    getEpisode: vi.fn(),
    updateEpisode: vi.fn(),
    deleteEpisode: vi.fn()
  }))
}));

describe('Tool Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get_r2_public_url', () => {
    it('returns public URL for valid input', async () => {
      const { R2Client } = await import('../../src/clients/r2.js');
      const mockGetPublicUrl = vi.fn().mockResolvedValue({
        public_url: 'https://cdn.example.com/episodes/test.mp3',
        bucket: 'my-bucket',
        object_key: 'episodes/test.mp3',
        size_bytes: 45234567,
        last_modified: '2026-02-08T15:30:00Z'
      });
      (R2Client as any).mockImplementation(() => ({
        getPublicUrl: mockGetPublicUrl
      }));

      const result = await handleGetR2PublicUrl({
        bucket: 'my-bucket',
        object_key: 'episodes/test.mp3'
      });

      expect(result.content[0].text).toContain('R2 File: episodes/test.mp3');
      expect(result.content[0].text).toContain('Bucket: my-bucket');
      expect(result.content[0].text).toContain('Size: 43.15MB');
      expect(result.content[0].text).toContain('Public URL: https://cdn.example.com/episodes/test.mp3');
    });

    it('propagates errors from R2 client', async () => {
      const { R2Client } = await import('../../src/clients/r2.js');
      const mockGetPublicUrl = vi.fn().mockRejectedValue(new Error('File not found'));
      (R2Client as any).mockImplementation(() => ({
        getPublicUrl: mockGetPublicUrl
      }));

      const result = await handleGetR2PublicUrl({
        bucket: 'my-bucket',
        object_key: 'missing.mp3'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: File not found');
    });
  });

  describe('create_episode', () => {
    it('returns validation error for invalid URL', async () => {
      const result = await handleCreateEpisode({
        file_url: 'not-a-url',
        title: 'Test Episode'
      });

      expect(result.content[0].text).toBe('Validation error: file_url must be a valid URL');
    });

    it('returns validation error for invalid publish_date', async () => {
      const result = await handleCreateEpisode({
        file_url: 'https://example.com/audio.mp3',
        title: 'Test Episode',
        publish_date: 'invalid-date'
      });

      expect(result.content[0].text).toBe('Validation error: publish_date must be a valid ISO-8601 datetime');
    });

    it('creates episode successfully', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockCreateEpisode = vi.fn().mockResolvedValue({
        episodeId: '550e8400-e29b-41d4-a716-446655440000'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        createEpisode: mockCreateEpisode
      }));

      const result = await handleCreateEpisode({
        file_url: 'https://example.com/audio.mp3',
        title: 'Test Episode'
      });

      expect(result.content[0].text).toContain('Created episode "Test Episode"');
      expect(result.content[0].text).toContain('ID: 550e8400-e29b-41d4-a716-446655440000');
      expect(result.content[0].text).toContain('Status: Draft');
      
      // Verify defaults are passed
      expect(mockCreateEpisode).toHaveBeenCalledWith(expect.objectContaining({
        use_podhome_ai: false,
        enhance_audio: false,
        suggest_chapters: false,
        suggest_details: false,
        suggest_clips: false
      }));
    });

    it('creates episode with all fields', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockCreateEpisode = vi.fn().mockResolvedValue({
        episodeId: '660e8400-e29b-41d4-a716-446655440001'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        createEpisode: mockCreateEpisode
      }));

      await handleCreateEpisode({
        file_url: 'https://example.com/audio.mp3',
        title: 'Full Episode',
        description: 'A description',
        episode_nr: 42,
        season_nr: 1,
        link: 'https://example.com/episode',
        publish_date: '2026-03-01T10:00:00Z',
        use_podhome_ai: true,
        suggest_chapters: true,
        suggest_details: true,
        suggest_clips: true,
        enhance_audio: true
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith({
        file_url: 'https://example.com/audio.mp3',
        title: 'Full Episode',
        description: 'A description',
        episode_nr: 42,
        season_nr: 1,
        link: 'https://example.com/episode',
        publish_date: '2026-03-01T10:00:00Z',
        use_podhome_ai: true,
        suggest_chapters: true,
        suggest_details: true,
        suggest_clips: true,
        enhance_audio: true
      });
    });

    it('handles API errors', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockCreateEpisode = vi.fn().mockRejectedValue(new Error('API Error'));
      (PodhomeClient as any).mockImplementation(() => ({
        createEpisode: mockCreateEpisode
      }));

      const result = await handleCreateEpisode({
        file_url: 'https://example.com/audio.mp3',
        title: 'Test'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: API Error');
    });
  });

  describe('publish_episode', () => {
    it('returns validation error for invalid UUID', async () => {
      const result = await handlePublishEpisode({
        episode_id: 'not-a-uuid'
      });

      expect(result.content[0].text).toBe('Validation error: episode_id must be a valid UUID');
    });

    it('returns validation error for invalid publish_date', async () => {
      const result = await handlePublishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_now: false,
        publish_date: 'invalid-date'
      });

      expect(result.content[0].text).toBe('Validation error: publish_date must be a valid ISO-8601 datetime');
    });

    it('publishes episode immediately by default', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockPublishEpisode = vi.fn().mockResolvedValue({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_date: '2026-02-08T15:30:00Z',
        status: 'Published'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        publishEpisode: mockPublishEpisode
      }));

      const result = await handlePublishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.content[0].text).toContain('Episode 550e8400-e29b-41d4-a716-446655440000 published at 2026-02-08T15:30:00Z');
      expect(result.content[0].text).toContain('Status: Published');
      
      expect(mockPublishEpisode).toHaveBeenCalledWith(expect.objectContaining({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_now: true
      }));
    });

    it('schedules episode for future date', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockPublishEpisode = vi.fn().mockResolvedValue({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_date: '2026-03-01T10:00:00Z',
        status: 'Scheduled'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        publishEpisode: mockPublishEpisode
      }));

      const result = await handlePublishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        publish_now: false,
        publish_date: '2026-03-01T10:00:00Z'
      });

      expect(result.content[0].text).toContain('Status: Scheduled');
    });

    it('handles API errors', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockPublishEpisode = vi.fn().mockRejectedValue(new Error('Episode not found'));
      (PodhomeClient as any).mockImplementation(() => ({
        publishEpisode: mockPublishEpisode
      }));

      const result = await handlePublishEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Episode not found');
    });
  });

  describe('list_episodes', () => {
    it('returns validation error for invalid status', async () => {
      const result = await handleListEpisodes({ status: 10 });

      expect(result.content[0].text).toContain('Validation error: status must be 0-5');
    });

    it('lists episodes in table format', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockListEpisodes = vi.fn().mockResolvedValue([
        {
          episode_id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Episode 1',
          description: 'Desc',
          status: 'Published',
          publish_date: '2026-02-08T15:30:00Z',
          episode_nr: 1,
          season_nr: 1,
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
          episode_nr: 2,
          duration: '1800',
          enclosure_url: 'https://example.com/2.mp3',
          link: 'https://example.com/2',
          image_url: 'https://example.com/2.jpg'
        }
      ]);
      (PodhomeClient as any).mockImplementation(() => ({
        listEpisodes: mockListEpisodes
      }));

      const result = await handleListEpisodes({});

      expect(result.content[0].text).toContain('Found 2 episodes:');
      expect(result.content[0].text).toContain('ID | Title | Episode # | Status | Published');
      expect(result.content[0].text).toContain('S1E1');
      expect(result.content[0].text).toContain('S1E2');
    });

    it('shows empty list message', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockListEpisodes = vi.fn().mockResolvedValue([]);
      (PodhomeClient as any).mockImplementation(() => ({
        listEpisodes: mockListEpisodes
      }));

      const result = await handleListEpisodes({});

      expect(result.content[0].text).toContain('Found 0 episodes');
      expect(result.content[0].text).toContain('No episodes found');
    });

    it('filters by status', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockListEpisodes = vi.fn().mockResolvedValue([]);
      (PodhomeClient as any).mockImplementation(() => ({
        listEpisodes: mockListEpisodes
      }));

      await handleListEpisodes({ status: 2 });

      expect(mockListEpisodes).toHaveBeenCalledWith(expect.objectContaining({
        status: 2
      }));
    });
  });

  describe('get_episode', () => {
    it('returns validation error for invalid UUID', async () => {
      const result = await handleGetEpisode({ episode_id: 'not-a-uuid' });

      expect(result.content[0].text).toBe('Validation error: episode_id must be a valid UUID');
    });

    it('returns episode details', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockGetEpisode = vi.fn().mockResolvedValue({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Episode',
        description: 'A description',
        status: 'Published',
        publish_date: '2026-02-08T15:30:00Z',
        episode_nr: 42,
        season_nr: 1,
        duration: '2700',
        downloads: 1523,
        enclosure_url: 'https://cdn.example.com/audio.mp3',
        link: 'https://example.com/episode',
        image_url: 'https://example.com/image.jpg'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        getEpisode: mockGetEpisode
      }));

      const result = await handleGetEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.content[0].text).toContain('Episode: Test Episode');
      expect(result.content[0].text).toContain('ID: 550e8400-e29b-41d4-a716-446655440000');
      expect(result.content[0].text).toContain('Number: S1E42');
      expect(result.content[0].text).toContain('Downloads: 1523');
      expect(result.content[0].text).toContain('Duration: 45:00');
    });

    it('includes chapters when requested', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockGetEpisode = vi.fn().mockResolvedValue({
        episode_id: 'test-id',
        title: 'Test',
        description: 'Desc',
        status: 'Published',
        publish_date: '',
        duration: '3600',
        enclosure_url: '',
        link: '',
        image_url: '',
        chapters: [
          { start_time: 0, title: 'Intro' },
          { start_time: 300, title: 'Main Topic' },
          { start_time: 3300, title: 'Outro' }
        ]
      });
      (PodhomeClient as any).mockImplementation(() => ({
        getEpisode: mockGetEpisode
      }));

      const result = await handleGetEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        include_chapters: true
      });

      expect(result.content[0].text).toContain('Chapters:');
      expect(result.content[0].text).toContain('00:00:00 - Intro');
      expect(result.content[0].text).toContain('00:05:00 - Main Topic');
      expect(result.content[0].text).toContain('00:55:00 - Outro');
    });

    it('includes transcript when requested', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockGetEpisode = vi.fn().mockResolvedValue({
        episode_id: 'test-id',
        title: 'Test',
        description: 'Desc',
        status: 'Published',
        publish_date: '',
        duration: '0',
        enclosure_url: '',
        link: '',
        image_url: '',
        transcript: {
          language: 'en',
          transcript_url: 'https://example.com/transcript.vtt'
        }
      });
      (PodhomeClient as any).mockImplementation(() => ({
        getEpisode: mockGetEpisode
      }));

      const result = await handleGetEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        include_transcript: true
      });

      expect(result.content[0].text).toContain('Transcript (en): https://example.com/transcript.vtt');
    });
  });

  describe('update_episode', () => {
    it('returns validation error for invalid UUID', async () => {
      const result = await handleUpdateEpisode({
        episode_id: 'not-a-uuid',
        title: 'New Title'
      });

      expect(result.content[0].text).toBe('Validation error: episode_id must be a valid UUID');
    });

    it('updates episode and shows changed fields', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockUpdateEpisode = vi.fn().mockResolvedValue({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
        description: 'New Description'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        updateEpisode: mockUpdateEpisode
      }));

      const result = await handleUpdateEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'New Title',
        description: 'New Description'
      });

      expect(result.content[0].text).toContain('Updated episode 550e8400-e29b-41d4-a716-446655440000');
      expect(result.content[0].text).toContain('Changed: title, description');
    });

    it('shows none when no fields changed', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockUpdateEpisode = vi.fn().mockResolvedValue({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });
      (PodhomeClient as any).mockImplementation(() => ({
        updateEpisode: mockUpdateEpisode
      }));

      const result = await handleUpdateEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.content[0].text).toContain('Changed: none');
    });
  });

  describe('delete_episode', () => {
    it('returns validation error for invalid UUID', async () => {
      const result = await handleDeleteEpisode({ episode_id: 'not-a-uuid' });

      expect(result.content[0].text).toBe('Validation error: episode_id must be a valid UUID');
    });

    it('deletes episode successfully', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockDeleteEpisode = vi.fn().mockResolvedValue(undefined);
      (PodhomeClient as any).mockImplementation(() => ({
        deleteEpisode: mockDeleteEpisode
      }));

      const result = await handleDeleteEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.content[0].text).toBe('Deleted episode 550e8400-e29b-41d4-a716-446655440000');
      expect(mockDeleteEpisode).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('handles API errors', async () => {
      const { PodhomeClient } = await import('../../src/clients/podhome.js');
      const mockDeleteEpisode = vi.fn().mockRejectedValue(new Error('Cannot delete published episode'));
      (PodhomeClient as any).mockImplementation(() => ({
        deleteEpisode: mockDeleteEpisode
      }));

      const result = await handleDeleteEpisode({
        episode_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Cannot delete published episode');
    });
  });
});
