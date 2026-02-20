"""PodHome MCP Server - Tool Definitions."""

import logging
from typing import Annotated, Any

from fastmcp import FastMCP

from .client import PodhomeClient
from .config import Config

logger = logging.getLogger(__name__)


def register_tools(mcp: FastMCP, config: Config):
    """Register all MCP tools with the server."""

    # ========== Utility Tools ==========

    @mcp.tool()
    def list_shows() -> str:
        """List all configured Podhome show slugs."""
        return "\n".join(config.shows.keys())

    # ========== Episode Tools ==========

    @mcp.tool()
    async def create_episode(
        show: str,
        file_url: str,
        title: str,
        description: Annotated[str | None, "Optional episode description (can contain HTML)"] = None,
        link: Annotated[str | None, "Optional canonical link for the episode"] = None,
        publish_date: Annotated[str | None, "UTC ISO-8601 future date to schedule publishing"] = None,
        use_podhome_ai: Annotated[bool | None, "Run Podhome AI to generate transcript and artifacts"] = None,
        suggest_chapters: Annotated[bool | None, "Generate chapters (requires use_podhome_ai=true)"] = None,
        suggest_details: Annotated[bool | None, "Generate description and title suggestions (requires use_podhome_ai=true)"] = None,
        suggest_clips: Annotated[bool | None, "Generate clips (requires use_podhome_ai=true)"] = None,
        enhance_audio: Annotated[bool | None, "Run audio enhancement (paid feature)"] = None,
    ) -> str:
        """
        Create a new episode for a specific show.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS (e.g., "my-main-podcast")
            file_url: Publicly accessible URL to the media file
            title: Episode title
            description: Optional episode description (can contain HTML)
            link: Optional canonical link for the episode
            publish_date: UTC ISO-8601 future date to schedule publishing
            use_podhome_ai: Run Podhome AI to generate transcript and artifacts
            suggest_chapters: Generate chapters (requires use_podhome_ai=true)
            suggest_details: Generate description and title suggestions
            suggest_clips: Generate clips (requires use_podhome_ai=true)
            enhance_audio: Run audio enhancement (paid feature)
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload: dict[str, Any] = {"file_url": file_url, "title": title}
            if description is not None:
                payload["description"] = description
            if link is not None:
                payload["link"] = link
            if publish_date is not None:
                payload["publish_date"] = publish_date
            if use_podhome_ai is not None:
                payload["use_podhome_ai"] = use_podhome_ai
            if suggest_chapters is not None:
                payload["suggest_chapters"] = suggest_chapters
            if suggest_details is not None:
                payload["suggest_details"] = suggest_details
            if suggest_clips is not None:
                payload["suggest_clips"] = suggest_clips
            if enhance_audio is not None:
                payload["enhance_audio"] = enhance_audio

            result = await client.create_episode(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("create_episode failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def list_episodes(
        show: str,
        status: Annotated[int | None, "Status filter: 0=Draft, 1=Scheduled, 2=Published, 3=LivePending, 4=Live, 5=LiveEnded"] = None,
        include_transcript: Annotated[bool | None, "Include transcript in response"] = None,
        include_chapters: Annotated[bool | None, "Include chapters in response"] = None,
        include_downloads: Annotated[bool | None, "Include download counts"] = None,
        include_people: Annotated[bool | None, "Include people in response"] = None,
    ) -> str:
        """
        List episodes for a specific show.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            status: Optional status filter (0-5)
            include_transcript: Include transcript in response
            include_chapters: Include chapters in response
            include_downloads: Include download counts
            include_people: Include people in response
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            result = await client.list_episodes(
                status=status,
                include_transcript=include_transcript,
                include_chapters=include_chapters,
                include_downloads=include_downloads,
                include_people=include_people,
            )
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("list_episodes failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def schedule_episode(
        show: str,
        episode_id: str,
        publish_now: Annotated[bool | None, "Publish immediately (overrides publish_date)"] = None,
        publish_date: Annotated[str | None, "Future UTC ISO-8601 publish date"] = None,
    ) -> str:
        """
        Schedule or publish an episode.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            episode_id: The ID of the episode to schedule
            publish_now: Publish immediately
            publish_date: Future UTC ISO-8601 publish date
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload: dict[str, Any] = {"episode_id": episode_id}
            if publish_now is not None:
                payload["publish_now"] = publish_now
            if publish_date is not None:
                payload["publish_date"] = publish_date

            result = await client.schedule_episode(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("schedule_episode failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def modify_episode(
        show: str,
        episode_id: str,
        title: Annotated[str | None, "New episode title (max 2048 chars)"] = None,
        description: Annotated[str | None, "New description (can contain HTML)"] = None,
        episode_nr: Annotated[int | None, "Episode number (must be > 0)"] = None,
        season_nr: Annotated[int | None, "Season number (must be > 0)"] = None,
        image_url: Annotated[str | None, "Image URL (public HTTP/HTTPS)"] = None,
        image_data: Annotated[str | None, "Base64 encoded image data"] = None,
    ) -> str:
        """
        Modify an episode's metadata.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            episode_id: ID of the episode to modify
            title: New episode title
            description: New description (can contain HTML)
            episode_nr: Episode number
            season_nr: Season number
            image_url: Image URL
            image_data: Base64 encoded image data
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload: dict[str, Any] = {"episode_id": episode_id}
            if title is not None:
                payload["title"] = title
            if description is not None:
                payload["description"] = description
            if episode_nr is not None:
                payload["episode_nr"] = episode_nr
            if season_nr is not None:
                payload["season_nr"] = season_nr
            if image_url is not None:
                payload["image_url"] = image_url
            if image_data is not None:
                payload["image_data"] = image_data

            result = await client.modify_episode(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("modify_episode failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    # ========== Clip Tools ==========

    @mcp.tool()
    async def create_clip(
        show: str,
        episode_id: str,
        title: str,
        start_time: float,
        duration: float,
    ) -> str:
        """
        Create a clip (soundbite) from an episode.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            episode_id: ID of the episode to clip
            title: Title of the clip
            start_time: Start time in seconds (can be fractional)
            duration: Duration in seconds (can be fractional)
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload = {
                "episode_id": episode_id,
                "title": title,
                "start_time": start_time,
                "duration": duration,
            }
            result = await client.create_clip(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("create_clip failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    # ========== Webhook Tools ==========

    @mcp.tool()
    async def list_webhooks(show: str) -> str:
        """
        List all registered webhooks for a specific show.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            result = await client.list_webhooks()
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("list_webhooks failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def register_webhook(
        show: str,
        url: str,
        action_type: str,
    ) -> str:
        """
        Register a new webhook.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            url: Webhook endpoint URL
            action_type: Action type - "episode_published" or "episode_live"
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload = {"url": url, "action_type": action_type}
            result = await client.register_webhook(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("register_webhook failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def delete_webhook(
        show: str,
        integration_id: str,
    ) -> str:
        """
        Delete a webhook.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            integration_id: The ID of the webhook to delete
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload = {"integration_id": integration_id}
            result = await client.delete_webhook(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("delete_webhook failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"

    @mcp.tool()
    async def test_webhook(
        show: str,
        integration_id: str | None = None,
    ) -> str:
        """
        Test webhooks. Your webhook is called with data from the latest published or live episode.

        Args:
            show: One of the slugs configured in PODHOME_SHOWS
            integration_id: Optional specific webhook ID to test
        """
        try:
            client = PodhomeClient(config.get_api_key(show), config.base_url)
            payload = {"integration_id": integration_id} if integration_id else None
            result = await client.test_webhook(payload)
            await client.aclose()
            return str(result)
        except Exception as e:
            logger.error("test_webhook failed for %s: %s", show, e, exc_info=True)
            return f"Error: {e}"
