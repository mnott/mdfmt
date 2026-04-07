/**
 * mdfmt-extension.js — Format the current MarkEdit document with prettier,
 * entirely inside MarkEdit's WKWebView (no shell, no services, no native bridge).
 *
 * Adds: main menu item "Format Markdown".
 * On invocation, the extension grabs the document text, runs it through
 * prettier's standalone browser build with the markdown plugin, and writes
 * the formatted text back as a SINGLE atomic CodeMirror transaction so the
 * cursor selection is preserved (mapped through the change) instead of
 * resetting to position 0.
 *
 * Install:
 *   ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/mdfmt-extension.js
 * then restart MarkEdit.
 */

(function () {
    "use strict";

    if (typeof MarkEdit === "undefined" || typeof MarkEdit.addMainMenuItem !== "function") {
        console.warn("mdfmt-extension: MarkEdit API not available");
        return;
    }

    const PRETTIER_VERSION = "3.8.1";
    const PRETTIER_URL = `https://cdn.jsdelivr.net/npm/prettier@${PRETTIER_VERSION}/standalone.mjs`;
    const MARKDOWN_PLUGIN_URL = `https://cdn.jsdelivr.net/npm/prettier@${PRETTIER_VERSION}/plugins/markdown.mjs`;

    let prettierPromise = null;
    function loadPrettier() {
        if (prettierPromise === null) {
            prettierPromise = Promise.all([
                import(PRETTIER_URL),
                import(MARKDOWN_PLUGIN_URL),
            ]).then(([prettier, mdPlugin]) => ({
                prettier: prettier.default || prettier,
                plugin: mdPlugin.default || mdPlugin,
            }));
        }
        return prettierPromise;
    }

    /**
     * Get the underlying CodeMirror EditorView. MarkEdit exposes it via
     * window.editor. We need it to dispatch a single atomic transaction.
     */
    function getView() {
        if (typeof window.editor === "object" && window.editor !== null) {
            return window.editor;
        }
        return null;
    }

    /**
     * Capture cursor as { line: number (0-based), col: number, lineText: string }.
     * Line numbers are stable across prettier reflows; absolute offsets are not.
     */
    function captureAnchor(view) {
        try {
            const state = view.state;
            const head = state.selection.main.head;
            const line = state.doc.lineAt(head);
            return {
                line: line.number - 1,
                col: head - line.from,
                lineText: line.text,
                docLines: state.doc.lines,
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Find the absolute character offset that best matches the captured anchor
     * inside the freshly-formatted text. Strategy:
     *   1. If a line with identical text exists, use it (prefer closest to
     *      original line index).
     *   2. Otherwise, fall back to the same line index (clamped to new total).
     */
    function findTargetOffset(formatted, anchor) {
        if (!anchor) return 0;

        const lines = formatted.split(/\r?\n/);
        let targetLine = -1;

        if (anchor.lineText && anchor.lineText.length > 0) {
            let bestDist = Infinity;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i] === anchor.lineText) {
                    const dist = Math.abs(i - anchor.line);
                    if (dist < bestDist) {
                        bestDist = dist;
                        targetLine = i;
                        if (dist === 0) break;
                    }
                }
            }
        }

        if (targetLine < 0) {
            targetLine = Math.min(anchor.line, lines.length - 1);
            if (targetLine < 0) targetLine = 0;
        }

        // Compute absolute offset of (targetLine, col)
        let offset = 0;
        for (let i = 0; i < targetLine; i++) {
            offset += lines[i].length + 1; // +1 for the line break
        }
        const lineLen = lines[targetLine] ? lines[targetLine].length : 0;
        offset += Math.min(anchor.col || 0, lineLen);
        return offset;
    }

    async function formatDocument() {
        try {
            const view = getView();
            if (!view) {
                console.warn("mdfmt-extension: window.editor not available");
                return;
            }

            const original = view.state.doc.toString();
            if (!original) return;

            const anchor = captureAnchor(view);

            const { prettier, plugin } = await loadPrettier();
            const formatted = await prettier.format(original, {
                parser: "markdown",
                plugins: [plugin],
                proseWrap: "preserve",
                printWidth: 100,
            });

            if (typeof formatted !== "string" || formatted === original) return;

            const target = findTargetOffset(formatted, anchor);

            // ONE atomic transaction: change the doc AND set the selection.
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: formatted },
                selection: { anchor: Math.min(target, formatted.length) },
                scrollIntoView: true,
            });
        } catch (err) {
            console.error("mdfmt-extension: format failed", err);
            try {
                MarkEdit.showAlert({
                    title: "Format Markdown failed",
                    message: String(err && err.message ? err.message : err),
                });
            } catch (_) {}
        }
    }

    MarkEdit.addMainMenuItem({
        title: "Format Markdown",
        action: formatDocument,
    });

    console.log("mdfmt-extension: loaded — Format Markdown menu item added");
})();
