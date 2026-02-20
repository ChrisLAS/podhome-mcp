"""Tests for PodHome MCP Server."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from podhome_mcp.config import Config, load_config
from podhome_mcp.client import PodhomeClient


class TestConfig:
    """Tests for configuration loading."""

    def test_parse_shows_json_string(self):
        """Test parsing PODHOME_SHOWS as JSON string."""
        with patch.dict(
            "os.environ",
            {
                "PODHOME_BASE_URL": "https://serve.podhome.fm",
                "PODHOME_SHOWS": '{"show1": "key1", "show2": "key2"}',
            },
        ):
            config = Config()
            assert "show1" in config.shows
            assert "show2" in config.shows
            assert config.shows["show1"].get_secret_value() == "key1"
            assert config.base_url == "https://serve.podhome.fm"

    def test_get_api_key_success(self):
        """Test retrieving API key for valid show."""
        with patch.dict(
            "os.environ",
            {"PODHOME_SHOWS": '{"my-show": "my-api-key"}'},
        ):
            config = Config()
            key = config.get_api_key("my-show")
            assert key == "my-api-key"

    def test_get_api_key_failure(self):
        """Test retrieving API key for invalid show."""
        with patch.dict(
            "os.environ",
            {"PODHOME_SHOWS": '{"my-show": "my-api-key"}'},
        ):
            config = Config()
            with pytest.raises(ValueError) as exc_info:
                config.get_api_key("unknown-show")
            assert "Unknown show" in str(exc_info.value)


class TestPodhomeClient:
    """Tests for the PodhomeClient."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        return PodhomeClient("test-api-key", "https://serve.podhome.fm")

    def test_client_initialization(self, client):
        """Test client is initialized with correct headers."""
        assert client._client.headers["X-API-KEY"] == "test-api-key"
        assert client._client.base_url == "https://serve.podhome.fm"

    @pytest.mark.asyncio
    async def test_create_episode(self, client):
        """Test creating an episode."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"episodeId": "123"}
        mock_response.raise_for_status = MagicMock()

        client._client.post = AsyncMock(return_value=mock_response)

        result = await client.create_episode(
            {"file_url": "https://example.com/audio.mp3", "title": "Test Episode"}
        )

        assert result == {"episodeId": "123"}
        client._client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_episodes(self, client):
        """Test listing episodes."""
        mock_response = MagicMock()
        mock_response.json.return_value = [{"episode_id": "123", "title": "Test"}]
        mock_response.raise_for_status = MagicMock()

        client._client.get = AsyncMock(return_value=mock_response)

        result = await client.list_episodes()

        assert len(result) == 1
        assert result[0]["episode_id"] == "123"

    @pytest.mark.asyncio
    async def test_aclose(self, client):
        """Test closing the client."""
        client._client.aclose = AsyncMock()
        await client.aclose()
        client._client.aclose.assert_called_once()
