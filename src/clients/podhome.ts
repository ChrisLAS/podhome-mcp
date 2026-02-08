import {
  CreateEpisodeInput,
  CreateEpisodeOutput,
  PublishEpisodeInput,
  PublishEpisodeOutput,
  Episode,
  UpdateEpisodeInput,
  UpdateEpisodeOutput,
  ListEpisodesInput
} from '../types.js';
import { fetchWithRetry, handleApiError } from '../utils.js';

export class PodhomeClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.PODHOME_API_KEY || '';
    this.baseUrl = process.env.PODHOME_BASE_URL || 'https://api.podhome.fm';

    if (!this.apiKey) {
      throw new Error('PODHOME_API_KEY environment variable is required');
    }
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey
    };
  }

  async createEpisode(input: CreateEpisodeInput): Promise<CreateEpisodeOutput> {
    const url = `${this.baseUrl}/api/createepisode`;
    
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        file_url: input.file_url,
        title: input.title,
        description: input.description,
        episode_nr: input.episode_nr,
        season_nr: input.season_nr,
        link: input.link,
        publish_date: input.publish_date,
        use_podhome_ai: input.use_podhome_ai ?? false,
        suggest_chapters: input.suggest_chapters ?? false,
        suggest_details: input.suggest_details ?? false,
        suggest_clips: input.suggest_clips ?? false,
        enhance_audio: input.enhance_audio ?? false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }

    return response.json();
  }

  async publishEpisode(input: PublishEpisodeInput): Promise<PublishEpisodeOutput> {
    const url = `${this.baseUrl}/api/scheduleepisode`;
    
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        episode_id: input.episode_id,
        publish_now: input.publish_now ?? true,
        publish_date: input.publish_date
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }

    return response.json();
  }

  async listEpisodes(input: ListEpisodesInput = {}): Promise<Episode[]> {
    const params = new URLSearchParams();
    
    if (input.status !== undefined) {
      params.append('status', input.status.toString());
    }
    if (input.include_transcript !== undefined) {
      params.append('includeTranscript', input.include_transcript.toString());
    }
    if (input.include_chapters !== undefined) {
      params.append('includeChapters', input.include_chapters.toString());
    }
    if (input.include_downloads !== undefined) {
      params.append('includeDownloads', input.include_downloads.toString());
    }
    if (input.include_people !== undefined) {
      params.append('includePeople', input.include_people.toString());
    }

    const url = `${this.baseUrl}/api/episodes?${params.toString()}`;
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }

    return response.json();
  }

  async getEpisode(
    episodeId: string,
    includeTranscript?: boolean,
    includeChapters?: boolean,
    includeDownloads?: boolean,
    includePeople?: boolean
  ): Promise<Episode> {
    const params = new URLSearchParams();
    
    if (includeTranscript !== undefined) {
      params.append('includeTranscript', includeTranscript.toString());
    }
    if (includeChapters !== undefined) {
      params.append('includeChapters', includeChapters.toString());
    }
    if (includeDownloads !== undefined) {
      params.append('includeDownloads', includeDownloads.toString());
    }
    if (includePeople !== undefined) {
      params.append('includePeople', includePeople.toString());
    }

    const url = `${this.baseUrl}/api/episode/${episodeId}?${params.toString()}`;
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }

    return response.json();
  }

  async updateEpisode(input: UpdateEpisodeInput): Promise<UpdateEpisodeOutput> {
    const url = `${this.baseUrl}/api/updateepisode`;
    
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({
        episode_id: input.episode_id,
        title: input.title,
        description: input.description,
        episode_nr: input.episode_nr,
        season_nr: input.season_nr,
        image_url: input.image_url
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }

    return response.json();
  }

  async deleteEpisode(episodeId: string): Promise<void> {
    const url = `${this.baseUrl}/api/deleteepisode/${episodeId}`;
    
    const response = await fetchWithRetry(url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(handleApiError(response.status, errorText));
    }
  }
}
