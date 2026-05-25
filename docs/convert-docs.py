#!/usr/bin/env python3
"""
convert-docs.py — Convert markdown documentation to static HTML pages.

Usage:
    python3 convert-docs.py              # converts all .md files in docs/
    python3 convert-docs.py --watch      # (future) watch mode

Builds a complete static doc site with:
  - Dark theme (#0d1117 bg, #e6edf3 text, Inter font)
  - Sidebar with ToC (from headings) + back-to-home link
  - Nav bar with all doc categories
  - Footer with GitHub link
  - Internal .md → .html link rewriting
"""

import markdown
import os
import re
import sys
import glob

# ─── Configuration ───────────────────────────────────────────────

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = DOCS_DIR

# Navigation items: label → filename (without .html)
# These appear in every page's sidebar nav.
DOC_NAV_ITEMS = [
    ("🏠 Home", "index"),
    ("📖 Overview", "overview"),
    ("🏗 Architecture", "architecture"),
    ("⚡ Quick Start", "quickstart"),
    ("🚀 Deployment Guide", "deployment"),
    ("🌍 Platform Variants", "platform-variants"),
    ("⚙️ Configuration Guide", "configuration"),
    ("🧮 Cost Formula", "formula"),
    ("🔌 API Reference", "api"),
    ("📊 Frontend Dashboard", "frontend"),
    ("💻 CLI Reference", "cli"),
    ("🛠️ Development Guide", "development"),
    ("🔒 Security", "security"),
    ("🔍 Troubleshooting", "troubleshooting"),
    ("❓ FAQ", "faq"),
    ("🗺️ Roadmap", "roadmap"),
]

# Categories/sections from DOCS.md — used for nav highlighting
DOC_CATEGORIES = [
    ("Overview", "1-overview"),
    ("Architecture", "2-architecture"),
    ("Quick Start", "3-quick-start"),
    ("Deployment Guide", "4-deployment-guide"),
    ("Platform Variants", "5-platform-variants"),
    ("Configuration Guide", "6-configuration-guide"),
    ("Cost Formula", "7-cost-formula"),
    ("API Reference", "8-api-reference"),
    ("Frontend Dashboard", "9-frontend-dashboard"),
    ("CLI Reference", "10-cli-reference"),
    ("Development Guide", "11-development-guide"),
    ("Security", "12-security"),
    ("Troubleshooting", "13-troubleshooting"),
    ("FAQ", "14-faq"),
    ("Roadmap", "15-roadmap"),
]

SITE_TITLE = "Container Cost — Documentation"
SITE_DESCRIPTION = "Multi-VPS Docker Container Cost Calculator documentation"
AUTHOR = "Endang Suwarna"
GITHUB_URL = "https://github.com/edsuwarna/container-cost"
GITHUB_EDIT_URL = "https://github.com/edsuwarna/container-cost/blob/main/docs/DOCS.md"

# CSS: dark theme matching container-cost brand
DARK_THEME_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
    --bg: #0d1117;
    --bg2: #161b22;
    --bg3: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --text2: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --orange: #d29922;
    --red: #f85149;
    --code-bg: #151b23;
    --inline-code-bg: #21262d;
}
html { scroll-behavior: smooth; }
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    font-size: 15px;
}

/* ─── Layout ─── */
.layout { display: flex; min-height: 100vh; }

/* ─── Sidebar ─── */
.sidebar {
    width: 280px;
    background: var(--bg2);
    border-right: 1px solid var(--border);
    padding: 0;
    position: fixed;
    top: 0; left: 0;
    height: 100vh;
    overflow-y: auto;
    z-index: 100;
}
.sidebar-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
}
.sidebar-header .logo { font-size: 28px; line-height: 1; }
.sidebar-header h2 {
    font-size: 16px; font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--green));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.sidebar-header small {
    display: block; font-size: 11px; color: var(--text2);
    font-weight: 400; -webkit-text-fill-color: var(--text2);
}
.sidebar-back {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 20px; color: var(--accent);
    text-decoration: none; font-size: 13px; font-weight: 500;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
}
.sidebar-back:hover { background: var(--bg3); }

/* TOC inside sidebar */
.toc { padding: 12px 0; }
.toc-label {
    padding: 8px 20px 4px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--text2);
}
.toc a {
    display: block; padding: 5px 20px 5px 24px;
    color: var(--text2); text-decoration: none;
    font-size: 13px; border-left: 2px solid transparent;
    transition: all 0.15s;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.toc a:hover { color: var(--text); background: var(--bg3); }
.toc a.level-2 { padding-left: 36px; font-size: 12.5px; }
.toc a.level-3 { padding-left: 48px; font-size: 12px; }

/* ─── Main Content ─── */
.content {
    flex: 1;
    margin-left: 280px;
    padding: 40px 56px;
    max-width: 960px;
}

/* ─── Markdown Body ─── */
.markdown-body h1 {
    font-size: 36px; font-weight: 800; margin: 0 0 8px;
    background: linear-gradient(135deg, var(--accent), var(--green));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
}
.markdown-body h1 .header-anchor { display: none; }
.markdown-body h2 {
    font-size: 24px; font-weight: 700; margin: 40px 0 12px;
    padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.markdown-body h3 {
    font-size: 18px; font-weight: 600; margin: 28px 0 8px;
}
.markdown-body h4 {
    font-size: 15px; font-weight: 600; margin: 20px 0 6px;
}
.markdown-body p { margin: 0 0 12px; }
.markdown-body a { color: var(--accent); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body strong { font-weight: 600; }
.markdown-body ul, .markdown-body ol { margin: 8px 0 16px; padding-left: 24px; }
.markdown-body li { margin-bottom: 4px; }
.markdown-body li > ul, .markdown-body li > ol { margin: 4px 0; }

/* Tables */
.markdown-body table {
    width: 100%; border-collapse: collapse; margin: 16px 0 20px; font-size: 14px;
}
.markdown-body th {
    background: var(--bg3); padding: 10px 12px; text-align: left;
    font-weight: 600; border: 1px solid var(--border);
}
.markdown-body td {
    padding: 8px 12px; border: 1px solid var(--border);
}
.markdown-body tr:nth-child(even) td { background: var(--bg2); }

/* Inline Code */
.markdown-body code {
    background: var(--inline-code-bg); border: 1px solid var(--border);
    padding: 2px 6px; border-radius: 4px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px; color: #f0f6fc;
}
.markdown-body pre {
    background: var(--code-bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 18px 20px;
    margin: 12px 0 20px; overflow-x: auto; line-height: 1.5;
}
.markdown-body pre code {
    background: none; border: none; padding: 0;
    color: #c9d1d9; font-size: 13px; tab-size: 2;
}

/* Blockquotes */
.markdown-body blockquote {
    border-left: 3px solid var(--accent);
    padding: 12px 16px; margin: 12px 0 20px;
    background: #1f6feb0a; border-radius: 0 8px 8px 0;
}
.markdown-body blockquote p { margin: 0; color: var(--text2); }

/* Horizontal Rule */
.markdown-body hr {
    border: none; border-top: 1px solid var(--border); margin: 36px 0;
}

/* Images */
.markdown-body img { max-width: 100%; border-radius: 8px; }

/* Checklists */
.markdown-body input[type="checkbox"] { accent-color: var(--green); margin-right: 6px; }

/* Scrollbar */
.sidebar::-webkit-scrollbar { width: 6px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Mobile */
.sidebar-toggle {
    display: none; position: fixed; top: 12px; left: 12px; z-index: 200;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 20px;
}
.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
@media (max-width: 900px) {
    .sidebar { transform: translateX(-100%); transition: transform 0.3s; }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay.open { display: block; }
    .sidebar-toggle { display: block; }
    .content { margin-left: 0; padding: 24px 20px; }
    .markdown-body h1 { font-size: 28px; }
    .markdown-body h2 { font-size: 20px; }
}

/* Footer */
.doc-footer {
    margin-top: 48px; padding-top: 24px;
    border-top: 1px solid var(--border); text-align: center;
    color: var(--text2); font-size: 13px;
}
.doc-footer a { color: var(--accent); text-decoration: none; }

/* Updated badge */
.updated-badge {
    display: inline-block; background: #1f6feb22;
    border: 1px solid #1f6feb44; color: var(--accent);
    padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;
    margin-bottom: 20px;
}
"""

# ─── HTML Template ───────────────────────────────────────────────

def make_html(title, content_html, toc_items, current_path="docs.html"):
    """Wrap rendered markdown in the full HTML page template."""
    
    # Build TOC sidebar HTML
    toc_html = ""
    for label, href, level in toc_items:
        cls = f"level-{level}" if level > 1 else ""
        toc_html += f'<a href="{href}" class="{cls}">{label}</a>\n'
    
    # Build nav items for sidebar
    nav_html = ""
    for nav_label, nav_href in DOC_NAV_ITEMS:
        active = "active" if nav_href == current_path.replace(".html", "") else ""
        nav_html += f'<a href="{nav_href}.html" class="{active}">{nav_label}</a>\n'
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — Container Cost Docs</title>
    <meta name="description" content="{SITE_DESCRIPTION}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>{DARK_THEME_CSS}</style>
</head>
<body>
    <button class="sidebar-toggle" id="sidebarToggle" onclick="toggleSidebar()">☰</button>
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

    <div class="layout">
        <!-- Sidebar -->
        <nav class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo">💰</div>
                <div>
                    <h2>Container Cost</h2>
                    <small>Documentation v2.0</small>
                </div>
            </div>
            <a href="index.html" class="sidebar-back">← Back to Home</a>
            <div class="toc">
                <div class="toc-label">Categories</div>
                {nav_html}
                <div class="toc-label" style="margin-top:12px;">On this page</div>
                {toc_html}
            </div>
        </nav>

        <!-- Main Content -->
        <main class="content">
            <div class="markdown-body">
                {content_html}
            </div>
            <div class="doc-footer">
                Built with ❤️ by <a href="https://github.com/edsuwarna">{AUTHOR}</a> ·
                <a href="{GITHUB_URL}">GitHub</a> ·
                <a href="{GITHUB_EDIT_URL}">Edit on GitHub</a>
            </div>
        </main>
    </div>

    <script>
        function toggleSidebar() {{
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebarOverlay').classList.toggle('open');
        }}
        // Highlight current section in TOC based on scroll position
        document.addEventListener('DOMContentLoaded', function() {{
            var headings = document.querySelectorAll('h2, h3');
            var links = document.querySelectorAll('.toc a');
            if (headings.length === 0) return;
            var observer = new IntersectionObserver(function(entries) {{
                entries.forEach(function(entry) {{
                    if (entry.isIntersecting) {{
                        links.forEach(function(l) {{ l.classList.remove('active'); }});
                        var id = entry.target.id;
                        links.forEach(function(l) {{
                            if (l.getAttribute('href') === '#' + id) {{
                                l.classList.add('active');
                            }}
                        }});
                    }}
                }});
            }}, {{ rootMargin: '-80px 0px -80% 0px' }});
            headings.forEach(function(h) {{ observer.observe(h); }});
        }});
    </script>
</body>
</html>"""


# ─── Markdown Extensions ─────────────────────────────────────────

MD_EXTENSIONS = [
    "extra",          # tables, footnotes, attr_list, etc.
    "codehilite",     # syntax highlighting
    "toc",            # table of contents generation
    "sane_lists",     # better list behavior
    "smarty",         # smart quotes
]


def extract_toc(md_content):
    """Extract headings from markdown content to build a table of contents.
    Returns list of (label, href, level) tuples for h1, h2, h3."""
    toc = []
    for line in md_content.split("\n"):
        m = re.match(r"^(#{1,3})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            # Strip markdown formatting from heading text for display
            label = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
            label = re.sub(r"\*(.+?)\*", r"\1", label)
            label = re.sub(r"`(.+?)`", r"\1", label)
            # Generate anchor id (same as what Python markdown generates)
            anchor_id = label.lower()
            anchor_id = re.sub(r"[^a-z0-9]+", "-", anchor_id)
            anchor_id = re.sub(r"^-|-$", "", anchor_id)
            toc.append((label, f"#{anchor_id}", level))
    return toc


def rewrite_internal_links(html_content):
    """Rewrite .md links to .html links within the docs.
    Also handle anchor-only links (no .md)."""
    # Replace [text](path.md#anchor) -> [text](path.html#anchor)
    html_content = re.sub(
        r'href="([^"]+)\.md(#.*?)?"',
        lambda m: 'href="' + m.group(1) + '.html' + (m.group(2) or '') + '"',
        html_content
    )
    return html_content


def convert_md_to_html(md_path, output_dir=None):
    """Convert a single markdown file to HTML and write to output_dir."""
    if output_dir is None:
        output_dir = OUTPUT_DIR
    
    pass
    
    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()
    
    # Build TOC from headings
    toc_items = extract_toc(md_content)
    
    # Convert markdown to HTML
    html_body = markdown.markdown(
        md_content,
        extensions=MD_EXTENSIONS,
        output_format="html",
    )
    
    # Rewrite internal .md links to .html
    html_body = rewrite_internal_links(html_body)
    
    # Get output filename
    basename = os.path.splitext(os.path.basename(md_path))[0]
    out_filename = basename + ".html"
    out_path = os.path.join(output_dir, out_filename)
    
    # Determine page title from first h1
    title_match = re.search(r"<h1[^>]*>(.+?)</h1>", html_body)
    if title_match:
        page_title = title_match.group(1)
    else:
        page_title = basename.replace("-", " ").title()
    
    # Wrap in HTML template
    html_page = make_html(
        title=page_title,
        content_html=html_body,
        toc_items=toc_items,
        current_path=out_filename,
    )
    
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_page)
    
    print(f"  ✓ {out_path} ({len(html_page)} bytes)")
    return out_path


def find_md_files(docs_dir=None):
    """Find all .md files in the docs directory (excluding docs/ and hidden dirs)."""
    if docs_dir is None:
        docs_dir = DOCS_DIR
    
    md_files = []
    for f in sorted(os.listdir(docs_dir)):
        if f.startswith("."):
            continue
        if os.path.isdir(os.path.join(docs_dir, f)):
            continue
        if f.endswith(".md"):
            md_files.append(os.path.join(docs_dir, f))
    
    return md_files


def main():
    print(f"📖 Container Cost Documentation Generator")
    print(f"   Input:  {DOCS_DIR}")
    print(f"   Output: {OUTPUT_DIR}")
    print()
    
    md_files = find_md_files()
    
    if not md_files:
        print("⚠  No .md files found in docs directory.")
        sys.exit(1)
    
    for md_path in md_files:
        fname = os.path.basename(md_path)
        print(f"  Converting {fname} ...")
        convert_md_to_html(md_path)
    
    print()
    print(f"✅ Done — {len(md_files)} file(s) converted to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
