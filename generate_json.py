"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ShunyaSpace — generate_json.py
  JSON Content Pipeline Automation Script

  Usage:
    python generate_json.py

  What it does:
    Scans all 6 content source folders,
    detects files + thumbnails,
    and regenerates all JSON files in shunya/data/

  Workflow:
    Add files → Run script → JSON updates → Push → Site updates ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import json
import re

# ─────────────────────────────────────────────────────
#  CONFIGURATION — Edit these paths to match your setup
# ─────────────────────────────────────────────────────

# Root of the shunya website folder
SHUNYA_ROOT = r"Y:\WEB DEVELOPMENT\shunya"

# Output folder for JSON files (inside shunya/)
DATA_OUTPUT_DIR = os.path.join(SHUNYA_ROOT, "data")

# ── Content Source Paths ──
PATHS = {
    "audios":  r"Y:\WEB DEVELOPMENT\shunya_data\audios",
    "ambient": r"Y:\WEB DEVELOPMENT\shunya_data\ambient",
    "videos":  r"Y:\WEB DEVELOPMENT\shunya_data\videos",
    "books":   os.path.join(SHUNYA_ROOT, "books", "pdfs"),
    "echo":    os.path.join(SHUNYA_ROOT, "echo"),       # contains /pdfs/ and /txt/
    "images":  os.path.join(SHUNYA_ROOT, "images"),
}

# ── GitHub Raw Base URLs ──
GITHUB_BASE_URLS = {
    "audios":  "https://raw.githubusercontent.com/itsnjedits/audios/main/",
    "ambient": "https://raw.githubusercontent.com/itsnjedits/ambient/main/",
    "videos":  "https://raw.githubusercontent.com/itsnjedits/videos/main/",
    "books":   "",   # Local — fill in your GitHub URL when ready
    "echo":    "",   # Local — fill in your GitHub URL when ready
    "images":  "",   # Local — fill in your GitHub URL when ready
}

# ── Supported File Extensions by Type ──
EXTENSIONS = {
    "audio":  {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"},
    "video":  {".mp4", ".webm", ".mkv", ".mov", ".avi"},
    "image":  {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"},
    "pdf":    {".pdf"},
    "txt":    {".txt", ".md"},
    "thumb":  {".jpg", ".jpeg", ".png", ".webp"},
}


# ─────────────────────────────────────────────────────
#  UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────

def clean_title(filename: str) -> str:
    """Convert a filename into a readable title.
    
    'the_nature_of_consciousness.mp3'  →  'The Nature Of Consciousness'
    'forest-rain (2).mp3'              →  'Forest Rain'
    """
    name = os.path.splitext(filename)[0]          # remove extension
    name = re.sub(r'\s*\(\d+\)\s*$', '', name)    # remove trailing (1), (2) etc.
    name = re.sub(r'[_\-]+', ' ', name)            # underscores/dashes → spaces
    name = re.sub(r'\s+', ' ', name).strip()       # collapse whitespace
    return name.title()


def find_files(folder: str, allowed_exts: set) -> list:
    """Return a sorted list of filenames in folder with allowed extensions."""
    if not os.path.isdir(folder):
        print(f"  ⚠  Folder not found: {folder}")
        return []

    files = [
        f for f in os.listdir(folder)
        if os.path.isfile(os.path.join(folder, f))
        and os.path.splitext(f)[1].lower() in allowed_exts
    ]
    return sorted(files)


def find_thumbnail(basename: str, thumbs_folder: str) -> str | None:
    """Look for a thumbnail matching basename (without extension) in thumbs_folder."""
    if not os.path.isdir(thumbs_folder):
        return None

    for ext in EXTENSIONS["thumb"]:
        candidate = basename + ext
        if os.path.isfile(os.path.join(thumbs_folder, candidate)):
            return f"thumbnails/{candidate}"

    return None   # No matching thumbnail found — handled gracefully


def save_json(data: dict, output_path: str) -> None:
    """Write data as formatted JSON to output_path."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  ✓  Written → {output_path}")


# ─────────────────────────────────────────────────────
#  SECTION GENERATORS
# ─────────────────────────────────────────────────────

def generate_audio_json() -> dict:
    """Scan audios folder → generate audios.json"""
    folder      = PATHS["audios"]
    thumbs_dir  = os.path.join(folder, "thumbnails")
    base_url    = GITHUB_BASE_URLS["audios"]
    files       = find_files(folder, EXTENSIONS["audio"])

    items = []
    for idx, filename in enumerate(files, start=1):
        basename = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, thumbs_dir)

        items.append({
            "id":        f"audio_{idx}",
            "title":     clean_title(filename),
            "file":      filename,
            "thumbnail": thumbnail or "",
        })

    print(f"  → audios: {len(items)} file(s) found")
    return {
        "type":     "audio",
        "base_url": base_url,
        "items":    items,
    }


def generate_ambient_json() -> dict:
    """Scan ambient folder → generate ambient.json"""
    folder      = PATHS["ambient"]
    thumbs_dir  = os.path.join(folder, "thumbnails")
    base_url    = GITHUB_BASE_URLS["ambient"]
    files       = find_files(folder, EXTENSIONS["audio"])

    items = []
    for idx, filename in enumerate(files, start=1):
        basename = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, thumbs_dir)

        items.append({
            "id":        f"amb_{idx}",
            "title":     clean_title(filename),
            "file":      filename,
            "thumbnail": thumbnail or "",
        })

    print(f"  → ambient: {len(items)} file(s) found")
    return {
        "type":     "ambient",
        "base_url": base_url,
        "items":    items,
    }


def generate_videos_json() -> dict:
    """Scan videos folder → generate videos.json"""
    folder      = PATHS["videos"]
    thumbs_dir  = os.path.join(folder, "thumbnails")
    base_url    = GITHUB_BASE_URLS["videos"]
    files       = find_files(folder, EXTENSIONS["video"])

    items = []
    for idx, filename in enumerate(files, start=1):
        basename = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, thumbs_dir)

        items.append({
            "id":        f"vid_{idx}",
            "title":     clean_title(filename),
            "file":      filename,
            "thumbnail": thumbnail or "",
        })

    print(f"  → videos: {len(items)} file(s) found")
    return {
        "type":     "video",
        "base_url": base_url,
        "items":    items,
    }


def generate_books_json() -> dict:
    """Scan books/pdfs folder → generate books.json"""
    folder      = PATHS["books"]
    thumbs_dir  = os.path.join(folder, "thumbnails")
    base_url    = GITHUB_BASE_URLS["books"]
    files       = find_files(folder, EXTENSIONS["pdf"])

    items = []
    for idx, filename in enumerate(files, start=1):
        basename = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, thumbs_dir)

        items.append({
            "id":        f"book_{idx}",
            "title":     clean_title(filename),
            "file":      filename,
            "thumbnail": thumbnail or "",
        })

    print(f"  → books: {len(items)} file(s) found")
    return {
        "type":     "book",
        "base_url": base_url,
        "items":    items,
    }


def generate_echo_json() -> dict:
    """Scan echo/pdfs and echo/txt folders → generate echo.json
    
    echo.json structure:
    {
      "type": "echo",
      "base_url": "...",
      "pdfs": [ { "id", "title", "file", "thumbnail" }, ... ],
      "txts": [ { "id", "title", "file", "thumbnail" }, ... ]
    }
    """
    echo_root   = PATHS["echo"]
    base_url    = GITHUB_BASE_URLS["echo"]

    # ── PDFs ──
    pdf_folder  = os.path.join(echo_root, "pdfs")
    pdf_thumbs  = os.path.join(pdf_folder, "thumbnails")
    pdf_files   = find_files(pdf_folder, EXTENSIONS["pdf"])

    pdfs = []
    for idx, filename in enumerate(pdf_files, start=1):
        basename  = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, pdf_thumbs)
        pdfs.append({
            "id":        f"echo_pdf_{idx}",
            "title":     clean_title(filename),
            "file":      f"pdfs/{filename}",
            "thumbnail": f"pdfs/{thumbnail}" if thumbnail else "",
        })

    # ── TXTs ──
    txt_folder  = os.path.join(echo_root, "txt")
    txt_thumbs  = os.path.join(txt_folder, "thumbnails")
    txt_files   = find_files(txt_folder, EXTENSIONS["txt"])

    txts = []
    for idx, filename in enumerate(txt_files, start=1):
        basename  = os.path.splitext(filename)[0]
        thumbnail = find_thumbnail(basename, txt_thumbs)
        txts.append({
            "id":        f"echo_txt_{idx}",
            "title":     clean_title(filename),
            "file":      f"txt/{filename}",
            "thumbnail": f"txt/{thumbnail}" if thumbnail else "",
        })

    print(f"  → echo: {len(pdfs)} PDF(s), {len(txts)} TXT(s) found")
    return {
        "type":     "echo",
        "base_url": base_url,
        "pdfs":     pdfs,
        "txts":     txts,
    }


def generate_images_json() -> dict:
    """Scan images folder → generate images.json (no thumbnails required)"""
    folder    = PATHS["images"]
    base_url  = GITHUB_BASE_URLS["images"]
    files     = find_files(folder, EXTENSIONS["image"])

    items = []
    for idx, filename in enumerate(files, start=1):
        items.append({
            "id":   f"img_{idx}",
            "file": filename,
        })

    print(f"  → images: {len(items)} file(s) found")
    return {
        "type":     "images",
        "base_url": base_url,
        "items":    items,
    }


# ─────────────────────────────────────────────────────
#  MAIN RUNNER
# ─────────────────────────────────────────────────────

def main():
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  ShunyaSpace — JSON Generator")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    # Map: output filename → generator function
    sections = [
        ("audios.json",  generate_audio_json),
        ("ambient.json", generate_ambient_json),
        ("videos.json",  generate_videos_json),
        ("books.json",   generate_books_json),
        ("echo.json",    generate_echo_json),
        ("images.json",  generate_images_json),
    ]

    success = 0
    for filename, generator in sections:
        print(f"[ {filename} ]")
        try:
            data        = generator()
            output_path = os.path.join(DATA_OUTPUT_DIR, filename)
            save_json(data, output_path)
            success += 1
        except Exception as e:
            print(f"  ✗  ERROR generating {filename}: {e}")
        print()

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Done. {success}/{len(sections)} JSON files updated.")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    main()
