# mdfmt — Markdown formatting & styled PDF for macOS

A focused, opinionated styling kit for Markdown notes on macOS, built around
[MarkEdit](https://github.com/MarkEdit-app/MarkEdit). Two CLI tools, two
Finder Quick Actions, a custom MarkEdit editor stylesheet, and a matching PDF
theme — bundled together so the way your notes look in the editor is the way
they look when exported.

## What's in the box

| Piece | What it does |
| --- | --- |
| `bin/mdfmt` | Wraps Prettier with markdown defaults (`--prose-wrap preserve`). Idempotent. |
| `bin/md2pdf` | Wraps [`md-to-pdf`](https://github.com/simonhaenisch/md-to-pdf) with the bundled MarkEdit-style theme. |
| `services/Format Markdown.workflow` | Finder Quick Action — right-click .md file(s), runs `mdfmt`. Great for batch-formatting a folder of notes. |
| `services/Convert to Styled PDF.workflow` | Finder Quick Action — right-click .md, runs `md2pdf` and opens the result in Preview. |
| `markedit/editor.css` | Optional MarkEdit edit-view stylesheet — blue gradient heading bars (H1–H4), with **CodeMirror-safe geometry** so cursor navigation stays accurate. |
| `styles/markedit-pdf.css` | Stylesheet `md2pdf` uses for PDF rendering — same blue gradient look as the editor. |

## What it isn't (and why)

This repo is **deliberately narrow**. We tried building everything in-editor
and ran into walls; here's the honest map of what does and doesn't work in
MarkEdit's current API surface, so the next person doesn't waste a day on it:

- **In-editor markdown formatting**: not in this repo. Install
  **[MarkEdit-prettier](https://github.com/MarkEdit-app/MarkEdit-prettier)**
  (official, ships as a MarkEdit extension). Bind a shortcut from the menu and
  you're set. We submitted a PR to that repo to add cursor-position
  preservation.

- **In-editor live table editing**: not in this repo. Install
  **[MarkEdit-mte](https://github.com/MarkEdit-app/MarkEdit-mte)** (official,
  Tab/Enter cell navigation, Format / Format All commands). Solves the
  "tables in source view are unreadable" problem properly.

- **In-editor PDF generation**: **not viable** with MarkEdit's current
  extension API. We tried two paths:
  1. `window.print()` from a hidden iframe inside MarkEdit's WKWebView —
     silently does nothing (no print bridge exposed).
  2. `MarkEdit.runService()` to invoke a macOS Service that takes a file path
     — silently fails. The pasteboard type runService writes (text) doesn't
     match what file-based Quick Actions expect (`NSSendFileTypes`), and a
     custom text-input service workflow registers but isn't invoked when
     called via runService (root cause invisible from JavaScript).
  Use the Finder Quick Action or `md2pdf` CLI instead. Both are friction-free
  and produce identical output.

## Requirements

- **macOS** (Quick Actions, MarkEdit container paths)
- **bun** (recommended) or **node** for the CLI tools
- **MarkEdit** (optional — only if you want the editor.css)

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

1. Symlinks `bin/mdfmt` and `bin/md2pdf` into `/usr/local/bin`
2. Copies the two Quick Actions to `~/Library/Services` and flushes the Services cache
3. Optionally installs `markedit/editor.css` (with a timestamped backup of any existing one)

`./install.sh --yes` accepts all defaults. `./install.sh --uninstall` removes everything.

## Usage

### CLI

```sh
mdfmt notes.md                  # format in place (idempotent)
mdfmt notes.md other.md         # multiple files
mdfmt --check notes.md          # dry-run, just report

md2pdf notes.md                 # writes notes.pdf next to source
md2pdf notes.md out.pdf         # custom output path
md2pdf notes.md --open          # convert and open in Preview
```

### Finder

Right-click any `.md` file → **Quick Actions** → choose:

- **Format Markdown** → reformats in place via `mdfmt`. Select multiple files first to batch-format.
- **Convert to Styled PDF** → renders via `md2pdf` and opens the PDF in Preview.

If a Quick Action doesn't appear in the menu, enable it once in
**System Settings → Privacy & Security → Extensions → Finder Extensions**.

### Recommended companions for MarkEdit users

These two cover everything we initially wanted to build but couldn't ship as
extensions ourselves:

- [**MarkEdit-mte**](https://github.com/MarkEdit-app/MarkEdit-mte) — live
  table editor (Tab/Enter cell navigation, Format / Format All).
- [**MarkEdit-prettier**](https://github.com/MarkEdit-app/MarkEdit-prettier) —
  whole-document Prettier formatting from the menu.

Install both into `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`
and restart MarkEdit. They live happily alongside the bundled `editor.css`.

---

## The MarkEdit `editor.css`

`markedit/editor.css` styles MarkEdit's edit view with blue gradient heading
bars (H1 → H4), inspired by Obsidian's MN theme. Installed by `./install.sh`
to:

```
~/Library/Containers/app.cyan.markedit/Data/Documents/editor.css
```

### Two pitfalls baked into the CSS (worth knowing if you customise it)

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
│   ├── mdfmt              # prettier wrapper
│   └── md2pdf             # md-to-pdf wrapper, resolves CSS via $BASH_SOURCE
├── styles/
│   └── markedit-pdf.css   # PDF stylesheet (used by md2pdf)
├── markedit/
│   └── editor.css         # MarkEdit edit-view stylesheet (optional install)
└── services/
    ├── Format Markdown.workflow/         # Finder right-click → mdfmt
    └── Convert to Styled PDF.workflow/   # Finder right-click → md2pdf
```

## Uninstall

```sh
./install.sh --uninstall
```

Removes the CLI symlinks and both Quick Actions. The MarkEdit `editor.css` is
**not** removed automatically — delete it manually if you want.

## License

MIT
