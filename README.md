# mdfmt — Markdown formatting & styled PDF for macOS + MarkEdit

Two CLI tools, two Finder Quick Actions, a MarkEdit JavaScript extension, and a
custom MarkEdit editor stylesheet — bundled together so you can:

- **Format markdown in place** (auto-aligned tables, normalised lists) — from the
  CLI, from a Finder right-click, or from inside [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) via a menu item.
- **Render markdown to a styled PDF** with a blue-gradient theme that mirrors
  MarkEdit's edit-mode look — from the CLI or Finder right-click.
- **Style MarkEdit's edit view** with the same blue-gradient headings and a few
  fixes for cursor navigation and table-cell visibility.

| Tool | What it does |
| ---- | ------------ |
| `mdfmt` | Wraps Prettier with markdown defaults (`--prose-wrap preserve`). Idempotent. |
| `md2pdf` | Wraps [`md-to-pdf`](https://github.com/simonhaenisch/md-to-pdf) with the bundled MarkEdit-style theme. |
| `Format Markdown.workflow` | Finder Quick Action → runs `mdfmt` on the selected `.md` file(s). |
| `Convert to Styled PDF.workflow` | Finder Quick Action → runs `md2pdf` and opens the result. |
| `markedit/scripts/mdfmt-extension.js` | MarkEdit extension: adds a "Format Markdown" main menu item that runs prettier in-WebView (no shell, no service) and preserves the cursor. |
| `markedit/editor.css` | Optional MarkEdit edit-view stylesheet. |
| `styles/markedit-pdf.css` | Stylesheet used by `md2pdf` for rendering. |

---

## Requirements

- **macOS** (Quick Actions, Services, MarkEdit container paths)
- **bun** (recommended) or **node** for the CLI tools
- **MarkEdit** (optional, if you want the in-editor extension and editor.css)
- An **internet connection** on first use of the MarkEdit extension (it loads
  prettier from a CDN once, then it's cached by WebKit)

```sh
brew install oven-sh/bun/bun     # recommended
# or
brew install node
```

## Install

```sh
git clone https://github.com/<you>/mdfmt.git
cd mdfmt
./install.sh
```

This will:

1. Symlink `bin/mdfmt` and `bin/md2pdf` into `/usr/local/bin`
2. Copy the two Quick Actions to `~/Library/Services` and flush the Services cache
3. Optionally install `markedit/editor.css` (with a timestamped backup of any existing one)
4. Optionally install `markedit/scripts/mdfmt-extension.js` into MarkEdit's scripts folder

`./install.sh --yes` accepts all defaults. `./install.sh --uninstall` removes everything.

## Usage

### CLI

```sh
mdfmt notes.md                  # format in place
mdfmt notes.md other.md         # multiple files
mdfmt --check notes.md          # dry-run

md2pdf notes.md                 # writes notes.pdf next to source
md2pdf notes.md out.pdf         # custom output path
md2pdf notes.md --open          # convert and open in Preview
```

### Finder

Right-click any `.md` file → **Quick Actions** → choose:

- **Format Markdown** → reformats in place
- **Convert to Styled PDF** → renders and opens the PDF

If a Quick Action doesn't appear in the menu, enable it once in
**System Settings → Privacy & Security → Extensions → Finder Extensions**.

### MarkEdit

The bundled extension adds a **Format Markdown** menu item to MarkEdit's main
menubar. It runs prettier inside MarkEdit's WKWebView and preserves your cursor
position by remembering the line text + index, so reformatting jumps you back
to the same logical line afterwards.

> **Why a JavaScript extension instead of a service?**
> MarkEdit doesn't expose its open document as a file path to the macOS
> Services system, so file-based Quick Actions don't appear in MarkEdit's
> Services menu. The extension uses MarkEdit's JS API (`addMainMenuItem`,
> `window.editor.dispatch`) and runs prettier locally — no shell, no native
> bridge.

To assign a keyboard shortcut to the menu item: **System Settings → Keyboard →
Keyboard Shortcuts → App Shortcuts → +**, pick MarkEdit, type `Format Markdown`
exactly, and bind your preferred keys.

---

## The MarkEdit `editor.css`

`markedit/editor.css` styles MarkEdit's edit view with blue-gradient heading
bars (H1 → H4), inspired by Obsidian's MN theme. Installed by `./install.sh` to:

```
~/Library/Containers/app.cyan.markedit/Data/Documents/editor.css
```

### Two pitfalls baked into the CSS

**1. No `padding`/`margin`/`border` on `.cm-line`.** CodeMirror 6 caches line
geometry on first render. Raw CSS that grows the line box (padding, margin,
border) does **not** trigger CM6's `ResizeObserver` re-measurement, so click
hit-testing and arrow-key navigation drift away from the visual position.
Painful.

This file uses **`font-size`**, **`line-height`**, and **`box-shadow`** instead
— those *do* round-trip through CM6's measurement and stay in sync with the
cursor model.

**2. Table headers must override the heading colour.** CodeMirror's
`@lezer/markdown` parser tags table header cells with the `heading` highlight
token. If your theme has `heading: "#ffffff"` (so heading text is readable on a
dark gradient), table headers become white-on-white. The
`.cm-line[class*="cm-md-table"]` block forces table cells to a readable colour
without disturbing actual headings.

---

## The PDF theme

`styles/markedit-pdf.css` mirrors the editor look for printing:

- Blue gradient banners on H1–H3
- Soft blue accent on H4
- GitHub-style body fonts and tables
- `page-break-inside: avoid` on headings, tables, and code blocks
- A4 with 18–20 mm margins

Edit the file, run `md2pdf` again, see the change instantly.

---

## Layout

```
mdfmt/
├── README.md
├── LICENSE
├── install.sh
├── .gitignore
├── bin/
│   ├── mdfmt                              # prettier wrapper
│   └── md2pdf                             # md-to-pdf wrapper
├── styles/
│   └── markedit-pdf.css                   # PDF stylesheet
├── markedit/
│   ├── editor.css                         # MarkEdit edit-view stylesheet
│   └── scripts/
│       └── mdfmt-extension.js             # MarkEdit JS extension
└── services/
    ├── Format Markdown.workflow/          # Finder Quick Action → mdfmt
    └── Convert to Styled PDF.workflow/    # Finder Quick Action → md2pdf
```

## Uninstall

```sh
./install.sh --uninstall
```

Removes the CLI symlinks, both Quick Actions, the MarkEdit extension, and any
keyboard shortcut bindings under `app.cyan.markedit / NSUserKeyEquivalents`.
The MarkEdit `editor.css` is **not** removed automatically — delete it manually
if you want.

## Why these defaults?

- **Prose wrapping**: `mdfmt` (and the in-MarkEdit extension) use
  `proseWrap: "preserve"` so prettier doesn't reflow your paragraphs. Only
  structural elements (tables, lists, headings) get normalised.
- **PDF page size**: A4 because Europe. Edit `styles/markedit-pdf.css` if you
  want US Letter.
- **Body class on the rendered HTML**: `markdown-body`, so the same CSS could
  be reused with [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) if desired.

## License

MIT
