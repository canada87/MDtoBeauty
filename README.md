# MDtoBeauty

Web application that converts Markdown documents into professional Word (.docx) or PDF files with beautiful styling.

## Features

- Upload multiple Markdown files and merge them in a custom order
- **Upload an entire project folder** — markdown files and images are detected automatically, paths are rewritten so image references keep working after merging
- Upload individual images and assets (including nested folder structures) referenced in your Markdown
- Output to **DOCX** (via Pandoc) or **PDF** (via WeasyPrint) with professional A4 styling
- Paste or type Markdown directly in the browser
- Choose how merged files are separated: page break, horizontal rule, or continuous
- Syntax highlighting for code blocks in PDF output
- Drag-and-drop file upload with reordering support

## Project folder structure

The "Carica struttura progetto" button accepts a folder with any layout. A typical structure:

```
MAIN/
├── index.md
├── chapter1/
│   ├── subchat1.md
│   └── subchat2.md
├── chapter2/
│   ├── subchat1.md
│   └── subchat2.md
└── image/
    ├── chapter1/
    │   ├── subchat1/
    │   │   └── img1.jpeg
    │   └── subchat2/
    │       └── img1.jpeg
    └── chapter2/
        ├── subchat1/
        │   └── img1.jpeg
        └── subchat2/
            └── img1.jpeg
```

Files are sorted automatically: root-level files first (`index.md`), then subdirectory files in alphabetical order. You can reorder them manually in the UI before converting.

Image paths inside each markdown file (e.g. `../image/chapter1/subchat1/img1.jpeg`) are rewritten automatically to resolve from the project root before merging, so the final document renders all images correctly.

## Requirements

### Docker (recommended)

- Docker
- Docker Compose

### Local

- Python 3.11+
- [Pandoc](https://pandoc.org/installing.html) installed and available in `PATH`
- System libraries for WeasyPrint (libpango, libcairo, libgdk-pixbuf, fonts)

## Running

### Docker Compose

```bash
docker-compose up
```

The app will be available at [http://localhost:7088](http://localhost:7088).

### Local

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The app will be available at [http://localhost:8000](http://localhost:8000).

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Web UI |
| `POST` | `/convert` | Convert Markdown to DOCX or PDF |

### `POST /convert`

Accepts `multipart/form-data` with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Direct Markdown input (optional) |
| `files` | file[] | Markdown files to merge; filename is used as the relative path for image-path rewriting |
| `assets` | file[] | Image/asset files; filename carries the relative path within the project |
| `format` | string | `docx` or `pdf` |
| `separator` | string | `pagebreak`, `hr`, or `none` |

Returns the converted file as a download (`application/octet-stream`).

## Project Structure

```
MDtoBeauty/
├── main.py           # FastAPI app and routes
├── converter.py      # Markdown → DOCX/PDF conversion logic
├── requirements.txt  # Python dependencies
├── Dockerfile
├── docker-compose.yml
├── templates/
│   └── index.html    # Jinja2 web UI template
└── static/
    ├── app.js        # Frontend logic (upload, reorder, submit)
    └── style.css     # UI styles
```

## Security

- Uploaded filenames (markdown and assets) are sanitized to prevent path traversal attacks
- Only Markdown/text files are accepted for conversion; only image files for assets
