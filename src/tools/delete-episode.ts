import { PodhomeClient } from '../clients/podhome.js';
import { resolvePodhomeApiKey, validateUUID } from '../utils.js';
import type { DeleteEpisodeInput } from '../types.js';

export const deleteEpisodeTool = {
  name: 'delete_episode',
  description: 'Delete an episode',
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
      }
    },
    required: ['episode_id']
  }
};

export async function handleDeleteEpisode(args: DeleteEpisodeInput): Promise<{ content: Array<{ type: string; text: string }> }> {
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
  await client.deleteEpisode(args.episode_id);

  return {
    content: [
      {
        type: 'text',
        text: `Deleted episode ${args.episode_id}`
      }
    ]
  };
}
