# mdfmt — Styled PDF export for Markdown notes on macOS

A tiny, focused tool: render Markdown to a beautiful PDF using a custom blue
gradient theme that matches the look of [MarkEdit](https://github.com/MarkEdit-app/MarkEdit)
when paired with the bundled `editor.css`.

> **The name is misleading and historical** — earlier versions of this repo
> tried to do markdown formatting too, but that's already covered properly
> by [MarkEdit-mte](https://github.com/MarkEdit-app/MarkEdit-mte) (live table
> editor with cell-aware formatting). The repo has since narrowed to PDF
> export and the matching editor stylesheet.

## What you get

| Piece | Purpose |
| --- | --- |
| `bin/md2pdf` | CLI: render any `.md` file to a styled PDF using the bundled theme. Wraps [`md-to-pdf`](https://github.com/simonhaenisch/md-to-pdf). |
| `bin/md2html` | CLI: render any `.md` file to a self-contained styled HTML using the same theme as md2pdf. |
| `services/Convert to Styled PDF.workflow` | macOS Finder Quick Action: right-click a `.md` file → styled PDF, opens in Preview. |
| `services/Convert to Styled HTML.workflow` | macOS Finder Quick Action: right-click a `.md` file → styled HTML, opens in default browser. |
| `styles/markedit-pdf.css` | The PDF stylesheet — H1–H4 blue gradient banners, GitHub-style code blocks and tables, page-break-aware. Edit once, all your PDFs change. |
| `markedit/editor.css` | Optional: matching MarkEdit edit-view stylesheet so the editor and the PDF look the same. Includes documented workarounds for two CodeMirror 6 pitfalls (see below). |

## Recommended companions

If you use MarkEdit, install these from the official MarkEdit ecosystem for
the in-editor editing experience this repo deliberately doesn't reinvent:

- [**MarkEdit-mte**](https://github.com/MarkEdit-app/MarkEdit-mte) — live table
  editor with Tab/Enter cell navigation and Format / Format All commands.
  Built on `@tgrosinger/md-advanced-tables` (the same library Obsidian uses).
- [**MarkEdit-prettier**](https://github.com/MarkEdit-app/MarkEdit-prettier) —
  whole-document Prettier formatting from the menu, if you want it.

Drop their `dist/*.js` files into
`~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/` and restart
MarkEdit. They live happily alongside this repo's `editor.css`.

## Requirements

- **macOS** (Quick Actions, MarkEdit container paths)
- **bun** (recommended) or **node** for `md2pdf`

```sh
brew install oven-sh/bun/bun     # recommended
# or
brew install node
```

## Install

```sh
git clone https://github.com/mnott/mdfmt.git
cd mdfmt
./install.sh
```

The installer:

1. Symlinks `bin/md2pdf` into `/usr/local/bin`
2. Copies the Quick Action to `~/Library/Services` and flushes the Services cache
3. Optionally installs `markedit/editor.css` (with a timestamped backup of any existing one)

`./install.sh --yes` accepts all defaults. `./install.sh --uninstall` removes everything.

## Usage

### CLI

```sh
md2pdf notes.md                 # writes notes.pdf next to source
md2pdf notes.md out.pdf         # custom output path
md2pdf notes.md --open          # convert and open in Preview

md2html notes.md                # writes notes.html (self-contained, same theme)
md2html notes.md --open         # convert and open in default browser
```

### Finder

Right-click any `.md` file → **Quick Actions → Convert to Styled PDF** (or **Convert to Styled HTML**).

If the Quick Action doesn't appear, enable it once in
**System Settings → Privacy & Security → Extensions → Finder Extensions**.

---

## The MarkEdit `editor.css`

`markedit/editor.css` styles MarkEdit's edit view with the same blue gradient
heading bars (H1 → H4) used in the PDF theme, so what you see while writing
matches what you get when you export.

Installed by `./install.sh` to:

```
~/Library/Containers/app.cyan.markedit/Data/Documents/editor.css
```

### Two pitfalls baked into the CSS — worth knowing if you customise it

**1. No `padding`/`margin`/`border` on `.cm-line`.** CodeMirror 6 caches line
geometry on first render. Raw CSS that grows the line box (padding, margin,
border) does **not** trigger CM6's `ResizeObserver` re-measurement, so click
hit-testing and arrow-key navigation drift away from the visual position.
Painful, and the symptom is "I click on line 19 and the cursor lands on line
20".

This file uses **`font-size`**, **`line-height`**, and **`box-shadow`**
instead — those *do* round-trip through CM6's measurement and stay in sync
with the cursor model. Heading-line backgrounds use plain `background:
linear-gradient(...)` which doesn't change geometry.

**2. Table headers must override the heading colour.** CodeMirror's
`@lezer/markdown` parser tags table header cells with the `heading` highlight
token. If your theme has `heading: "#ffffff"` (so heading text is readable on
the dark gradient), table headers become white-on-white and disappear. The
`.cm-line[class*="cm-md-table"]` block in `editor.css` forces table cells to
a readable colour without disturbing actual headings.

---

## The PDF theme

`styles/markedit-pdf.css` mirrors the editor look for printing:

- Blue gradient banners on H1–H4
- GitHub-style body fonts and tables
- `page-break-inside: avoid` on headings, tables, and code blocks
- A4 with 18–20 mm margins

Edit the file, run `md2pdf` again, see the change instantly. No npm install
needed at runtime — `bunx md-to-pdf` fetches it on demand.

---

## Layout

```
mdfmt/
├── README.md
├── LICENSE
├── install.sh
├── .gitignore
├── bin/
│   ├── md2pdf             # md-to-pdf wrapper, resolves CSS via $BASH_SOURCE
│   └── md2html            # same wrapper, --as-html output (shared CSS)
├── styles/
│   └── markedit-pdf.css   # shared stylesheet (used by md2pdf and md2html)
├── markedit/
│   └── editor.css         # MarkEdit edit-view stylesheet (optional install)
└── services/
    ├── Convert to Styled PDF.workflow/    # Finder right-click → md2pdf
    └── Convert to Styled HTML.workflow/   # Finder right-click → md2html
```

## Uninstall

```sh
./install.sh --uninstall
```

Removes the CLI symlink and the Quick Action. The MarkEdit `editor.css` is
**not** removed automatically — delete it manually if you want.

## Why the name `mdfmt`?

Historical leftover from earlier iterations that tried to wrap Prettier as
well. The repo could honestly be called `markedit-pdf` now — but renaming
public repos breaks links, so it stays.

## License

MIT
