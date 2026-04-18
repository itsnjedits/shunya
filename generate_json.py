"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ShunyaSpace — generate_json.py  (v3 — fixed)
  JSON Content Pipeline Automation Script

  Usage (run from anywhere):
    python generate_json.py

  Workflow:
    Add files → Run script → JSON updates → Push to GitHub → Site updates ✓

  FIX LOG:
    - base_url now correctly set for local assets (books, echo, images)
    - Relative web paths are correct relative to shunya/ root
    - Thumbnail paths verified against actual folder structure
    - Echo file paths include subfolder prefix (echo/pdfs/, echo/txt/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import json
import re

# ══════════════════════════════════════════════════════
#  CONFIGURATION
#  ↳ Edit the paths below to match your local setup
# ══════════════════════════════════════════════════════

# Absolute path to the shunya website root folder
SHUNYA_ROOT = r"Y:\WEB DEVELOPMENT\shunya"

# JSON files are written to this folder (relative to SHUNYA_ROOT)
DATA_OUTPUT_DIR = os.path.join(SHUNYA_ROOT, "data")

# ── Media source folders ──────────────────────────────
# Heavy media lives outside shunya/ in shunya_data/
# Light content (books, echo, images) lives inside shunya/

PATHS = {
    "audios":  r"Y:\WEB DEVELOPMENT\shunya_data\audios",
    "ambient": r"Y:\WEB DEVELOPMENT\shunya_data\ambient",
    "videos":  r"Y:\WEB DEVELOPMENT\shunya_data\videos",
    "books":   os.path.join(SHUNYA_ROOT, "books", "pdfs"),
    "echo":    os.path.join(SHUNYA_ROOT, "echo"),       # sub-dirs: /pdfs/ and /txt/
    "images":  os.path.join(SHUNYA_ROOT, "images"),
}

# ── GitHub Raw Base URLs ──────────────────────────────
# Heavy media is hosted on separate GitHub repos.
# Local assets use relative paths from shunya/ web root.
#
# CRITICAL: base_url + item.file = full URL that the browser will request.
#
# GitHub repos  → full raw URL (must end with /)
# Local assets  → relative path from site root (must end with /)

GITHUB_BASE_URLS = {
    # GitHub-hosted (external repos)
    "audios":  "https://raw.githubusercontent.com/itsnjedits/audios/main/",
    "ambient": "https://raw.githubusercontent.com/itsnjedits/ambient/main/",
    "videos":  "https://raw.githubusercontent.com/itsnjedits/videos/main/",

    # Local assets — relative to the shunya/ web root
    # e.g. base "books/pdfs/" + file "book.pdf" → browser requests "books/pdfs/book.pdf"
    "books":   "books/pdfs/",
    "echo":    "echo/",        # file field already includes "pdfs/" or "txt/" prefix
    "images":  "images/",
}

# ── Supported extensions ──────────────────────────────
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}
VIDEO_EXTS = {".mp4", ".webm", ".mkv", ".mov", ".avi"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
PDF_EXTS   = {".pdf"}
TXT_EXTS   = {".txt", ".md"}
THUMB_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


# ══════════════════════════════════════════════════════
#  UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════

def clean_title(filename: str) -> str:
    """
    Convert raw filename to readable title.
    Examples:
      'the_nature_of_consciousness.mp3' → 'The Nature Of Consciousness'
      'forest-rain (2).mp3'             → 'Forest Rain'
      'be.here.now.pdf'                 → 'Be Here Now'
    """
    name = os.path.splitext(filename)[0]          # strip extension
    name = re.sub(r'\s*\(\d+\)\s*$', '', name)    # strip trailing (1), (2)...
    name = re.sub(r'[._\-]+', ' ', name)           # dots/underscores/dashes → space
    name = re.sub(r'\s+', ' ', name).strip()       # collapse whitespace
    return name.title()


def list_files(folder: str, allowed_exts: set) -> list[str]:
    """Return sorted filenames in folder that match allowed_exts. Skips sub-folders."""
    if not os.path.isdir(folder):
        print(f"    ⚠  Folder not found, skipping: {folder}")
        return []
    result = [
        f for f in sorted(os.listdir(folder))
        if os.path.isfile(os.path.join(folder, f))
        and os.path.splitext(f)[1].lower() in allowed_exts
    ]
    return result


def find_thumbnail(basename: str, thumbs_dir: str) -> str | None:
    """
    Look for a thumbnail image named <basename>.<ext> inside thumbs_dir.
    Returns the relative path "thumbnails/<basename>.<ext>" or None.
    """
    if not os.path.isdir(thumbs_dir):
        return None
    for ext in THUMB_EXTS:
        candidate = basename + ext
        if os.path.isfile(os.path.join(thumbs_dir, candidate)):
            return f"thumbnails/{candidate}"
    return None


def write_json(data: dict, output_path: str) -> None:
    """Pretty-print data as JSON to output_path, creating directories as needed."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size = os.path.getsize(output_path)
    print(f"    ✓  Saved ({size:,} bytes) → {output_path}")


# ══════════════════════════════════════════════════════
#  SECTION GENERATORS
# ══════════════════════════════════════════════════════

def gen_audios() -> dict:
    """
    audios.json
    Source:    shunya_data/audios/*.mp3 (etc.)
    Thumbnails: shunya_data/audios/thumbnails/<name>.jpg
    base_url:  https://raw.githubusercontent.com/itsnjedits/audios/main/
    Full URL:  base_url + "filename.mp3"
    """
    folder    = PATHS["audios"]
    thumbs    = os.path.join(folder, "thumbnails")
    base_url  = GITHUB_BASE_URLS["audios"]
    files     = list_files(folder, AUDIO_EXTS)

    items = []
    for i, fname in enumerate(files, 1):
        base = os.path.splitext(fname)[0]
        items.append({
            "id":        f"audio_{i}",
            "title":     clean_title(fname),
            "file":      fname,
            "thumbnail": find_thumbnail(base, thumbs) or "",
        })

    print(f"    → {len(items)} audio file(s)")
    return {"type": "audio", "base_url": base_url, "items": items}


def gen_ambient() -> dict:
    """
    ambient.json
    Source:    shunya_data/ambient/*.mp3
    Thumbnails: shunya_data/ambient/thumbnails/
    base_url:  https://raw.githubusercontent.com/itsnjedits/ambient/main/
    """
    folder    = PATHS["ambient"]
    thumbs    = os.path.join(folder, "thumbnails")
    base_url  = GITHUB_BASE_URLS["ambient"]
    files     = list_files(folder, AUDIO_EXTS)

    items = []
    for i, fname in enumerate(files, 1):
        base = os.path.splitext(fname)[0]
        items.append({
            "id":        f"amb_{i}",
            "title":     clean_title(fname),
            "file":      fname,
            "thumbnail": find_thumbnail(base, thumbs) or "",
        })

    print(f"    → {len(items)} ambient file(s)")
    return {"type": "ambient", "base_url": base_url, "items": items}


def gen_videos() -> dict:
    """
    videos.json
    Source:    shunya_data/videos/*.mp4
    Thumbnails: shunya_data/videos/thumbnails/
    base_url:  https://raw.githubusercontent.com/itsnjedits/videos/main/
    """
    folder    = PATHS["videos"]
    thumbs    = os.path.join(folder, "thumbnails")
    base_url  = GITHUB_BASE_URLS["videos"]
    files     = list_files(folder, VIDEO_EXTS)

    items = []
    for i, fname in enumerate(files, 1):
        base = os.path.splitext(fname)[0]
        items.append({
            "id":        f"vid_{i}",
            "title":     clean_title(fname),
            "file":      fname,
            "thumbnail": find_thumbnail(base, thumbs) or "",
        })

    print(f"    → {len(items)} video file(s)")
    return {"type": "video", "base_url": base_url, "items": items}


def gen_books() -> dict:
    """
    books.json
    Source:    shunya/books/pdfs/*.pdf
    Thumbnails: shunya/books/pdfs/thumbnails/
    base_url:  "books/pdfs/"  ← relative to shunya/ web root
    Full URL:  "books/pdfs/book.pdf"

    FIX: was empty "" → browser tried to fetch "book.pdf" from root → 404
    """
    folder    = PATHS["books"]
    thumbs    = os.path.join(folder, "thumbnails")
    base_url  = GITHUB_BASE_URLS["books"]   # "books/pdfs/"
    files     = list_files(folder, PDF_EXTS)

    items = []
    for i, fname in enumerate(files, 1):
        base = os.path.splitext(fname)[0]
        items.append({
            "id":        f"book_{i}",
            "title":     clean_title(fname),
            "file":      fname,
            "thumbnail": find_thumbnail(base, thumbs) or "",
        })

    print(f"    → {len(items)} book(s)")
    return {"type": "book", "base_url": base_url, "items": items}


def gen_echo() -> dict:
    """
    echo.json  ← special structure with separate pdfs and txts arrays

    Source PDFs: shunya/echo/pdfs/*.pdf
    Source TXTs: shunya/echo/txt/*.txt
    base_url:    "echo/"  ← relative to shunya/ web root

    file field includes sub-path, so:
      PDF: file = "pdfs/book.pdf"  → URL = "echo/pdfs/book.pdf"   ✓
      TXT: file = "txt/essay.txt"  → URL = "echo/txt/essay.txt"   ✓

    Thumbnails:
      PDF thumb:  "pdfs/thumbnails/book.jpg" → URL = "echo/pdfs/thumbnails/book.jpg" ✓
      TXT thumb:  "txt/thumbnails/essay.jpg" → URL = "echo/txt/thumbnails/essay.jpg" ✓

    FIX: was base_url="" → file paths resolved to "pdfs/book.pdf" missing "echo/" prefix
    """
    echo_root = PATHS["echo"]
    base_url  = GITHUB_BASE_URLS["echo"]    # "echo/"

    # ── PDFs ──────────────────────────────────
    pdf_dir    = os.path.join(echo_root, "pdfs")
    pdf_thumbs = os.path.join(pdf_dir, "thumbnails")
    pdf_files  = list_files(pdf_dir, PDF_EXTS)

    pdfs = []
    for i, fname in enumerate(pdf_files, 1):
        base  = os.path.splitext(fname)[0]
        thumb = find_thumbnail(base, pdf_thumbs)
        pdfs.append({
            "id":        f"echo_pdf_{i}",
            "title":     clean_title(fname),
            "file":      f"pdfs/{fname}",                         # → echo/pdfs/fname
            "thumbnail": f"pdfs/{thumb}" if thumb else "",        # → echo/pdfs/thumbnails/...
        })

    # ── TXTs ──────────────────────────────────
    txt_dir    = os.path.join(echo_root, "txt")
    txt_thumbs = os.path.join(txt_dir, "thumbnails")
    txt_files  = list_files(txt_dir, TXT_EXTS)

    txts = []
    for i, fname in enumerate(txt_files, 1):
        base  = os.path.splitext(fname)[0]
        thumb = find_thumbnail(base, txt_thumbs)
        txts.append({
            "id":        f"echo_txt_{i}",
            "title":     clean_title(fname),
            "file":      f"txt/{fname}",                          # → echo/txt/fname
            "thumbnail": f"txt/{thumb}" if thumb else "",         # → echo/txt/thumbnails/...
        })

    print(f"    → {len(pdfs)} PDF(s), {len(txts)} TXT(s)")
    return {
        "type":     "echo",
        "base_url": base_url,
        "pdfs":     pdfs,
        "txts":     txts,
    }


def gen_images() -> dict:
    """
    images.json
    Source:    shunya/images/*.jpg  (etc.)
    base_url:  "images/"  ← relative to shunya/ web root
    Full URL:  "images/photo.jpg"

    No thumbnails for images (the images ARE the thumbnails).

    FIX: was base_url="" → browser tried "photo.jpg" from root → 404
    """
    folder    = PATHS["images"]
    base_url  = GITHUB_BASE_URLS["images"]  # "images/"
    files     = list_files(folder, IMAGE_EXTS)

    items = []
    for i, fname in enumerate(files, 1):
        items.append({
            "id":   f"img_{i}",
            "file": fname,
        })

    print(f"    → {len(items)} image(s)")
    return {"type": "images", "base_url": base_url, "items": items}


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════

SECTIONS = [
    ("audios.json",  gen_audios),
    ("ambient.json", gen_ambient),
    ("videos.json",  gen_videos),
    ("books.json",   gen_books),
    ("echo.json",    gen_echo),
    ("images.json",  gen_images),
]


def main() -> None:
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  ShunyaSpace — JSON Generator  (v3)")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()

    ok = 0
    for filename, generator in SECTIONS:
        print(f"  [ {filename} ]")
        try:
            data = generator()
            write_json(data, os.path.join(DATA_OUTPUT_DIR, filename))
            ok += 1
        except Exception as exc:
            print(f"    ✗  FAILED: {exc}")
        print()

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Done: {ok}/{len(SECTIONS)} JSON files updated.")
    print()
    print("  ⚠  REMINDER: You must run this from a local")
    print("     web server, not file:// — otherwise the")
    print("     browser will block fetch() calls.")
    print("     Quick server: python -m http.server 8080")
    print("     Then open:    http://localhost:8080")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()


if __name__ == "__main__":
    main()
