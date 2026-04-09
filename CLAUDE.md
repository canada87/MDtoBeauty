# CLAUDE.md

## Project overview

**MDtoBeauty** is a FastAPI web application that converts Markdown into DOCX or PDF. It is a personal project, simple and self-contained. The codebase is small — keep changes focused and avoid over-engineering.

## Key files

| File | Role |
|------|------|
| [main.py](main.py) | FastAPI routes: `GET /` (UI) and `POST /convert` (conversion endpoint) |
| [converter.py](converter.py) | All conversion logic: `convert_markdown()` orchestrates, `_to_docx()` calls Pandoc subprocess, `_to_pdf()` uses WeasyPrint |
| [templates/index.html](templates/index.html) | Jinja2 HTML template served by `GET /` |
| [static/app.js](static/app.js) | Frontend: drag-and-drop upload, file reordering, form submission, download trigger |
| [static/style.css](static/style.css) | UI styles with CSS variables; gradient header, card layout, responsive |

## Architecture

- **Stateless**: every `POST /convert` request creates a temporary directory, performs conversion, streams the result, then cleans up.
- **DOCX**: Pandoc is invoked via `subprocess` on the merged Markdown text.
- **PDF**: Markdown is converted to HTML using the `markdown` library (with tables, codehilite, toc extensions), then WeasyPrint renders it to PDF using an embedded CSS stylesheet in `converter.py`.
- **Assets**: uploaded images preserve their relative path structure (using `webkitRelativePath`) so Markdown image references resolve correctly inside the temp directory.

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

- PDF styling lives entirely in the CSS string inside `converter.py` (`_to_pdf()`). Edit it there to change PDF appearance.
- The UI language is Italian.
- Path sanitization for uploaded assets is in `main.py` — keep it when modifying the upload logic.
- No database, no auth, no background tasks. Keep it that way unless there is a concrete need.
- Dependencies are pinned loosely in `requirements.txt`; WeasyPrint and Pandoc versions can affect output quality — test both output formats after dependency changes.
