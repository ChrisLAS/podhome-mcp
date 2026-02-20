"""PodHome MCP Server - Configuration Module."""

import json
import logging
from typing import Dict

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Config(BaseSettings):
    """Configuration for the PodHome MCP server."""

    base_url: str = Field("https://serve.podhome.fm", alias="PODHOME_BASE_URL")
    shows: Dict[str, SecretStr] = Field(
        ..., description="show_slug -> API key mapping", alias="PODHOME_SHOWS"
    )

    model_config = SettingsConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    @field_validator("shows", mode="before")
    @classmethod
    def parse_shows_json(cls, v):
        """Parse PODHOME_SHOWS JSON string into a dict of SecretStr."""
        if isinstance(v, str):
            try:
                raw = json.loads(v)
                return {k.strip(): SecretStr(str(raw[k])) for k in raw}
            except Exception as e:
                raise ValueError(f"PODHOME_SHOWS must be valid JSON dict: {e}")
        if isinstance(v, dict):
            return {k.strip(): SecretStr(str(v)) for k, v in v.items()}
        raise ValueError("PODHOME_SHOWS must be a JSON string or dict")

    def get_api_key(self, show: str) -> str:
        """Get the API key for a specific show."""
        if show not in self.shows:
            raise ValueError(
                f"Unknown show '{show}'. Configured shows: {list(self.shows.keys())}"
            )
        return self.shows[show].get_secret_value()


def load_config() -> Config:
    """Load and return the configuration."""
    cfg = Config()  # type: ignore[call-arg]
    logger.info("Loaded Podhome shows: %s", list(cfg.shows.keys()))
    return cfg
