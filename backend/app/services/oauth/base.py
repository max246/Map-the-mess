"""Provider-agnostic OAuth identity types."""

from dataclasses import dataclass
from typing import Protocol


class OAuthVerifyError(Exception):
    """Raised when a credential cannot be verified or is invalid."""


@dataclass(frozen=True)
class OAuthIdentity:
    provider: str
    provider_account_id: str
    email: str
    email_verified: bool
    full_name: str | None = None
    picture: str | None = None


class OAuthVerifier(Protocol):
    provider: str

    def verify(self, credential: str) -> OAuthIdentity:
        """Verify a provider credential and return a normalised identity.

        Raises OAuthVerifyError on any failure (bad signature, expired,
        wrong audience, missing email, etc.).
        """
        ...
