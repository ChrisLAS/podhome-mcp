export interface R2PublicUrlInput {
  bucket: string;
  object_key: string;
  custom_domain?: string;
}

export interface R2PublicUrlOutput {
  public_url: string;
  bucket: string;
  object_key: string;
  size_bytes: number;
  last_modified: string;
}

export interface CreateEpisodeInput {
  file_url: string;
  title: string;
  description?: string;
  episode_nr?: number;
  season_nr?: number;
  link?: string;
  publish_date?: string;
  use_podhome_ai?: boolean;
  suggest_chapters?: boolean;
  suggest_details?: boolean;
  suggest_clips?: boolean;
  enhance_audio?: boolean;
}

export interface CreateEpisodeOutput {
  episodeId: string;
}

export interface PublishEpisodeInput {
  episode_id: string;
  publish_now?: boolean;
  publish_date?: string;
}

export interface PublishEpisodeOutput {
  episode_id: string;
  publish_date: string;
  status: string;
}

export interface ListEpisodesInput {
  status?: number;
  include_transcript?: boolean;
  include_chapters?: boolean;
  include_downloads?: boolean;
  include_people?: boolean;
}

export interface Chapter {
  start_time: number;
  title: string;
  image_url?: string;
}

export interface Transcript {
  language: string;
  transcript_url: string;
}

export interface Episode {
  episode_id: string;
  title: string;
  description: string;
  status: string;
  publish_date: string;
  episode_nr?: number;
  season_nr?: number;
  duration: string;
  enclosure_url: string;
  link: string;
  image_url: string;
  downloads?: number;
  chapters?: Chapter[];
  transcript?: Transcript;
}

export interface GetEpisodeInput {
  episode_id: string;
  include_transcript?: boolean;
  include_chapters?: boolean;
  include_downloads?: boolean;
  include_people?: boolean;
}

export interface UpdateEpisodeInput {
  episode_id: string;
  title?: string;
  description?: string;
  episode_nr?: number;
  season_nr?: number;
  image_url?: string;
}

export interface UpdateEpisodeOutput {
  episode_id: string;
  title?: string;
  description?: string;
  episode_nr?: number;
  season_nr?: number;
  image_url?: string;
}

export interface DeleteEpisodeInput {
  episode_id: string;
}

export type EpisodeStatus = 0 | 1 | 2 | 3 | 4 | 5;

export const EpisodeStatusMap: Record<EpisodeStatus, string> = {
  0: 'Draft',
  1: 'Scheduled',
  2: 'Published',
  3: 'LivePending',
  4: 'Live',
  5: 'LiveEnded'
};

export interface ApiError {
  status: number;
  message: string;
}
