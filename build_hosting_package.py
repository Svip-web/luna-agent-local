from __future__ import annotations

import hashlib
import html
import os
import re
import shutil
import stat
import zipfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "public"
DIST = ROOT / "dist"
PACKAGE = DIST / "kovalenko-ai-agent-package"
SITE = PACKAGE / "agent"
ARCHIVE = DIST / "kovalenko-ai-agent.zip"
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".txt", ".xml"}
ENTRY_FILES = {"index.html", "policy-coding.html", "local.css", "local.js"}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8", newline="\n")


def prepare_site() -> None:
    if PACKAGE.exists():
        def remove_readonly(function, path, _error):
            os.chmod(path, stat.S_IWRITE)
            function(path)

        shutil.rmtree(PACKAGE, onexc=remove_readonly)
    PACKAGE.mkdir(parents=True)
    shutil.copytree(SOURCE, SITE)

    index = SITE / "index.html"
    page = read_text(index)
    seo = (
        '<base href="/agent/"/>'
        '<meta name="description" content="Бесплатный онлайн-практикум по созданию ИИ-агентов и заработку на автоматизации бизнеса."/>'
        '<link rel="canonical" href="https://www.kovalenko-ai.com/agent/"/>'
        '<meta property="og:type" content="website"/>'
        '<meta property="og:url" content="https://www.kovalenko-ai.com/agent/"/>'
        '<meta property="og:title" content="ИИ-агенты — бесплатный онлайн-практикум"/>'
        '<meta property="og:description" content="Узнайте, как создавать ИИ-агентов и зарабатывать на автоматизации бизнеса."/>'
        '<meta property="og:image" content="https://www.kovalenko-ai.com/agent/assets/7938d788b503082e4328.png"/>'
        '<meta name="twitter:card" content="summary_large_image"/>'
    )
    marker = '<meta charset="utf-8"/>'
    if marker not in page:
        raise RuntimeError("Could not find the index metadata insertion point")
    page = page.replace(marker, marker + seo, 1)
    page = page.replace(
        'class="img-hero-n vibe min" fetchpriority="high" loading="lazy"',
        'class="img-hero-n vibe min" decoding="async" fetchpriority="high" loading="eager"',
        1,
    )
    page = re.sub(r"<img(?![^>]*\bdecoding=)", '<img decoding="async"', page)
    write_text(index, page)

    htaccess = """DirectoryIndex index.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 7 days"
  ExpiresByType application/javascript "access plus 7 days"
  ExpiresByType image/avif "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType font/ttf "access plus 1 year"
</IfModule>
"""
    write_text(SITE / ".htaccess", htaccess)


def extract_local_references(path: Path) -> set[Path]:
    text = read_text(path)
    raw: set[str] = set()
    raw.update(re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']", text, re.I))
    for srcset in re.findall(r"srcset=[\"']([^\"']+)[\"']", text, re.I):
        raw.update(part.strip().split()[0] for part in srcset.split(",") if part.strip())
    raw.update(re.findall(r"url\(\s*[\"']?([^\"')]+)", text, re.I))

    resolved: set[Path] = set()
    for value in raw:
        value = html.unescape(value.strip())
        parts = urlsplit(value)
        if parts.scheme or parts.netloc or value.startswith(("#", "data:", "mailto:", "tel:")):
            continue
        clean = unquote(parts.path)
        if not clean:
            continue
        candidate = SITE / clean.lstrip("/") if clean.startswith("/agent/") else path.parent / clean
        if clean.startswith("/agent/"):
            candidate = SITE / clean.removeprefix("/agent/")
        try:
            candidate = candidate.resolve()
            candidate.relative_to(SITE.resolve())
        except ValueError:
            continue
        if candidate.is_file():
            resolved.add(candidate)
    return resolved


def reference_closure() -> set[Path]:
    pending = [SITE / item for item in ENTRY_FILES if (SITE / item).exists()]
    keep: set[Path] = set(pending)
    while pending:
        current = pending.pop()
        if current.suffix.lower() not in TEXT_SUFFIXES:
            continue
        for target in extract_local_references(current):
            if target not in keep:
                keep.add(target)
                pending.append(target)
    keep.add(SITE / ".htaccess")
    return keep


def convert_large_rasters(keep: set[Path]) -> tuple[int, int, int]:
    candidates = [
        path
        for path in keep
        if path.suffix.lower() in {".png", ".jpg", ".jpeg"} and path.stat().st_size >= 140_000
    ]
    converted = 0
    before = 0
    after = 0
    text_files = [path for path in keep if path.suffix.lower() in TEXT_SUFFIXES]

    for source in candidates:
        target = source.with_suffix(".webp")
        with Image.open(source) as image:
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            image.save(target, "WEBP", quality=84, method=6)
        if target.stat().st_size >= source.stat().st_size * 0.95:
            target.unlink()
            continue

        old_name = source.name
        new_name = target.name
        for text_file in text_files:
            value = read_text(text_file)
            if old_name in value:
                write_text(text_file, value.replace(old_name, new_name))
        before += source.stat().st_size
        after += target.stat().st_size
        keep.discard(source)
        keep.add(target)
        source.unlink()
        converted += 1
    return converted, before, after


def prune_unused(keep: set[Path]) -> int:
    removed = 0
    for path in sorted(SITE.rglob("*"), reverse=True):
        if path.is_file() and path not in keep:
            path.unlink()
            removed += 1
        elif path.is_dir() and not any(path.iterdir()):
            path.rmdir()
    return removed


def validate() -> None:
    missing: list[str] = []
    for path in SITE.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            for ref in extract_local_references(path):
                if not ref.exists():
                    missing.append(f"{path.relative_to(SITE)} -> {ref.relative_to(SITE)}")
    index = read_text(SITE / "index.html")
    required = [
        '<base href="/agent/"/>',
        'https://www.kovalenko-ai.com/agent/',
        'https://client.integraleap.com/js/sf.js',
        'https://mufiksoft.com/shopifyband/amo-panel/forms.php',
        'https://vibecode.customer.smartsender.eu',
    ]
    for item in required:
        if item not in index:
            missing.append(f"index.html is missing {item}")
    if missing:
        raise RuntimeError("Package validation failed:\n" + "\n".join(missing))


def write_instructions() -> None:
    instructions = """DEPLOYMENT TARGET
https://www.kovalenko-ai.com/agent/

UPLOAD
Copy the included `agent` directory into the document root of www.kovalenko-ai.com.
The resulting server path must be: <document-root>/agent/index.html
Do not create an extra nested agent/agent directory.

REQUIREMENTS
- Serve the site over HTTPS.
- Preserve the directory structure and the .htaccess file when the server uses Apache.
- The page needs outbound HTTPS access to client.integraleap.com, mufiksoft.com,
  vibecode.customer.smartsender.eu, and Telegram for the CRM form and redirect.

CHECK AFTER DEPLOYMENT
1. Open https://www.kovalenko-ai.com/agent/
2. Confirm that images, fonts, and the phone-country selector load.
3. Send one authorized real test lead and confirm it appears in CRM.
4. Confirm the browser redirects to Vibecoding_practicum_bot in Telegram.
"""
    write_text(PACKAGE / "DEPLOY_INSTRUCTIONS.txt", instructions)


def make_archive() -> tuple[int, int, str]:
    if ARCHIVE.exists():
        ARCHIVE.unlink()
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(PACKAGE.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(PACKAGE).as_posix())
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    files = sum(1 for path in SITE.rglob("*") if path.is_file())
    return files, ARCHIVE.stat().st_size, digest


def main() -> None:
    prepare_site()
    keep = reference_closure()
    converted, raster_before, raster_after = convert_large_rasters(keep)
    keep = reference_closure()
    removed = prune_unused(keep)
    write_instructions()
    validate()
    files, archive_size, digest = make_archive()
    source_size = sum(path.stat().st_size for path in SOURCE.rglob("*") if path.is_file())
    site_size = sum(path.stat().st_size for path in SITE.rglob("*") if path.is_file())
    print(f"converted_images={converted}")
    print(f"converted_before_bytes={raster_before}")
    print(f"converted_after_bytes={raster_after}")
    print(f"removed_files={removed}")
    print(f"source_bytes={source_size}")
    print(f"site_bytes={site_size}")
    print(f"archive_files={files}")
    print(f"archive_bytes={archive_size}")
    print(f"sha256={digest}")
    print(f"archive={ARCHIVE}")


if __name__ == "__main__":
    main()
