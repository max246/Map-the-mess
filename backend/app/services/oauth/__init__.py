"""OAuth provider registry — pluggable identity verifiers."""

from app.services.oauth.base import OAuthIdentity, OAuthVerifier, OAuthVerifyError
from app.services.oauth.google import GoogleVerifier

PROVIDERS: dict[str, OAuthVerifier] = {
    "google": GoogleVerifier(),
}


def get_verifier(provider: str) -> OAuthVerifier | None:
    return PROVIDERS.get(provider)


__all__ = ["OAuthIdentity", "OAuthVerifier", "OAuthVerifyError", "get_verifier", "PROVIDERS"]
