"""Google ID token verifier."""

from app.config import GOOGLE_CLIENT_ID
from app.services.oauth.base import OAuthIdentity, OAuthVerifyError


class GoogleVerifier:
    provider = "google"

    def verify(self, credential: str) -> OAuthIdentity:
        if not GOOGLE_CLIENT_ID:
            raise OAuthVerifyError("Google sign-in is not configured")

        # Imported lazily so tests can monkeypatch and the dep stays optional at import time.
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        try:
            payload = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                GOOGLE_CLIENT_ID,
            )
        except ValueError as exc:
            raise OAuthVerifyError(f"Invalid Google credential: {exc}") from exc

        sub = payload.get("sub")
        email = payload.get("email")
        if not sub or not email:
            raise OAuthVerifyError("Google credential missing sub or email")

        return OAuthIdentity(
            provider=self.provider,
            provider_account_id=str(sub),
            email=str(email).lower(),
            email_verified=bool(payload.get("email_verified", False)),
            full_name=payload.get("name"),
            picture=payload.get("picture"),
        )
