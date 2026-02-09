import { PodhomeClient } from '../clients/podhome.js';
import { resolvePodhomeApiKey, validateURL, validateISO8601 } from '../utils.js';
import type { CreateEpisodeInput, CreateEpisodeOutput } from '../types.js';

export const createEpisodeTool = {
  name: 'create_episode',
  description: 'Create a new episode (draft) in Podhome',
  inputSchema: {
    type: 'object',
    properties: {
      file_url: {
        type: 'string',
        description: 'Public R2/S3 URL to audio file'
      },
      title: {
        type: 'string',
        description: 'Episode title'
      },
      podhome_api_key: {
        type: 'string',
        description: 'Override the Podhome API key for this request'
      },
      podhome_api_key_name: {
        type: 'string',
        description: 'Select a named key from PODHOME_API_KEYS'
      },
      description: {
        type: 'string',
        description: 'Episode description/show notes'
      },
      episode_nr: {
        type: 'number',
        description: 'Episode number'
      },
      season_nr: {
        type: 'number',
        description: 'Season number'
      },
      link: {
        type: 'string',
        description: 'Episode webpage URL'
      },
      publish_date: {
        type: 'string',
        description: 'ISO-8601 UTC datetime (future = scheduled)'
      },
      use_podhome_ai: {
        type: 'boolean',
        description: 'Default false (audio already processed by Auphonic)'
      },
      suggest_chapters: {
        type: 'boolean',
        description: 'Default false'
      },
      suggest_details: {
        type: 'boolean',
        description: 'Default false'
      },
      suggest_clips: {
        type: 'boolean',
        description: 'Default false'
      },
      enhance_audio: {
        type: 'boolean',
        description: 'Default false (audio already processed by Auphonic)'
      }
    },
    required: ['file_url', 'title']
  }
};

export async function handleCreateEpisode(args: CreateEpisodeInput): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate file_url
  if (!validateURL(args.file_url)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Validation error: file_url must be a valid URL'
        }
      ]
    };
  }

  // Validate publish_date if provided
  if (args.publish_date && !validateISO8601(args.publish_date)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Validation error: publish_date must be a valid ISO-8601 datetime'
        }
      ]
    };
  }

  const client = new PodhomeClient(resolvePodhomeApiKey(args));
  const result: CreateEpisodeOutput = await client.createEpisode(args);

  return {
    content: [
      {
        type: 'text',
        text: `Created episode "${args.title}" (ID: ${result.episodeId})
Status: Draft`
      }
    ]
  };
}
