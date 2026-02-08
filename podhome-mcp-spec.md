# Podhome MCP Server Technical Specification

## Purpose
MCP server for publishing podcast episodes to Podhome after Auphonic processing. Handles episode creation, scheduling, and publishing via Podhome Integration API.

## Core Workflow Context
1. User uploads audio to Auphonic for processing (loudness normalization, noise reduction, encoding)
2. Auphonic outputs processed file to Cloudflare R2 storage (S3-compatible)
3. **R2 URL Resolution**: Auphonic's webhook returns a private R2 URL that must be converted to a public URL via Cloudflare R2 API
4. User calls MCP tools to create/publish episode in Podhome using the public R2 URL
5. Podhome pulls audio from R2 and hosts the episode

### R2 URL Resolution Challenge
- Auphonic uploads to R2 via service preset configuration
- Returned URLs from Auphonic are NOT publicly accessible
- Must fetch public URL from Cloudflare R2 API based on:
  - Bucket name (stored in Auphonic service preset)
  - Object key/path (returned by Auphonic webhook)
  - R2 custom domain or public bucket URL

## MCP Server Requirements

### Server Metadata
```typescript
{
  name: "podhome",
  version: "1.0.0",
  description: "Publish podcast episodes to Podhome from Auphonic-processed audio stored in Cloudflare R2"
}
```

### Configuration (Environment Variables)
- `PODHOME_API_KEY` (required): Show API key from Podhome
- `PODHOME_BASE_URL` (optional): Default `https://api.podhome.fm`
- `CLOUDFLARE_ACCOUNT_ID` (required): Cloudflare account ID for R2 API access
- `CLOUDFLARE_R2_ACCESS_KEY_ID` (required): R2 access key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (required): R2 secret access key
- `R2_PUBLIC_DOMAIN` (optional): Custom domain for R2 public access (e.g., `cdn.podcast.com`)

### Authentication
- Podhome: All requests use `X-API-KEY` header with the API key
- Cloudflare R2: AWS S3-compatible authentication (access key + secret key)

## Tools

### 1. `get_r2_public_url`
Convert Auphonic's private R2 URL to a publicly accessible URL.

**Input Schema:**
```typescript
{
  bucket: string,            // Required: R2 bucket name (from Auphonic service preset)
  object_key: string,        // Required: Object path in R2 (from Auphonic output)
  custom_domain?: string     // Optional: Override R2_PUBLIC_DOMAIN env var
}
```

**Auphonic Integration Note:**
When Auphonic completes processing and uploads to R2, the webhook/API response contains:
- Output file information with S3/R2 path
- Extract `bucket` from the service preset configuration
- Extract `object_key` from the output file path (e.g., `podcasts/show-name/episode-42.mp3`)

**Process:**
1. Use Cloudflare R2 API (S3-compatible) to verify object exists
2. Construct public URL based on:
   - Custom domain: `https://{custom_domain}/{object_key}`
   - Or R2 public bucket: `https://{bucket}.{account_id}.r2.cloudflarestorage.com/{object_key}`
3. Optionally generate presigned URL if bucket is private

**Response:**
```typescript
{
  public_url: string,        // Public URL for Podhome
  bucket: string,
  object_key: string,
  size_bytes: number,
  last_modified: string
}
```

**Return to User:**
```
R2 File: {object_key}
Bucket: {bucket}
Size: {size_bytes / 1024 / 1024}MB
Public URL: {public_url}
```

---

### 2. `create_episode`
Create a new episode (draft) in Podhome.

**Input Schema:**
```typescript
{
  file_url: string,          // Required: Public R2/S3 URL to audio file
  title: string,             // Required: Episode title
  description?: string,      // Optional: Episode description/show notes
  episode_nr?: number,       // Optional: Episode number
  season_nr?: number,        // Optional: Season number
  link?: string,             // Optional: Episode webpage URL
  publish_date?: string,     // Optional: ISO-8601 UTC datetime (future = scheduled)
  use_podhome_ai?: boolean,  // Optional: Default false (audio already processed by Auphonic)
  suggest_chapters?: boolean,// Optional: Default false
  suggest_details?: boolean, // Optional: Default false
  suggest_clips?: boolean,   // Optional: Default false
  enhance_audio?: boolean    // Optional: Default false (audio already processed by Auphonic)
}
```

**Default Behavior:**
- `use_podhome_ai`: false (audio pre-processed by Auphonic)
- `enhance_audio`: false (audio pre-processed by Auphonic)
- `suggest_chapters`: false
- `suggest_details`: false
- `suggest_clips`: false

**API Call:**
```
POST /api/createepisode
Content-Type: application/json
X-API-KEY: {PODHOME_API_KEY}
```

**Response:**
```typescript
{
  episodeId: string  // UUID of created episode
}
```

**Return to User:**
```
Created episode "{title}" (ID: {episodeId})
Status: Draft
```

---

### 3. `publish_episode`
Publish or schedule an existing episode.

**Input Schema:**
```typescript
{
  episode_id: string,        // Required: UUID from create_episode
  publish_now?: boolean,     // Optional: Default true
  publish_date?: string      // Optional: ISO-8601 UTC (ignored if publish_now=true)
}
```

**API Call:**
```
POST /api/scheduleepisode
Content-Type: application/json
X-API-KEY: {PODHOME_API_KEY}
```

**Response:**
```typescript
{
  episode_id: string,
  publish_date: string,      // ISO-8601
  status: string            // "Published" or "Scheduled"
}
```

**Return to User:**
```
Episode {episode_id} published at {publish_date}
Status: {status}
```

---

### 4. `list_episodes`
List episodes with optional filtering.

**Input Schema:**
```typescript
{
  status?: number,           // Optional: 0=Draft, 1=Scheduled, 2=Published, 3=LivePending, 4=Live, 5=LiveEnded
  include_transcript?: boolean,
  include_chapters?: boolean,
  include_downloads?: boolean,
  include_people?: boolean
}
```

**API Call:**
```
GET /api/episodes?status={status}&includeTranscript={bool}&...
X-API-KEY: {PODHOME_API_KEY}
```

**Response:**
```typescript
Array<{
  episode_id: string,
  title: string,
  description: string,
  status: string,
  publish_date: string,
  episode_nr?: number,
  season_nr?: number,
  duration: string,
  enclosure_url: string,
  link: string,
  image_url: string,
  downloads?: number,
  chapters?: Array<{start_time: number, title: string, image_url?: string}>,
  transcript?: {language: string, transcript_url: string}
}>
```

**Return to User (Formatted Table):**
```
Found {count} episodes:

ID | Title | Episode # | Status | Published
---|-------|-----------|--------|----------
... episodes in clean table format ...
```

---

### 5. `get_episode`
Get detailed info for a specific episode.

**Input Schema:**
```typescript
{
  episode_id: string,        // Required: UUID
  include_transcript?: boolean,
  include_chapters?: boolean,
  include_downloads?: boolean,
  include_people?: boolean
}
```

**API Call:**
```
GET /api/episode/{episode_id}?includeTranscript={bool}&...
X-API-KEY: {PODHOME_API_KEY}
```

**Response:** Same structure as single episode in `list_episodes`

**Return to User:**
```
Episode: {title}
ID: {episode_id}
Number: S{season_nr}E{episode_nr}
Status: {status}
Published: {publish_date}
Duration: {duration}
Downloads: {downloads}
URL: {link}
Audio: {enclosure_url}

Description:
{description}

[Chapters if included]
[Transcript if included]
```

---

### 6. `update_episode`
Update episode metadata.

**Input Schema:**
```typescript
{
  episode_id: string,        // Required: UUID
  title?: string,
  description?: string,
  episode_nr?: number,
  season_nr?: number,
  image_url?: string
}
```

**API Call:**
```
PUT /api/updateepisode
Content-Type: application/json
X-API-KEY: {PODHOME_API_KEY}
```

**Response:**
```typescript
{
  episode_id: string,
  title?: string,
  description?: string,
  episode_nr?: number,
  season_nr?: number,
  image_url?: string
}
```

**Return to User:**
```
Updated episode {episode_id}
Changed: {list of updated fields}
```

---

### 7. `delete_episode`
Delete an episode.

**Input Schema:**
```typescript
{
  episode_id: string         // Required: UUID
}
```

**API Call:**
```
DELETE /api/deleteepisode/{episode_id}
X-API-KEY: {PODHOME_API_KEY}
```

**Response:** 204 No Content

**Return to User:**
```
Deleted episode {episode_id}
```

## Error Handling

All tools should handle these HTTP status codes:

- `200/201`: Success
- `400`: Bad Request - Return validation error message to user
- `401`: Unauthorized - "Invalid API key. Check PODHOME_API_KEY environment variable"
- `404`: Not Found - "Episode not found: {episode_id}"
- `500`: Server Error - "Podhome API error: {error message}"

## Token Optimization Strategies

1. **Minimal Responses**: Return only essential info to user
2. **Structured Output**: Use tables/lists instead of prose
3. **No Redundancy**: Don't repeat input parameters in output
4. **Lazy Loading**: Only fetch extra data (transcripts/chapters) when explicitly requested
5. **Batch Operations**: If listing episodes, use concise table format
6. **Error Messages**: Short, actionable error descriptions
7. **Omit Nulls**: Don't include optional fields that are null/empty in responses

## Example Usage Flow

```bash
# 1. Get public R2 URL from Auphonic output
get_r2_public_url {
  bucket: "my-podcast-audio",
  object_key: "episodes/2026/ep42-final.mp3"
}
# Returns: { public_url: "https://cdn.mypodcast.com/episodes/2026/ep42-final.mp3" }

# 2. Create draft episode with R2 URL
create_episode {
  file_url: "https://cdn.mypodcast.com/episodes/2026/ep42-final.mp3",
  title: "The Future of AI",
  description: "We discuss...",
  episode_nr: 42,
  season_nr: 1,
  use_podhome_ai: false,
  enhance_audio: false
}
# Returns: episodeId

# 3. Review before publishing
get_episode {
  episode_id: "{episodeId}"
}

# 4. Publish immediately
publish_episode {
  episode_id: "{episodeId}",
  publish_now: true
}

# 5. Or schedule for future
publish_episode {
  episode_id: "{episodeId}",
  publish_now: false,
  publish_date: "2026-03-01T10:00:00Z"
}
```

## Implementation Notes

### HTTP Client
- Use native `fetch` or `axios`
- Set timeout to 30 seconds
- Retry on network errors (max 2 retries)

### R2 Client (S3-Compatible)
- Use AWS SDK v3 (@aws-sdk/client-s3) or compatible S3 client
- Configure endpoint: `https://{account_id}.r2.cloudflarestorage.com`
- Authentication via access key + secret key
- Operations needed:
  - HeadObject (check file exists, get metadata)
  - GetObjectCommand + getSignedUrl (generate presigned URLs if needed)

### Public URL Construction
**Option 1: Custom Domain (Recommended)**
```typescript
const publicUrl = `https://${customDomain}/${objectKey}`;
```

**Option 2: R2 Public Bucket**
```typescript
const publicUrl = `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
```

**Option 3: Presigned URL (Private Buckets)**
```typescript
// Generate temporary presigned URL (valid for 7 days)
const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
const publicUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
```

### Validation
- Validate `file_url` is a valid URL
- Validate `publish_date` is ISO-8601 format and future date
- Validate `episode_id` is valid UUID format
- Validate `status` enum values (0-5)

### Base URL Construction
```typescript
const baseUrl = process.env.PODHOME_BASE_URL || 'https://api.podhome.fm';
```

### Headers Template
```typescript
{
  'Content-Type': 'application/json',
  'X-API-KEY': process.env.PODHOME_API_KEY
}
```

## Testing Considerations

Mock API responses for:
- Successful episode creation
- Publishing/scheduling
- Episode not found (404)
- Invalid API key (401)
- Validation errors (400)

## Dependencies
- MCP SDK (@modelcontextprotocol/sdk)
- AWS SDK v3 for S3 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- HTTP client (native fetch or axios)
- TypeScript types should be generated from schemas above

## File Structure
```
podhome-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools/            # Tool implementations
│   │   ├── get-r2-public-url.ts
│   │   ├── create-episode.ts
│   │   ├── publish-episode.ts
│   │   ├── list-episodes.ts
│   │   ├── get-episode.ts
│   │   ├── update-episode.ts
│   │   └── delete-episode.ts
│   ├── clients/
│   │   ├── podhome.ts    # Podhome API client
│   │   └── r2.ts         # Cloudflare R2 (S3) client
│   ├── types.ts          # TypeScript interfaces
│   └── utils.ts          # Validation, formatting helpers
├── package.json
├── tsconfig.json
└── README.md
```

## README Requirements

Must include:
- Quick start (install, configure API keys for both Podhome and Cloudflare R2)
- Cloudflare R2 setup:
  - Creating R2 bucket
  - Generating access keys
  - Setting up custom domain (optional but recommended)
  - Configuring bucket as public or using presigned URLs
- Example usage with all tools
- Complete workflow: Auphonic → R2 → Podhome
- Link to Podhome API docs
- Link to Cloudflare R2 docs
- Troubleshooting common errors (invalid R2 credentials, bucket not found, file not accessible)
- Integration with Auphonic workflow example

---

**End of Specification**

This spec is designed for token-efficient implementation and usage. All responses are concise, structured, and avoid unnecessary verbosity while maintaining clarity and actionability.
