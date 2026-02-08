import type { Episode, EpisodeStatus, EpisodeStatusMap } from './types.js';

export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateISO8601(date: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
  if (!iso8601Regex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

export function validateEpisodeStatus(status: number): status is EpisodeStatus {
  return status >= 0 && status <= 5;
}

export function formatFileSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

export function formatDuration(seconds: string): string {
  const totalSeconds = parseInt(seconds, 10);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatEpisodeNumber(season?: number, episode?: number): string {
  if (season && episode) return `S${season}E${episode}`;
  if (episode) return `E${episode}`;
  return 'N/A';
}

export function formatEpisodesTable(episodes: Episode[]): string {
  if (episodes.length === 0) return 'No episodes found.';
  
  const header = 'ID | Title | Episode # | Status | Published';
  const separator = '---|-------|-----------|--------|----------';
  
  const rows = episodes.map(ep => {
    const episodeNum = formatEpisodeNumber(ep.season_nr, ep.episode_nr);
    const title = ep.title.length > 40 ? ep.title.substring(0, 37) + '...' : ep.title;
    const publishDate = ep.publish_date ? new Date(ep.publish_date).toLocaleDateString() : 'N/A';
    return `${ep.episode_id} | ${title} | ${episodeNum} | ${ep.status} | ${publishDate}`;
  });
  
  return [header, separator, ...rows].join('\n');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export function handleApiError(status: number, message: string): string {
  switch (status) {
    case 400:
      return `Validation error: ${message}`;
    case 401:
      return 'Invalid API key. Check PODHOME_API_KEY environment variable';
    case 404:
      return `Episode not found`;
    case 500:
      return `Podhome API error: ${message}`;
    default:
      return `HTTP ${status}: ${message}`;
  }
}
