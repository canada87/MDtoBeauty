import io
import os
import posixpath
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import markdown
from weasyprint import HTML

PDF_CSS = """
@page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 2cm;
    @bottom-right {
        content: counter(page) " / " counter(pages);
        font-size: 9pt;
        color: #aaa;
        font-family: 'Liberation Sans', Arial, sans-serif;
    }
}

* { box-sizing: border-box; }

body {
    font-family: 'Liberation Serif', Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.75;
    color: #1a1a2e;
    margin: 0;
    padding: 0;
}

h1, h2, h3, h4, h5, h6 {
    font-family: 'Liberation Sans', Arial, Helvetica, sans-serif;
    color: #16213e;
    margin-top: 1.6em;
    margin-bottom: 0.4em;
    line-height: 1.3;
    page-break-after: avoid;
}

h1 {
    font-size: 22pt;
    padding-bottom: 0.25em;
    border-bottom: 2.5px solid #4f46e5;
    margin-top: 0;
}

h2 {
    font-size: 16pt;
    padding-bottom: 0.15em;
    border-bottom: 1px solid #c7d2fe;
}

h3 { font-size: 13pt; }
h4 { font-size: 11.5pt; font-style: italic; }

p {
    margin: 0.5em 0 0.8em 0;
    orphans: 3;
    widows: 3;
}

a { color: #4f46e5; text-decoration: none; }
strong { color: #0f0a30; }
em { font-style: italic; }

code {
    font-family: 'Liberation Mono', 'Courier New', monospace;
    font-size: 9.5pt;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 0.1em 0.35em;
}

pre {
    background: #1e1e3f;
    color: #e2e8f0;
    border-left: 4px solid #4f46e5;
    border-radius: 5px;
    padding: 1em 1.2em;
    font-size: 9pt;
    line-height: 1.5;
    overflow: auto;
    page-break-inside: avoid;
    margin: 1em 0;
}

pre code {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
}

blockquote {
    border-left: 4px solid #4f46e5;
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #475569;
    background: #f0f4ff;
    border-radius: 0 4px 4px 0;
    font-style: italic;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.2em 0;
    font-size: 10pt;
    page-break-inside: avoid;
}

th {
    background: #4f46e5;
    color: white;
    padding: 0.6em 0.8em;
    text-align: left;
    font-weight: 600;
    font-family: 'Liberation Sans', Arial, sans-serif;
}

td {
    border: 1px solid #e2e8f0;
    padding: 0.5em 0.8em;
}

tr:nth-child(even) td { background: #f8fafc; }

ul, ol { margin: 0.5em 0; padding-left: 1.8em; }
li { margin: 0.25em 0; }

hr {
    border: none;
    border-top: 1px solid #cbd5e1;
    margin: 2em 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1em auto;
    page-break-inside: avoid;
}

.page-break {
    page-break-after: always;
    height: 0;
    display: block;
}

.codehilite .c  { color: #75715e; }
.codehilite .k  { color: #66d9ef; }
.codehilite .n  { color: #f8f8f2; }
.codehilite .s  { color: #e6db74; }
.codehilite .nb { color: #66d9ef; }
"""


def _rewrite_image_paths(content: str, md_rel_path: str) -> str:
    """
    Rewrite relative image paths in a markdown file so they resolve from
    the project root instead of the file's own directory.

    E.g. in chapter1/subchat1.md:
        ![](../image/chapter1/subchat1/img.jpeg)
    becomes:
        ![](image/chapter1/subchat1/img.jpeg)
    """
    md_dir = posixpath.dirname(md_rel_path.replace("\\", "/"))
    if not md_dir:
        return content  # root-level file — paths are already relative to root

    def _resolve(path: str) -> str:
        if path.startswith(("http://", "https://", "data:", "/", "#")):
            return path
        # Join md_dir + relative path, then normalise away .. components
        parts = posixpath.join(md_dir, path).split("/")
        result: list[str] = []
        for part in parts:
            if part == "..":
                if result:
                    result.pop()
            elif part and part != ".":
                result.append(part)
        return "/".join(result)

    # Match ![alt](path) and ![alt](path "title")
    return re.sub(
        r"(!\[[^\]]*\])\(([^)\s\"]+)((?:\s[^)]*)?\))",
        lambda m: f"{m.group(1)}({_resolve(m.group(2))}{m.group(3)}",
        content,
    )


def convert_markdown(
    md_files: list[tuple[str, str]],
    fmt: str,
    assets: list[tuple[str, bytes]] | None = None,
    separator: str = "pagebreak",
) -> tuple[bytes, str, str]:
    """
    Convert a list of (relative_path, markdown_content) pairs to the
    requested format.

    - relative_path is the file's path inside the project folder
      (e.g. "chapter1/subchat1.md").  Pass "" for inline text with no path.
    - Image paths inside each file are rewritten to be relative to the
      project root before the files are merged.
    - assets: list of (relative_path, file_bytes) for images referenced
      in the markdown, placed in the working directory so paths resolve.
    """
    if separator == "pagebreak":
        sep = "\n\n\\newpage\n\n"
    elif separator == "hr":
        sep = "\n\n---\n\n"
    else:
        sep = "\n\n"

    parts = [_rewrite_image_paths(content, rel_path) for rel_path, content in md_files]
    md_content = sep.join(parts)

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write asset files preserving their relative paths
        if assets:
            for rel_path, data in assets:
                target = Path(tmpdir) / rel_path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)

        # Write the merged markdown
        input_path = Path(tmpdir) / "input.md"
        input_path.write_text(md_content, encoding="utf-8")

        if fmt == "docx":
            output_path = Path(tmpdir) / "output.docx"
            _to_docx(str(input_path), str(output_path))
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = "document.docx"
        elif fmt == "pdf":
            output_path = Path(tmpdir) / "output.pdf"
            _to_pdf(md_content, str(output_path), tmpdir)
            mime = "application/pdf"
            filename = "document.pdf"
        else:
            raise ValueError(f"Formato non supportato: {fmt}")

        result_bytes = output_path.read_bytes()

    return result_bytes, mime, filename


def docx_to_markdown(docx_bytes: bytes) -> tuple[bytes, str, str]:
    """
    Convert a DOCX to Markdown via Pandoc.

    If the document contains embedded media, bundles `document.md` + `media/`
    into a ZIP. Otherwise returns the markdown file directly.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        input_path = tmp / "input.docx"
        input_path.write_bytes(docx_bytes)

        output_path = tmp / "document.md"
        media_dir = tmp / "media"

        result = subprocess.run(
            [
                "pandoc",
                str(input_path),
                "-o", str(output_path),
                "--extract-media=media",
                "--wrap=none",
                "--markdown-headings=atx",
            ],
            capture_output=True,
            text=True,
            cwd=str(tmp),
        )
        if result.returncode != 0:
            raise RuntimeError(f"Errore Pandoc: {result.stderr}")

        md_bytes = output_path.read_bytes()

        media_files = [p for p in media_dir.rglob("*") if p.is_file()] if media_dir.exists() else []
        if not media_files:
            return md_bytes, "text/markdown; charset=utf-8", "document.md"

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("document.md", md_bytes)
            for f in media_files:
                arcname = str(f.relative_to(tmp)).replace("\\", "/")
                zf.write(f, arcname=arcname)
        return buf.getvalue(), "application/zip", "document.zip"


def pdf_to_markdown(pdf_bytes: bytes) -> tuple[bytes, str, str]:
    """Convert a PDF to Markdown using markitdown (pdfminer-based, no OCR)."""
    from markitdown import MarkItDown

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.pdf"
        input_path.write_bytes(pdf_bytes)

        result = MarkItDown().convert(str(input_path))
        md_bytes = result.text_content.encode("utf-8")

        return md_bytes, "text/markdown; charset=utf-8", "document.md"


def _to_docx(input_md: str, output_docx: str) -> None:
    """Pandoc runs with input.md in the temp dir, so relative image paths work."""
    result = subprocess.run(
        ["pandoc", input_md, "-o", output_docx, "--standalone"],
        capture_output=True,
        text=True,
        cwd=str(Path(input_md).parent),  # run from the temp dir
    )
    if result.returncode != 0:
        raise RuntimeError(f"Errore Pandoc: {result.stderr}")


def _to_pdf(md_content: str, output_pdf: str, base_dir: str) -> None:
    """WeasyPrint resolves relative URLs against base_dir."""
    # Replace \newpage markers with HTML page-break divs
    md_content = md_content.replace("\\newpage", '<div class="page-break"></div>')

    html_body = markdown.markdown(
        md_content,
        extensions=["tables", "fenced_code", "codehilite", "toc", "attr_list", "def_list"],
    )

    full_html = f"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <style>{PDF_CSS}</style>
</head>
<body>{html_body}</body>
</html>"""

    # base_url lets WeasyPrint resolve relative image paths like ./images/photo.png
    base_url = Path(base_dir).as_uri() + "/"
    HTML(string=full_html, base_url=base_url).write_pdf(output_pdf)
