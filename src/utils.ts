import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { Episode, EpisodeStatus, EpisodeStatusMap, PodhomeAuthInput } from './types.js';

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
      return 'Invalid API key. Check PODHOME_API_KEY or PODHOME_API_KEYS settings';
    case 404:
      return `Episode not found`;
    case 500:
      return `Podhome API error: ${message}`;
    default:
      return `HTTP ${status}: ${message}`;
  }
}

function readFileTrimmed(filePath: string): string {
  return readFileSync(filePath, 'utf8').trim();
}

function readEnvOrFile(envVar: string, fileEnvVar: string): string | undefined {
  const direct = process.env[envVar];
  if (direct && direct.trim()) {
    return direct.trim();
  }

  const filePath = process.env[fileEnvVar];
  if (filePath && filePath.trim()) {
    return readFileTrimmed(filePath.trim());
  }

  return undefined;
}

function parseJsonMap(value: string, sourceLabel: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${sourceLabel} as JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${sourceLabel} must be a JSON object of string keys to string values`);
  }

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      throw new Error(`${sourceLabel} value for "${key}" must be a non-empty string`);
    }
    result[key] = rawValue.trim();
  }

  return result;
}

function readApiKeysDir(dirPath: string): Record<string, string> {
  const entries = readdirSync(dirPath);
  const keys: Record<string, string> = {};

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);
    if (!stat.isFile()) continue;

    const name = extname(entry)
      ? basename(entry, extname(entry))
      : entry;
    const value = readFileTrimmed(fullPath);
    if (!value) {
      throw new Error(`Podhome API key file is empty: ${fullPath}`);
    }
    keys[name] = value;
  }

  return keys;
}

export function resolvePodhomeApiKey(input: PodhomeAuthInput = {}): string {
  if (input.podhome_api_key && input.podhome_api_key.trim()) {
    return input.podhome_api_key.trim();
  }

  const keys: Record<string, string> = {};

  const keysJson = process.env.PODHOME_API_KEYS;
  if (keysJson && keysJson.trim()) {
    Object.assign(keys, parseJsonMap(keysJson.trim(), 'PODHOME_API_KEYS'));
  }

  const keysFile = process.env.PODHOME_API_KEYS_FILE;
  if (keysFile && keysFile.trim()) {
    const fileContents = readFileTrimmed(keysFile.trim());
    Object.assign(keys, parseJsonMap(fileContents, 'PODHOME_API_KEYS_FILE'));
  }

  const keysDir = process.env.PODHOME_API_KEYS_DIR;
  if (keysDir && keysDir.trim()) {
    Object.assign(keys, readApiKeysDir(keysDir.trim()));
  }

  if (input.podhome_api_key_name) {
    const selected = keys[input.podhome_api_key_name];
    if (!selected) {
      const available = Object.keys(keys).sort().join(', ') || 'none';
      throw new Error(`Unknown podhome_api_key_name "${input.podhome_api_key_name}". Available keys: ${available}`);
    }
    return selected;
  }

  const directKey = readEnvOrFile('PODHOME_API_KEY', 'PODHOME_API_KEY_FILE');
  if (directKey) {
    return directKey;
  }

  const keyNames = Object.keys(keys);
  if (keyNames.length === 1) {
    return keys[keyNames[0]];
  }

  if (keys.default) {
    return keys.default;
  }

  throw new Error('PODHOME_API_KEY (or PODHOME_API_KEYS) is required');
}

export function readRequiredEnvOrFile(envVar: string, fileEnvVar: string, label: string): string {
  const value = readEnvOrFile(envVar, fileEnvVar);
  if (!value) {
    throw new Error(`${label} environment variable is required`);
  }
  return value;
}
