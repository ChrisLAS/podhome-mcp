"""PodHome MCP Server - HTTP Client Module."""

import httpx


class PodhomeClient:
    """Async HTTP client for the PodHome Integration API."""

    def __init__(self, api_key: str, base_url: str):
        """Initialize the client with API key and base URL."""
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"X-API-KEY": api_key},
            timeout=60.0,
            follow_redirects=True,
        )

    # ========== Episodes ==========

    async def create_episode(self, payload: dict) -> dict:
        """Create a new episode."""
        r = await self._client.post("/api/createepisode", json=payload)
        r.raise_for_status()
        return r.json()

    async def list_episodes(
        self,
        status: int | None = None,
        include_transcript: bool | None = None,
        include_chapters: bool | None = None,
        include_downloads: bool | None = None,
        include_people: bool | None = None,
    ) -> list:
        """List episodes with optional filters."""
        params = {}
        if status is not None:
            params["status"] = status
        if include_transcript is not None:
            params["includeTranscript"] = include_transcript
        if include_chapters is not None:
            params["includeChapters"] = include_chapters
        if include_downloads is not None:
            params["includeDownloads"] = include_downloads
        if include_people is not None:
            params["includePeople"] = include_people

        r = await self._client.get("/api/episodes", params=params if params else None)
        r.raise_for_status()
        return r.json()

    async def schedule_episode(self, payload: dict) -> dict:
        """Schedule or publish an episode."""
        r = await self._client.post("/api/schedule_episode", json=payload)
        r.raise_for_status()
        return r.json()

    async def modify_episode(self, payload: dict) -> dict:
        """Modify an episode's metadata."""
        r = await self._client.post("/api/modify_episode", json=payload)
        r.raise_for_status()
        return r.json()

    # ========== Clips ==========

    async def create_clip(self, payload: dict) -> dict:
        """Create a clip (soundbite) from an episode."""
        r = await self._client.post("/api/createclip", json=payload)
        r.raise_for_status()
        return r.json()

    # ========== Webhooks ==========

    async def list_webhooks(self) -> list:
        """List all registered webhooks."""
        r = await self._client.get("/api/hook")
        r.raise_for_status()
        return r.json()

    async def register_webhook(self, payload: dict) -> dict:
        """Register a new webhook."""
        r = await self._client.post("/api/hook", json=payload)
        r.raise_for_status()
        return r.json()

    async def delete_webhook(self, payload: dict) -> dict:
        """Delete a webhook."""
        r = await self._client.request("DELETE", "/api/hook", json=payload)
        r.raise_for_status()
        return r.json()

    async def test_webhook(self, payload: dict | None = None) -> dict:
        """Test webhooks."""
        r = await self._client.post(
            "/api/hooktest", json=payload if payload else {}
        )
        r.raise_for_status()
        return r.json()

    async def aclose(self):
        """Close the HTTP client."""
        await self._client.aclose()
