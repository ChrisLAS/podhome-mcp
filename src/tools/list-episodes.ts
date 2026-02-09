import { PodhomeClient } from '../clients/podhome.js';
import { formatEpisodesTable, resolvePodhomeApiKey, validateEpisodeStatus } from '../utils.js';
import type { ListEpisodesInput } from '../types.js';

export const listEpisodesTool = {
  name: 'list_episodes',
  description: 'List episodes with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'number',
        description: '0=Draft, 1=Scheduled, 2=Published, 3=LivePending, 4=Live, 5=LiveEnded'
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
    }
  }
};

export async function handleListEpisodes(args: ListEpisodesInput): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate status if provided
  if (args.status !== undefined && !validateEpisodeStatus(args.status)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Validation error: status must be 0-5 (0=Draft, 1=Scheduled, 2=Published, 3=LivePending, 4=Live, 5=LiveEnded)'
        }
      ]
    };
  }

  const client = new PodhomeClient(resolvePodhomeApiKey(args));
  const episodes = await client.listEpisodes(args);

  const table = formatEpisodesTable(episodes);

  return {
    content: [
      {
        type: 'text',
        text: `Found ${episodes.length} episodes:\n\n${table}`
      }
    ]
  };
}
