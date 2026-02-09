import { PodhomeClient } from '../clients/podhome.js';
import { resolvePodhomeApiKey, validateUUID, formatEpisodeNumber, formatDuration } from '../utils.js';
import type { GetEpisodeInput, Episode } from '../types.js';

export const getEpisodeTool = {
  name: 'get_episode',
  description: 'Get detailed info for a specific episode',
  inputSchema: {
    type: 'object',
    properties: {
      episode_id: {
        type: 'string',
        description: 'UUID'
      },
      podhome_api_key: {
        type: 'string',
        description: 'Override the Podhome API key for this request'
      },
      podhome_api_key_name: {
        type: 'string',
        description: 'Select a named key from PODHOME_API_KEYS'
      },
      include_transcript: {
        type: 'boolean'
      },
      include_chapters: {
        type: 'boolean'
      },
      include_downloads: {
        type: 'boolean'
      },
      include_people: {
        type: 'boolean'
      }
    },
    required: ['episode_id']
  }
};

export async function handleGetEpisode(args: GetEpisodeInput): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate episode_id is UUID
  if (!validateUUID(args.episode_id)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Validation error: episode_id must be a valid UUID'
        }
      ]
    };
  }

  const client = new PodhomeClient(resolvePodhomeApiKey(args));
  const episode: Episode = await client.getEpisode(
    args.episode_id,
    args.include_transcript,
    args.include_chapters,
    args.include_downloads,
    args.include_people
  );

  const episodeNum = formatEpisodeNumber(episode.season_nr, episode.episode_nr);

  let output = `Episode: ${episode.title}
ID: ${episode.episode_id}
Number: ${episodeNum}
Status: ${episode.status}
Published: ${episode.publish_date ? new Date(episode.publish_date).toLocaleString() : 'N/A'}
Duration: ${formatDuration(episode.duration)}`;

  if (episode.downloads !== undefined) {
    output += `\nDownloads: ${episode.downloads}`;
  }

  output += `\nURL: ${episode.link}
Audio: ${episode.enclosure_url}`;

  if (episode.description) {
    output += `\n\nDescription:\n${episode.description}`;
  }

  if (episode.chapters && episode.chapters.length > 0) {
    output += '\n\nChapters:';
    for (const chapter of episode.chapters) {
      const time = new Date(chapter.start_time * 1000).toISOString().substr(11, 8);
      output += `\n${time} - ${chapter.title}`;
    }
  }

  if (episode.transcript) {
    output += `\n\nTranscript (${episode.transcript.language}): ${episode.transcript.transcript_url}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: output
      }
    ]
  };
}
