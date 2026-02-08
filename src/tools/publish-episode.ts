import { PodhomeClient } from '../clients/podhome.js';
import { validateUUID, validateISO8601 } from '../utils.js';
import type { PublishEpisodeInput, PublishEpisodeOutput } from '../types.js';

export const publishEpisodeTool = {
  name: 'publish_episode',
  description: 'Publish or schedule an existing episode',
  inputSchema: {
    type: 'object',
    properties: {
      episode_id: {
        type: 'string',
        description: 'UUID from create_episode'
      },
      publish_now: {
        type: 'boolean',
        description: 'Default true'
      },
      publish_date: {
        type: 'string',
        description: 'ISO-8601 UTC (ignored if publish_now=true)'
      }
    },
    required: ['episode_id']
  }
};

export async function handlePublishEpisode(args: PublishEpisodeInput): Promise<{ content: Array<{ type: string; text: string }> }> {
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

  // Validate publish_date if provided and not publishing now
  if (!args.publish_now && args.publish_date && !validateISO8601(args.publish_date)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Validation error: publish_date must be a valid ISO-8601 datetime'
        }
      ]
    };
  }

  const client = new PodhomeClient();
  const result: PublishEpisodeOutput = await client.publishEpisode(args);

  return {
    content: [
      {
        type: 'text',
        text: `Episode ${result.episode_id} published at ${result.publish_date}
Status: ${result.status}`
      }
    ]
  };
}
