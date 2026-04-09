# CLAUDE.md

## Project overview

**MDtoBeauty** is a FastAPI web application that converts Markdown into DOCX or PDF. It is a personal project, simple and self-contained. The codebase is small — keep changes focused and avoid over-engineering.

## Key files

| File | Role |
|------|------|
| [main.py](main.py) | FastAPI routes: `GET /` (UI) and `POST /convert` (conversion endpoint) |
| [converter.py](converter.py) | All conversion logic: `_rewrite_image_paths()`, `convert_markdown()`, `_to_docx()`, `_to_pdf()` |
| [templates/index.html](templates/index.html) | Jinja2 HTML template served by `GET /` |
| [static/app.js](static/app.js) | Frontend: drag-and-drop upload, project folder upload, file reordering, form submission |
| [static/style.css](static/style.css) | UI styles with CSS variables; gradient header, card layout, responsive |

## Architecture

- **Stateless**: every `POST /convert` request creates a temporary directory, performs conversion, streams the result, then cleans up.
- **DOCX**: Pandoc is invoked via `subprocess` on the merged Markdown text.
- **PDF**: Markdown is converted to HTML using the `markdown` library (with tables, codehilite, toc extensions), then WeasyPrint renders it to PDF using an embedded CSS stylesheet in `converter.py`.
- **Assets**: uploaded images carry their relative path (via `webkitRelativePath`, stripped of the root folder name) and are written at that path inside the temp directory so references resolve correctly.

## Project folder upload flow

The "Carica struttura progetto" button lets the user select an entire folder at once.

**Frontend (`app.js` — `addProjectFolder`)**:
1. Reads `file.webkitRelativePath` for each file in the selection.
2. Strips the root folder name → `relPath` (e.g. `MAIN/chapter1/sub.md` → `chapter1/sub.md`).
3. Routes `.md` files to `state.files` with their `relPath`; image files go to `state.assets`.
4. Sorts markdown files: shallower paths first (root files before subdirectory files), then alphabetically.
5. When building `FormData`, sends each markdown file with its `relPath` as the filename.

**Backend (`main.py`)**:
- Receives `files` where `upload.filename` is the relative path (e.g. `chapter1/sub.md`).
- Sanitizes the path and builds a `list[tuple[str, str]]` of `(rel_path, content)`.
- Passes the list plus `separator` to `convert_markdown()`.

**Converter (`converter.py` — `_rewrite_image_paths`)**:
- For each markdown file, resolves relative image paths from the file's directory to the project root before merging.
- Example: `chapter1/sub.md` contains `![](../image/chapter1/img.jpeg)` → rewritten to `image/chapter1/img.jpeg`.
- Files at the root level (no directory component) are passed through unchanged.
- After rewriting, all files are joined with the chosen separator and written as `input.md` at the temp dir root.

## `convert_markdown` signature

```python
def convert_markdown(
    md_files: list[tuple[str, str]],   # (relative_path_or_empty, markdown_content)
    fmt: str,                           # "docx" or "pdf"
    assets: list[tuple[str, bytes]] | None = None,
    separator: str = "pagebreak",       # "pagebreak" | "hr" | "none"
) -> tuple[bytes, str, str]:            # (file_bytes, mime_type, filename)
```

## Running locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Pandoc must be installed and on `PATH`. WeasyPrint requires system libraries (see Dockerfile for the full list).

## Docker

```bash
docker-compose up   # serves on port 7088
```

## Development notes

- PDF styling lives entirely in the CSS string `PDF_CSS` inside `converter.py`. Edit it there to change PDF appearance.
- The UI language is Italian.
- Path sanitization for both markdown and asset filenames is in `main.py` (`sanitize_asset_path`) — keep it when modifying upload logic.
- The "Carica struttura progetto" input has `webkitdirectory` set statically in HTML (not via JS) — this is intentional; setting it dynamically at click time is unreliable across browsers.
- The project folder button sits **outside** the dropzone element to avoid click event conflicts with the dropzone's own click handler.
- No database, no auth, no background tasks. Keep it that way unless there is a concrete need.
- Dependencies are pinned loosely in `requirements.txt`; WeasyPrint and Pandoc versions can affect output quality — test both output formats after dependency changes.
