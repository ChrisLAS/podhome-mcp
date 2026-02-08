import { PodhomeClient } from '../clients/podhome.js';
import { validateUUID } from '../utils.js';
import type { UpdateEpisodeInput, UpdateEpisodeOutput } from '../types.js';

export const updateEpisodeTool = {
  name: 'update_episode',
  description: 'Update episode metadata',
  inputSchema: {
    type: 'object',
    properties: {
      episode_id: {
        type: 'string',
        description: 'UUID'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      episode_nr: {
        type: 'number'
      },
      season_nr: {
        type: 'number'
      },
      image_url: {
        type: 'string'
      }
    },
    required: ['episode_id']
  }
};

export async function handleUpdateEpisode(args: UpdateEpisodeInput): Promise<{ content: Array<{ type: string; text: string }> }> {
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
  const result: UpdateEpisodeOutput = await client.updateEpisode(args);

  // Determine which fields were updated
  const changedFields: string[] = [];
  if (result.title !== undefined) changedFields.push('title');
  if (result.description !== undefined) changedFields.push('description');
  if (result.episode_nr !== undefined) changedFields.push('episode_nr');
  if (result.season_nr !== undefined) changedFields.push('season_nr');
  if (result.image_url !== undefined) changedFields.push('image_url');

  return {
    content: [
      {
        type: 'text',
        text: `Updated episode ${result.episode_id}\nChanged: ${changedFields.join(', ') || 'none'}`
      }
    ]
  };
}
