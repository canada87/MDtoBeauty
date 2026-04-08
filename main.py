import io
from typing import Annotated, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from converter import convert_markdown

app = FastAPI(title="MDtoBeauty")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/convert")
async def convert(
    files: Annotated[Optional[List[UploadFile]], File()] = None,
    text: Annotated[Optional[str], Form()] = None,
    format: Annotated[str, Form()] = "docx",
    separator: Annotated[str, Form()] = "pagebreak",
):
    contents: list[str] = []

    if files:
        for upload in files:
            if upload.filename and upload.filename.strip():
                raw = await upload.read()
                contents.append(raw.decode("utf-8", errors="replace"))

    if text and text.strip():
        contents.append(text.strip())

    if not contents:
        raise HTTPException(status_code=400, detail="Nessun contenuto fornito.")

    if separator == "pagebreak":
        sep = "\n\n\\newpage\n\n"
    elif separator == "hr":
        sep = "\n\n---\n\n"
    else:
        sep = "\n\n"

    merged = sep.join(contents)

    try:
        data, mime, filename = convert_markdown(merged, format)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
