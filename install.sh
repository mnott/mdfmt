#!/usr/bin/env bash
# install.sh — Install md2pdf CLI, the "Convert to Styled PDF" Finder Quick
# Action, and (optionally) the matching MarkEdit editor.css customisation.
#
# Usage:
#   ./install.sh                # interactive
#   ./install.sh --yes          # accept all defaults
#   ./install.sh --uninstall    # remove everything

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$REPO_DIR/bin"
SERVICES_SRC="$REPO_DIR/services"
MARKEDIT_CSS_SRC="$REPO_DIR/markedit/editor.css"

USER_BIN="/usr/local/bin"
[ -w "$USER_BIN" ] || USER_BIN="$HOME/.local/bin"
mkdir -p "$USER_BIN"

USER_SERVICES="$HOME/Library/Services"
mkdir -p "$USER_SERVICES"

MARKEDIT_DOCS="$HOME/Library/Containers/app.cyan.markedit/Data/Documents"

YES=0
UNINSTALL=0
for arg in "$@"; do
    case "$arg" in
        --yes|-y) YES=1 ;;
        --uninstall) UNINSTALL=1 ;;
        -h|--help)
            sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
    esac
done

ask() {
    local prompt="$1"
    if [ "$YES" = "1" ]; then return 0; fi
    read -rp "$prompt [Y/n] " ans
    [[ "${ans:-y}" =~ ^[Yy] ]]
}

if [ "$UNINSTALL" = "1" ]; then
    echo "Uninstalling..."
    rm -f "$USER_BIN/md2pdf"
    rm -rf "$USER_SERVICES/Convert to Styled PDF.workflow"
    /System/Library/CoreServices/pbs -flush 2>/dev/null || true
    echo "Done. (MarkEdit editor.css was NOT removed; delete manually if desired.)"
    exit 0
fi

if ! command -v bunx >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: need bun or node installed first." >&2
    echo "  brew install oven-sh/bun/bun     # recommended" >&2
    echo "  brew install node" >&2
    exit 1
fi

echo "==> Installing md2pdf to $USER_BIN"
ln -sf "$BIN_DIR/md2pdf" "$USER_BIN/md2pdf"

echo "==> Installing 'Convert to Styled PDF' Quick Action to $USER_SERVICES"
cp -R "$SERVICES_SRC/Convert to Styled PDF.workflow" "$USER_SERVICES/"
/System/Library/CoreServices/pbs -flush 2>/dev/null || true

if [ -d "$MARKEDIT_DOCS" ]; then
    if ask "==> Install matching MarkEdit editor.css customisation?"; then
        if [ -f "$MARKEDIT_DOCS/editor.css" ] && ! cmp -s "$MARKEDIT_CSS_SRC" "$MARKEDIT_DOCS/editor.css"; then
            cp "$MARKEDIT_DOCS/editor.css" "$MARKEDIT_DOCS/editor.css.backup-$(date +%Y%m%d-%H%M%S)"
            echo "    Backed up existing editor.css"
        fi
        cp "$MARKEDIT_CSS_SRC" "$MARKEDIT_DOCS/editor.css"
        echo "    Installed editor.css"
    fi
fi

echo
echo "DONE."
echo
echo "CLI:        md2pdf foo.md --open"
echo "Finder:     right-click .md → Quick Actions → Convert to Styled PDF"
