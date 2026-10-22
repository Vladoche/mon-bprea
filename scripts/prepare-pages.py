#!/usr/bin/env python3
"""Prepare the public Pages artifact; leave the static sources untouched."""

import argparse
import html
import json
import os
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import unquote, urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parent.parent
VERSIONED = {".css", ".js", ".json"}
ASSET_TYPES = VERSIONED | {
    ".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf",
}
HTML_URL = re.compile(
    r"(?P<before>\b(?:src|href)\s*=\s*)(?P<quote>['\"])(?P<url>[^'\"]+)(?P=quote)",
    re.IGNORECASE,
)
JS_FROM = re.compile(
    r"(?P<before>^[ \t]*(?:import|export)\s+[^;'\"`]*?\bfrom\s*)"
    r"(?P<quote>['\"])(?P<url>[^'\"\r\n]+)(?P=quote)",
    re.MULTILINE,
)
JS_BARE_IMPORT = re.compile(
    r"(?P<before>^[ \t]*import\s*)(?P<quote>['\"])(?P<url>[^'\"\r\n]+)(?P=quote)",
    re.MULTILINE,
)
JS_DYNAMIC_IMPORT = re.compile(
    r"(?P<before>\bimport\s*\(\s*)(?P<quote>['\"`])(?P<url>[^'\"`\r\n]+)(?P=quote)"
)
JS_MODULE_URL = re.compile(
    r"(?P<before>\bnew\s+URL\s*\(\s*)(?P<quote>['\"`])(?P<url>[^'\"`\r\n]+)(?P=quote)"
    r"(?P<after>\s*,\s*import\.meta\.url\s*\))"
)
CSS_IMPORT = re.compile(
    r"(?P<before>@import\s*)(?P<quote>['\"])(?P<url>[^'\"\r\n]+)(?P=quote)",
    re.IGNORECASE,
)
CSS_URL = re.compile(
    r"(?P<before>\burl\(\s*)(?P<quote>['\"]?)(?P<url>[^'\"\s)]+)(?P=quote)(?P<after>\s*\))",
    re.IGNORECASE,
)


def public_files():
    """Explicit public roots/types; never copy repository or private dotfiles."""
    files = [path for path in ROOT.glob("*.html") if not path.name.startswith(".")]
    for directory, extensions in (("assets", ASSET_TYPES), ("documents", {".pdf"})):
        root = ROOT / directory
        if not root.is_dir() or root.is_symlink():
            raise ValueError(f"Dossier public absent ou lien symbolique interdit : {directory}")
        for path in root.rglob("*"):
            relative = path.relative_to(ROOT)
            if any(part.startswith(".") for part in relative.parts):
                continue
            if path.is_symlink():
                raise ValueError(f"Lien symbolique interdit dans les fichiers publics : {relative}")
            if path.is_file() and path.suffix.lower() in extensions:
                files.append(path)
    for path in files:
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Fichier public invalide : {path.relative_to(ROOT)}")
    if not any(path.name == "index.html" for path in files):
        raise ValueError("La page index.html est absente.")
    return sorted(files)


def public_auth_config(path):
    """Accept only public configuration; never copy arbitrary environment files."""
    config = json.loads(path.read_text(encoding="utf-8-sig"))
    allowed = {"enabled", "environment", "url", "publishableKey", "siteUrl"}
    if not isinstance(config, dict) or set(config) != allowed or type(config.get("enabled")) is not bool:
        raise ValueError("Configuration Auth invalide : seuls les cinq champs publics du modèle sont autorisés.")
    if config["environment"] not in {"development", "production"}:
        raise ValueError("Environnement Auth invalide.")
    if any(not isinstance(config[key], str) for key in ("url", "publishableKey", "siteUrl")):
        raise ValueError("Les paramètres publics Auth doivent être des chaînes.")
    key = config["publishableKey"]
    if key and not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", key):
        raise ValueError("Seule une clé publishable est autorisée dans l’artefact public.")
    if config["enabled"]:
        local_hosts = {"127.0.0.1", "localhost", "::1"}
        endpoint, site = urlsplit(config["url"]), urlsplit(config["siteUrl"])
        if (not key or not endpoint.hostname or endpoint.path not in {"", "/"}
                or endpoint.query or endpoint.fragment or endpoint.username or endpoint.password
                or (endpoint.scheme != "https" and not (config["environment"] == "development"
                    and endpoint.scheme == "http" and endpoint.hostname in local_hosts))):
            raise ValueError("URL Supabase publique invalide.")
        if (not site.hostname or not site.path.endswith("/") or site.query or site.fragment
                or site.username or site.password
                or (config["environment"] == "development" and (site.hostname not in local_hosts or site.scheme not in {"http", "https"}))
                or (config["environment"] == "production" and (site.scheme != "https" or site.hostname in local_hosts or endpoint.hostname in local_hosts))):
            raise ValueError("URL du site incompatible avec l’environnement Auth.")
    return json.dumps(config, ensure_ascii=False, indent=2) + "\n"


def prepare(output, version, auth_config=None):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", version):
        raise ValueError("Version invalide : utiliser le SHA Git ou un identifiant simple (80 caractères maximum).")
    output = output.resolve()
    # Never overwrite a source directory, including by way of a symlink.
    if output == ROOT or output in ROOT.parents:
        raise ValueError("Le dossier de sortie doit être distinct des sources et des dossiers privés.")
    if output.is_relative_to(ROOT):
        relative = output.relative_to(ROOT)
        if relative.parts[0] in {"assets", "documents", "scripts"} or any(
            part.startswith(".") and part not in {".tmp", ".cache"} for part in relative.parts
        ):
            raise ValueError("Le dossier de sortie doit être distinct des sources et des dossiers privés.")
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError(f"La sortie existe déjà et n'est pas un dossier vide : {output}")

    files = public_files()
    # Always validate even the disabled tracked default before publication.
    auth_content = public_auth_config(auth_config or ROOT / "assets" / "auth-config.json")
    published = {path.resolve() for path in files}
    updated = 0

    def version_url(address, source):
        nonlocal updated
        parts = urlsplit(address)
        if parts.scheme or parts.netloc or not parts.path or "${" in address:
            return address
        decoded = unquote(parts.path)
        if Path(decoded).suffix.lower() not in VERSIONED:
            return address
        if decoded.startswith("/") or "\\" in decoded or any(ord(char) < 32 for char in decoded):
            raise ValueError(f"Chemin non relatif ou invalide dans {source.relative_to(ROOT)} : {address}")
        target = (source.parent / decoded).resolve()
        if target not in published:
            raise ValueError(f"Ressource absente ou non publique dans {source.relative_to(ROOT)} : {address}")
        # Preserve existing query parameters/fragments, replace only our v key.
        query = [item for item in parts.query.split("&") if item and unquote(item.split("=", 1)[0]) != "v"]
        query.append(f"v={version}")
        result = urlunsplit(("", "", parts.path, "&".join(query), parts.fragment))
        updated += 1
        return result

    def rewrite(pattern, content, source, html_attribute=False):
        def replace(match):
            original = match.group("url")
            address = html.unescape(original) if html_attribute else original
            address = version_url(address, source)
            if html_attribute:
                address = html.escape(address, quote=False)
            quote = match.group("quote")
            return match.group("before") + quote + address + quote + (match.groupdict().get("after") or "")
        return pattern.sub(replace, content)

    # Validate and rewrite in memory before creating an artifact, avoiding partial output on bad references.
    contents = {}
    for source in files:
        if source.suffix.lower() not in {".html", ".js", ".css"}:
            continue
        content = source.read_text(encoding="utf-8")
        if source.suffix.lower() == ".html":
            content = rewrite(HTML_URL, content, source, html_attribute=True)
        elif source.suffix.lower() == ".js":
            for pattern in (JS_FROM, JS_BARE_IMPORT, JS_DYNAMIC_IMPORT, JS_MODULE_URL):
                content = rewrite(pattern, content, source)
        else:
            for pattern in (CSS_IMPORT, CSS_URL):
                content = rewrite(pattern, content, source)
        contents[source] = content

    output.mkdir(parents=True, exist_ok=True)
    for source in files:
        destination = output / source.relative_to(ROOT)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source == ROOT / "assets" / "auth-config.json":
            destination.write_text(auth_content, encoding="utf-8", newline="\n")
        elif source in contents:
            destination.write_text(contents[source], encoding="utf-8", newline="\n")
        else:
            shutil.copyfile(source, destination)
    (output / ".nojekyll").touch()
    print(f"Pages : {len(files)} fichiers publics, {updated} références versionnées (v={version}).")
    print(f"Artefact : {output}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "site-public", help="Dossier neuf ou vide de l'artefact")
    parser.add_argument("--version", default=os.environ.get("GITHUB_SHA"), help="SHA Git du déploiement (ou identifiant local)")
    parser.add_argument("--auth-config", type=Path, help="Configuration publique locale à copier uniquement dans l’artefact")
    args = parser.parse_args()
    if not args.version:
        parser.error("--version est obligatoire hors GitHub Actions (exemple : --version verification-locale).")
    try:
        prepare(args.output, args.version, args.auth_config)
    except (OSError, ValueError) as error:
        print(f"Préparation interrompue : {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
