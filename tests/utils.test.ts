import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateUUID,
  validateURL,
  validateISO8601,
  validateEpisodeStatus,
  formatFileSize,
  formatDuration,
  formatEpisodeNumber,
  formatEpisodesTable,
  truncate,
  fetchWithRetry,
  handleApiError
} from '../src/utils.js';
import type { Episode } from '../src/types.js';

describe('validateUUID', () => {
  it('returns true for valid UUID v4', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validateUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('returns true for valid UUID with uppercase', () => {
    expect(validateUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns false for invalid UUID format', () => {
    expect(validateUUID('not-a-uuid')).toBe(false);
    expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(validateUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    expect(validateUUID('')).toBe(false);
  });
});

describe('validateURL', () => {
  it('returns true for valid HTTP URL', () => {
    expect(validateURL('http://example.com')).toBe(true);
    expect(validateURL('https://example.com/path')).toBe(true);
  });

  it('returns true for valid HTTPS URL with query params', () => {
    expect(validateURL('https://example.com?foo=bar&baz=qux')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(validateURL('not-a-url')).toBe(false);
    expect(validateURL('ftp://example.com')).toBe(true); // ftp is valid URL
    expect(validateURL('')).toBe(false);
    expect(validateURL('example.com')).toBe(false); // missing protocol
  });
});

describe('validateISO8601', () => {
  it('returns true for valid ISO-8601 datetime with Z', () => {
    expect(validateISO8601('2026-02-08T15:30:00Z')).toBe(true);
    expect(validateISO8601('2026-02-08T15:30:00.123Z')).toBe(true);
  });

  it('returns true for valid ISO-8601 with timezone offset', () => {
    expect(validateISO8601('2026-02-08T15:30:00+00:00')).toBe(true);
    expect(validateISO8601('2026-02-08T15:30:00-05:00')).toBe(true);
    expect(validateISO8601('2026-02-08T15:30:00+05:30')).toBe(true);
  });

  it('returns false for invalid formats', () => {
    expect(validateISO8601('2026-02-08')).toBe(false); // date only
    expect(validateISO8601('15:30:00')).toBe(false); // time only
    expect(validateISO8601('2026/02/08 15:30:00')).toBe(false); // wrong format
    expect(validateISO8601('not-a-date')).toBe(false);
    expect(validateISO8601('')).toBe(false);
  });

  it('returns false for invalid dates', () => {
    expect(validateISO8601('2026-13-08T15:30:00Z')).toBe(false); // invalid month
    expect(validateISO8601('2026-02-32T15:30:00Z')).toBe(false); // invalid day
    expect(validateISO8601('2026-02-08T25:30:00Z')).toBe(false); // invalid hour
  });
});

describe('validateEpisodeStatus', () => {
  it('returns true for valid status codes 0-5', () => {
    expect(validateEpisodeStatus(0)).toBe(true);
    expect(validateEpisodeStatus(1)).toBe(true);
    expect(validateEpisodeStatus(2)).toBe(true);
    expect(validateEpisodeStatus(3)).toBe(true);
    expect(validateEpisodeStatus(4)).toBe(true);
    expect(validateEpisodeStatus(5)).toBe(true);
  });

  it('returns false for invalid status codes', () => {
    expect(validateEpisodeStatus(-1)).toBe(false);
    expect(validateEpisodeStatus(6)).toBe(false);
    expect(validateEpisodeStatus(100)).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('formats bytes to MB correctly', () => {
    expect(formatFileSize(1048576)).toBe('1.00MB'); // 1 MB
    expect(formatFileSize(5242880)).toBe('5.00MB'); // 5 MB
    expect(formatFileSize(45234567)).toBe('43.15MB');
  });

  it('handles zero bytes', () => {
    expect(formatFileSize(0)).toBe('0.00MB');
  });

  it('handles large files', () => {
    expect(formatFileSize(1073741824)).toBe('1024.00MB'); // 1 GB
  });
});

describe('formatDuration', () => {
  it('formats duration less than 1 hour', () => {
    expect(formatDuration('2700')).toBe('45:00'); // 45 minutes
    expect(formatDuration('65')).toBe('1:05'); // 1 minute 5 seconds
    expect(formatDuration('5')).toBe('0:05'); // 5 seconds
  });

  it('formats duration with hours', () => {
    expect(formatDuration('3665')).toBe('1:01:05'); // 1 hour 1 min 5 sec
    expect(formatDuration('7200')).toBe('2:00:00'); // 2 hours
  });

  it('formats zero duration', () => {
    expect(formatDuration('0')).toBe('0:00');
  });
});

describe('formatEpisodeNumber', () => {
  it('returns SxEy format when both season and episode provided', () => {
    expect(formatEpisodeNumber(1, 42)).toBe('S1E42');
    expect(formatEpisodeNumber(2, 10)).toBe('S2E10');
  });

  it('returns Ex format when only episode provided', () => {
    expect(formatEpisodeNumber(undefined, 42)).toBe('E42');
    expect(formatEpisodeNumber(undefined, 1)).toBe('E1');
  });

  it('returns N/A when neither provided', () => {
    expect(formatEpisodeNumber(undefined, undefined)).toBe('N/A');
    expect(formatEpisodeNumber()).toBe('N/A');
  });

  it('returns N/A when only season provided (edge case)', () => {
    expect(formatEpisodeNumber(1, undefined)).toBe('N/A');
  });
});

describe('formatEpisodesTable', () => {
  it('returns message for empty array', () => {
    expect(formatEpisodesTable([])).toBe('No episodes found.');
  });

  it('formats single episode correctly', () => {
    const episodes: Episode[] = [{
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
    }];

    const result = formatEpisodesTable(episodes);
    expect(result).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toContain('Test Episode');
    expect(result).toContain('S1E42');
    expect(result).toContain('Published');
  });

  it('truncates long titles', () => {
    const episodes: Episode[] = [{
      episode_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'A'.repeat(50),
      description: 'Description',
      status: 'Published',
      publish_date: '2026-02-08T15:30:00Z',
      duration: '2700',
      enclosure_url: 'https://example.com/audio.mp3',
      link: 'https://example.com/episode',
      image_url: 'https://example.com/image.jpg'
    }];

    const result = formatEpisodesTable(episodes);
    expect(result).toContain('...');
    expect(result).not.toContain('A'.repeat(50));
  });

  it('handles missing season/episode numbers', () => {
    const episodes: Episode[] = [{
      episode_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test',
      description: 'Description',
      status: 'Draft',
      publish_date: '',
      duration: '0',
      enclosure_url: '',
      link: '',
      image_url: ''
    }];

    const result = formatEpisodesTable(episodes);
    expect(result).toContain('N/A');
  });
});

describe('truncate', () => {
  it('returns original text if shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('truncates text longer than maxLength with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    expect(truncate('A'.repeat(100), 50)).toBe('A'.repeat(47) + '...');
  });

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns response on successful fetch', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com', { method: 'GET' });
    
    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse);

    const result = await fetchWithRetry('https://example.com', { method: 'GET' });
    
    expect(result).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exceeded', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      fetchWithRetry('https://example.com', { method: 'GET' }, 2)
    ).rejects.toThrow('Network error');
    
    expect(fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('respects max retries parameter', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      fetchWithRetry('https://example.com', { method: 'GET' }, 1)
    ).rejects.toThrow('Network error');
    
    expect(fetch).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('aborts request after timeout', async () => {
    global.fetch = vi.fn().mockImplementation(() => 
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 35000);
      })
    );

    // The timeout should trigger before the 30s limit
    await expect(
      fetchWithRetry('https://example.com', { method: 'GET' })
    ).rejects.toThrow();
  });
});

describe('handleApiError', () => {
  it('returns correct message for 400 Bad Request', () => {
    expect(handleApiError(400, 'Invalid data')).toBe('Validation error: Invalid data');
  });

  it('returns correct message for 401 Unauthorized', () => {
    expect(handleApiError(401, 'Auth failed')).toBe('Invalid API key. Check PODHOME_API_KEY environment variable');
  });

  it('returns correct message for 404 Not Found', () => {
    expect(handleApiError(404, 'Not found')).toBe('Episode not found');
  });

  it('returns correct message for 500 Server Error', () => {
    expect(handleApiError(500, 'Server crashed')).toBe('Podhome API error: Server crashed');
  });

  it('returns generic message for other status codes', () => {
    expect(handleApiError(418, "I'm a teapot")).toBe("HTTP 418: I'm a teapot");
    expect(handleApiError(503, 'Service unavailable')).toBe('HTTP 503: Service unavailable');
  });
});
