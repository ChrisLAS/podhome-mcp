import { PodhomeClient } from '../clients/podhome.js';
import { validateUUID } from '../utils.js';
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

  const client = new PodhomeClient();
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
