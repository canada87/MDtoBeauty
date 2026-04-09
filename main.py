import io
import re
from pathlib import Path
from typing import Annotated, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from converter import convert_markdown

app = FastAPI(title="MDtoBeauty")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def sanitize_asset_path(filename: str) -> str | None:
    """Prevent path traversal attacks on uploaded asset filenames."""
    # Strip leading slashes and dots
    clean = re.sub(r"^[./\\]+", "", filename.replace("\\", "/"))
    parts = Path(clean).parts
    if not parts or any(p == ".." for p in parts):
        return None
    return str(Path(*parts))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/convert")
async def convert(
    files: Annotated[Optional[List[UploadFile]], File()] = None,
    assets: Annotated[Optional[List[UploadFile]], File()] = None,
    text: Annotated[Optional[str], Form()] = None,
    format: Annotated[str, Form()] = "docx",
    separator: Annotated[str, Form()] = "pagebreak",
):
    # ── Collect markdown content ──────────────────────────────────────────
    # Each entry: (relative_path, content). Path is used to rewrite image
    # references so they resolve from the project root after merging.
    md_files: list[tuple[str, str]] = []

    if files:
        for upload in files:
            if upload.filename and upload.filename.strip():
                raw = await upload.read()
                safe_path = sanitize_asset_path(upload.filename)
                # Fall back to bare filename if the path is invalid
                rel_path = safe_path if safe_path else Path(upload.filename).name
                md_files.append((rel_path, raw.decode("utf-8", errors="replace")))

    if text and text.strip():
        md_files.append(("", text.strip()))

    if not md_files:
        raise HTTPException(status_code=400, detail="Nessun contenuto fornito.")

    # ── Collect asset files (images, etc.) ────────────────────────────────
    # Each tuple: (sanitized_relative_path, bytes)
    asset_list: list[tuple[str, bytes]] = []

    if assets:
        for asset in assets:
            if not asset.filename or not asset.filename.strip():
                continue
            safe_path = sanitize_asset_path(asset.filename)
            if safe_path is None:
                continue
            data = await asset.read()
            asset_list.append((safe_path, data))

    # ── Convert ───────────────────────────────────────────────────────────
    try:
        data, mime, filename = convert_markdown(md_files, format, asset_list, separator)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
