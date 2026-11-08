"""Production Pages parameters: public fields only, fixed target, read-only preflight."""

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent.parent
PROD_API = "https://oqoqrxwfbkhtpksqimgd.supabase.co"
PROD_SITE = "https://vladoche.github.io/mon-bprea/"
PUBLIC_FIELDS = {"enabled", "environment", "url", "publishableKey", "siteUrl"}
NOTICE = ROOT / "docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md"


def validate_production_config(config):
    if (not isinstance(config, dict) or set(config) != PUBLIC_FIELDS
            or config.get("enabled") is not True
            or config.get("environment") != "production"
            or config.get("url") != PROD_API or config.get("siteUrl") != PROD_SITE
            or not isinstance(config.get("publishableKey"), str)
            or not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{16,256}", config["publishableKey"])):
        raise ValueError("Configuration de release absente ou invalide : cinq paramètres publics PROD exacts requis.")
    return config


def notice_sha256():
    # Stable on Windows checkout and Linux runner. The approved text is versioned.
    return hashlib.sha256(NOTICE.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def validate_notice_approval(approved):
    if (not re.fullmatch(r"[a-f0-9]{64}", approved or "")
            or not hmac.compare_digest(approved, notice_sha256())
            or re.search(r"en préparation", NOTICE.read_text(encoding="utf-8"), re.IGNORECASE)):
        raise ValueError("Approbation de la version exacte de la notice requise (SHA-256 du texte avec fins de ligne LF).")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        # Never forward a key to a redirected host.
        return None


def check_production_settings(config, opener=None):
    validate_production_config(config)
    request = Request(PROD_API + "/auth/v1/settings", method="GET", headers={
        "apikey": config["publishableKey"], "Accept": "application/json",
    })
    try:
        with (opener or build_opener(NoRedirect())).open(request, timeout=15) as response:
            if response.status != 200:
                raise ValueError()
            payload = response.read(65537)
            if len(payload) > 65536:
                raise ValueError()
            settings = json.loads(payload)
        external = settings.get("external")
        if (settings.get("disable_signup") is not True or settings.get("mailer_autoconfirm") is not False
                or not isinstance(external, dict) or external.get("email") is not True
                or external.get("anonymous_users") is not False
                or any(value is not False for name, value in external.items() if name != "email")
                or settings.get("anonymous_users_enabled", False) is not False):
            raise ValueError()
    except Exception:
        # No provider response, URL parameter, key or exception details in Actions logs.
        raise ValueError("Préflight PROD refusé : clé non reconnue par la cible, réglages Auth incompatibles ou service indisponible.") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--approved-notice-sha256", required=True)
    args = parser.parse_args()
    try:
        validate_notice_approval(args.approved_notice_sha256)
        config = validate_production_config({
            "enabled": True, "environment": "production",
            "url": os.environ.get("PAGES_SUPABASE_PROD_URL", ""),
            "publishableKey": os.environ.get("PAGES_SUPABASE_PROD_PUBLISHABLE_KEY", ""),
            "siteUrl": PROD_SITE,
        })
        check_production_settings(config)
        with args.output.open("x", encoding="utf-8", newline="\n") as destination:
            destination.write(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
        print("Configuration publique PROD validée ; inscriptions et anonymat fermés. Aucun compte ni jeton créé.")
    except ValueError as error:
        print(f"Release refusée : {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Release refusée : fichier de configuration neuf requis hors des sources.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
