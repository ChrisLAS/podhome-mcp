#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { getR2PublicUrlTool, handleGetR2PublicUrl } from './tools/get-r2-public-url.js';
import { createEpisodeTool, handleCreateEpisode } from './tools/create-episode.js';
import { publishEpisodeTool, handlePublishEpisode } from './tools/publish-episode.js';
import { listEpisodesTool, handleListEpisodes } from './tools/list-episodes.js';
import { getEpisodeTool, handleGetEpisode } from './tools/get-episode.js';
import { updateEpisodeTool, handleUpdateEpisode } from './tools/update-episode.js';
import { deleteEpisodeTool, handleDeleteEpisode } from './tools/delete-episode.js';

// Logging utility
const logLevel = process.env.LOG_LEVEL || 'info';
const levels = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: keyof typeof levels, message: string) {
  if (levels[level] >= levels[logLevel as keyof typeof levels]) {
    console.error(`[${level.toUpperCase()}] ${message}`);
  }
}

const server = new Server(
  {
    name: 'podhome',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      getR2PublicUrlTool,
      createEpisodeTool,
      publishEpisodeTool,
      listEpisodesTool,
      getEpisodeTool,
      updateEpisodeTool,
      deleteEpisodeTool
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log('info', `Calling tool: ${name}`);

  try {
    switch (name) {
      case 'get_r2_public_url':
        return await handleGetR2PublicUrl(args as any);
      
      case 'create_episode':
        return await handleCreateEpisode(args as any);
      
      case 'publish_episode':
        return await handlePublishEpisode(args as any);
      
      case 'list_episodes':
        return await handleListEpisodes(args as any);
      
      case 'get_episode':
        return await handleGetEpisode(args as any);
      
      case 'update_episode':
        return await handleUpdateEpisode(args as any);
      
      case 'delete_episode':
        return await handleDeleteEpisode(args as any);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error in ${name}: ${errorMessage}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const port = process.env.MCP_PORT;
  const host = process.env.MCP_HOST || '127.0.0.1';

  if (port) {
    // HTTP/SSE mode
    const app = express();
    const portNum = parseInt(port, 10);

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/sse', async (req, res) => {
      log('info', 'New SSE connection established');
      const transport = new SSEServerTransport('/message', res);
      await server.connect(transport);
    });

    app.post('/message', express.json(), async (req, res) => {
      // Note: In production, you'd need to track the transport instance
      // This is a simplified implementation
      res.status(200).json({ status: 'received' });
    });

    app.listen(portNum, host, () => {
      log('info', `Podhome MCP server listening on http://${host}:${portNum}`);
      log('info', `SSE endpoint: http://${host}:${portNum}/sse`);
      log('info', `Health check: http://${host}:${portNum}/health`);
    });
  } else {
    // STDIO mode (default for MCP CLI usage)
    log('info', 'Starting Podhome MCP server in stdio mode');
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
