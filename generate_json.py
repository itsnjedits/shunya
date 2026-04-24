"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ShunyaSpace — generate_json.py  (v4)

  Usage:
    python generate_json.py

  What changed in v4:
    ✓ Generates global.json → fixes "data/global.json 404"
    ✓ Generates home.json  → fixes "data/home.json 404"
    ✓ Ambient now scans .mp4 and .webm files (AMBIENT_EXTS)
    ✓ Thumbnails matched case-insensitively
    ✓ URL encoding note added (spaces handled in script.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import json
import re

# ══════════════════════════════════════════════════════
#  CONFIGURATION  — edit paths to match your machine
# ══════════════════════════════════════════════════════

SHUNYA_ROOT     = r"Y:\WEB DEVELOPMENT\shunya"
DATA_OUTPUT_DIR = os.path.join(SHUNYA_ROOT, "data")

PATHS = {
    "audios":  r"Y:\WEB DEVELOPMENT\shunya_data\audios",
    "ambient": r"Y:\WEB DEVELOPMENT\shunya_data\ambient",   # contains .mp4 files
    "videos":  r"Y:\WEB DEVELOPMENT\shunya_data\videos",
    "books":   os.path.join(SHUNYA_ROOT, "books", "pdfs"),
    "echo":    os.path.join(SHUNYA_ROOT, "echo"),
    "images":  os.path.join(SHUNYA_ROOT, "images"),
}

GITHUB_BASE_URLS = {
    "audios":  "https://raw.githubusercontent.com/itsnjedits/audios/main/",
    "ambient": "https://raw.githubusercontent.com/itsnjedits/ambient/main/",
    "videos":  "https://raw.githubusercontent.com/itsnjedits/videos/main/",
    # Local assets — relative to shunya/ web root
    "books":   "books/pdfs/",
    "echo":    "echo/",
    "images":  "images/",
}

# ── Supported extensions ──
AUDIO_EXTS   = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}
AMBIENT_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".mp4", ".webm"}  # FIX: .mp4 added
VIDEO_EXTS   = {".mp4", ".webm", ".mkv", ".mov", ".avi"}
IMAGE_EXTS   = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
PDF_EXTS     = {".pdf"}
TXT_EXTS     = {".txt", ".md"}
THUMB_EXTS   = {".jpg", ".jpeg", ".png", ".webp"}


# ══════════════════════════════════════════════════════
#  UTILITY FUNCTIONS
# ══════════════════════════════════════════════════════

def clean_title(filename: str) -> str:
    """Convert raw filename → readable title."""
    name = os.path.splitext(filename)[0]
    name = re.sub(r'\s*\(\d+\)\s*$', '', name)     # strip trailing (1), (2)…
    name = re.sub(r'[._\-]+', ' ', name)            # dots/underscores/dashes → space
    return re.sub(r'\s+', ' ', name).strip().title()


def list_files(folder: str, allowed_exts: set) -> list:
    """Return sorted filenames in folder matching allowed_exts (skips subdirs)."""
    if not os.path.isdir(folder):
        print(f"    ⚠  Not found, skipping: {folder}")
        return []
    return sorted(
        f for f in os.listdir(folder)
        if os.path.isfile(os.path.join(folder, f))
        and os.path.splitext(f)[1].lower() in allowed_exts
    )


def find_thumbnail(basename: str, thumbs_dir: str) -> str | None:
    """
    Find a thumbnail for <basename> in thumbs_dir.
    Tries all THUMB_EXTS, case-insensitively.
    Returns "thumbnails/<basename>.<ext>" or None.

    NOTE: filenames with spaces are stored as-is; script.js encodes them
          when building the final URL via encodeURIComponent.
    """
    if not os.path.isdir(thumbs_dir):
        return None

    # Build a case-insensitive lookup of files in thumbnails/
    try:
        existing = {f.lower(): f for f in os.listdir(thumbs_dir)
                    if os.path.isfile(os.path.join(thumbs_dir, f))}
    except OSError:
        return None

    for ext in THUMB_EXTS:
        candidate_lower = (basename + ext).lower()
        if candidate_lower in existing:
            return f"thumbnails/{existing[candidate_lower]}"

    return None


def write_json(data: dict, output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size = os.path.getsize(output_path)
    print(f"    ✓  {size:,} bytes → {output_path}")


# ══════════════════════════════════════════════════════
#  SECTION GENERATORS
# ══════════════════════════════════════════════════════

def gen_global() -> dict:
    """
    global.json — site metadata + nav config.
    FIX: This file was never generated → caused 'data/global.json 404' error.
    """
    return {
        "site": {
            "name":     "ShunyaSpace",
            "tagline":  "A silence you can enter",
            "subtitle": "शून्य — the void that holds everything",
        },
        "nav": [
            {"id": "home",    "label": "Pravaah", "icon": "◌",  "hint": "The flow"},
            {"id": "audios",  "label": "Shravan",  "icon": "◑",  "hint": "What is heard"},
            {"id": "ambient", "label": "Ambient",  "icon": "〰", "hint": "Surrounding sound"},
            {"id": "videos",  "label": "Videos",   "icon": "▷",  "hint": "Moving light"},
            {"id": "echo",    "label": "Echo",     "icon": "∿",  "hint": "Words that remain"},
            {"id": "images",  "label": "Drishya",  "icon": "◎",  "hint": "What is seen"},
            {"id": "books",   "label": "Books",    "icon": "⊟",  "hint": "Deeper waters"},
        ],
    }


def gen_home() -> dict:
    """
    home.json — welcome text + rotating quotes.
    FIX: This file was never generated → caused 'data/home.json 404' error.
    Edit the quotes list freely — the site picks one at random on each load.
    """
    return {
        "welcome": "You have arrived. There is nowhere else to be.",
        "quotes": [
            {"text": "The quieter you become, the more you can hear.",
             "author": "Ram Dass"},
            {"text": "Emptiness is not a void. It is the ground of being.",
             "author": "Krishnamurti"},
            {"text": "You are not a drop in the ocean. You are the entire ocean in a drop.",
             "author": "Rumi"},
            {"text": "The present moment is the only moment available to us.",
             "author": "Thich Nhat Hanh"},
            {"text": "What you are looking for is what is looking.",
             "author": "Francis of Assisi"},
            {"text": "Silence is not the absence of sound but the presence of everything.",
             "author": "Unknown"},
            {"text": "In the beginner's mind there are many possibilities.",
             "author": "Shunryu Suzuki"},
            {"text": "The only way to make sense out of change is to plunge into it.",
             "author": "Alan Watts"},
        ],
    }


def gen_audios() -> dict:
    """audios.json — discourse audio files (.mp3 etc.)"""
    folder   = PATHS["audios"]
    thumbs   = os.path.join(folder, "thumbnails")
    base_url = GITHUB_BASE_URLS["audios"]
    files    = list_files(folder, AUDIO_EXTS)
    items    = []
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
    ambient.json — background sounds.
    FIX: Now uses AMBIENT_EXTS which includes .mp4 and .webm.
    Previously used AUDIO_EXTS which excluded .mp4 → ambient section was always empty.
    """
    folder   = PATHS["ambient"]
    thumbs   = os.path.join(folder, "thumbnails")
    base_url = GITHUB_BASE_URLS["ambient"]
    files    = list_files(folder, AMBIENT_EXTS)   # ← uses AMBIENT_EXTS, not AUDIO_EXTS
    items    = []
    for i, fname in enumerate(files, 1):
        base = os.path.splitext(fname)[0]
        items.append({
            "id":        f"amb_{i}",
            "title":     clean_title(fname),
            "file":      fname,
            "thumbnail": find_thumbnail(base, thumbs) or "",
        })
    print(f"    → {len(items)} ambient file(s) (.mp3/.mp4/.webm all supported)")
    return {"type": "ambient", "base_url": base_url, "items": items}


def gen_videos() -> dict:
    """videos.json — video files."""
    folder   = PATHS["videos"]
    thumbs   = os.path.join(folder, "thumbnails")
    base_url = GITHUB_BASE_URLS["videos"]
    files    = list_files(folder, VIDEO_EXTS)
    items    = []
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
    """books.json — PDF books."""
    folder   = PATHS["books"]
    thumbs   = os.path.join(folder, "thumbnails")
    base_url = GITHUB_BASE_URLS["books"]
    files    = list_files(folder, PDF_EXTS)
    items    = []
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
    """echo.json — writings: PDFs + TXT files."""
    echo_root = PATHS["echo"]
    base_url  = GITHUB_BASE_URLS["echo"]

    # PDFs
    pdf_dir    = os.path.join(echo_root, "pdfs")
    pdf_thumbs = os.path.join(pdf_dir, "thumbnails")
    pdfs = []
    for i, fname in enumerate(list_files(pdf_dir, PDF_EXTS), 1):
        base  = os.path.splitext(fname)[0]
        thumb = find_thumbnail(base, pdf_thumbs)
        pdfs.append({
            "id":        f"echo_pdf_{i}",
            "title":     clean_title(fname),
            "file":      f"pdfs/{fname}",
            "thumbnail": f"pdfs/{thumb}" if thumb else "",
        })

    # TXTs
    txt_dir    = os.path.join(echo_root, "txt")
    txt_thumbs = os.path.join(txt_dir, "thumbnails")
    txts = []
    for i, fname in enumerate(list_files(txt_dir, TXT_EXTS), 1):
        base  = os.path.splitext(fname)[0]
        thumb = find_thumbnail(base, txt_thumbs)
        txts.append({
            "id":        f"echo_txt_{i}",
            "title":     clean_title(fname),
            "file":      f"txt/{fname}",
            "thumbnail": f"txt/{thumb}" if thumb else "",
        })

    print(f"    → {len(pdfs)} PDF(s), {len(txts)} TXT(s)")
    return {"type": "echo", "base_url": base_url, "pdfs": pdfs, "txts": txts}


def gen_images() -> dict:
    """images.json — image gallery (no thumbnails; the image IS the thumbnail)."""
    folder   = PATHS["images"]
    base_url = GITHUB_BASE_URLS["images"]
    files    = list_files(folder, IMAGE_EXTS)
    items    = [{"id": f"img_{i}", "file": fname} for i, fname in enumerate(files, 1)]
    print(f"    → {len(items)} image(s)")
    return {"type": "images", "base_url": base_url, "items": items}


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════

# Order matters — global/home first so site works even if media is missing
SECTIONS = [
    ("global.json",  gen_global),    # NEW — was causing 404 errors
    ("home.json",    gen_home),      # NEW — was causing 404 errors
    ("audios.json",  gen_audios),
    ("ambient.json", gen_ambient),   # FIXED — now detects .mp4 files
    ("videos.json",  gen_videos),
    ("books.json",   gen_books),
    ("echo.json",    gen_echo),
    ("images.json",  gen_images),
]


def main() -> None:
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  ShunyaSpace — JSON Generator  (v4)")
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
    print(f"  Done: {ok}/{len(SECTIONS)} JSON files generated.")
    print()
    print("  ⚠  Serve from a web server, not file://")
    print("     cd shunya && python -m http.server 8080")
    print("     Open: http://localhost:8080")
    print()
    print("  ⚠  Filenames with spaces are fine — script.js")
    print("     encodes them automatically via encodeURIComponent")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()


if __name__ == "__main__":
    main()
