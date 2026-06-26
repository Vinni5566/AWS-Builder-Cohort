// ─── Markdown Parser ──────────────────────────────────────────────────────────
class MarkdownParser {
    parse(markdown) {
        let html = markdown;
        html = this.parseHeaders(html);
        html = this.parseCodeBlocks(html);
        html = this.parseInlineCode(html);
        html = this.parseBoldItalic(html);
        html = this.parseImages(html);  // images before links
        html = this.parseLinks(html);
        html = this.parseLists(html);
        html = this.parseBlockquotes(html);
        html = this.parseHorizontalRules(html);
        html = this.parseParagraphs(html);
        return html;
    }

    // Parse headers (# to ######)
    parseHeaders(text) {
        return text.replace(/^#{1,6}\s+(.+)$/gm, (match, content) => {
            const level = match.match(/^#+/)[0].length;
            return `<h${level}>${content}</h${level}>`;
        });
    }

    // Parse fenced code blocks (```lang\ncode```)
    parseCodeBlocks(text) {
        return text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre${lang ? ` data-lang="${lang}"` : ''}><code>${this.escapeHtml(code)}</code></pre>`
        );
    }

    // Parse inline code (`code`)
    parseInlineCode(text) {
        return text.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    // Parse bold (** / __) and italic (* / _)
    parseBoldItalic(text) {
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
        text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
        text = text.replace(/_(.+?)_/g, '<em>$1</em>');
        return text;
    }

    // Parse links [text](url)
    parseLinks(text) {
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    // Parse images ![alt](url)
    parseImages(text) {
        return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    }

    // Parse unordered (-) and ordered (1.) lists
    parseLists(text) {
        const lines = text.split('\n');
        const result = [];
        let inUl = false, inOl = false;

        for (const line of lines) {
            const ulMatch = line.match(/^[\*\-]\s+(.+)$/);
            const olMatch = line.match(/^\d+\.\s+(.+)$/);

            if (ulMatch) {
                if (!inUl) { if (inOl) { result.push('</ol>'); inOl = false; } result.push('<ul>'); inUl = true; }
                result.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (!inOl) { if (inUl) { result.push('</ul>'); inUl = false; } result.push('<ol>'); inOl = true; }
                result.push(`<li>${olMatch[1]}</li>`);
            } else {
                if (inUl) { result.push('</ul>'); inUl = false; }
                if (inOl) { result.push('</ol>'); inOl = false; }
                result.push(line);
            }
        }

        if (inUl) result.push('</ul>');
        if (inOl) result.push('</ol>');
        return result.join('\n');
    }

    // Parse blockquotes (> text)
    parseBlockquotes(text) {
        const lines = text.split('\n');
        const result = [];
        let inBlockquote = false;

        for (const line of lines) {
            if (line.startsWith('> ')) {
                if (!inBlockquote) { result.push('<blockquote>'); inBlockquote = true; }
                result.push(line.substring(2));
            } else {
                if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false; }
                result.push(line);
            }
        }

        if (inBlockquote) result.push('</blockquote>');
        return result.join('\n');
    }

    // Parse horizontal rules (---, ***, ___)
    parseHorizontalRules(text) {
        return text.replace(/^[-*_]{3,}$/gm, '<hr>');
    }

    // Wrap remaining text in <p> tags
    parseParagraphs(text) {
        const lines = text.split('\n');
        const result = [];
        let inParagraph = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') {
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
            } else if (!trimmed.match(/^[<hulol]/)) {
                if (!inParagraph) { result.push('<p>'); inParagraph = true; }
                result.push(trimmed);
            } else {
                if (inParagraph) { result.push('</p>'); inParagraph = false; }
                result.push(trimmed);
            }
        }

        if (inParagraph) result.push('</p>');
        return result.join('\n');
    }

    // Escape HTML special characters (for code blocks)
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = {
    readme: `# Project Name

> One-line description of your project.

## Features

- Feature one
- Feature two
- Feature three

## Installation

\`\`\`bash
npm install your-package
\`\`\`

## Usage

\`\`\`js
const pkg = require('your-package');
pkg.doSomething();
\`\`\`

## License

MIT © Your Name`,

    blog: `# Blog Post Title

*Published on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*

## Introduction

Write your introduction here. Hook the reader with a strong opening.

## Main Content

Explain your main idea in detail. Use examples, code snippets, or images.

\`\`\`js
// Example code block
console.log("Hello, readers!");
\`\`\`

## Conclusion

Summarise key takeaways and what the reader should do next.

---

*Tags: tag1, tag2, tag3*`,

    api: `# API Documentation

## Base URL

\`\`\`
https://api.example.com/v1
\`\`\`

## Authentication

Include \`Authorization: Bearer <token>\` in all requests.

## Endpoints

### GET /resource

Returns a list of resources.

**Response**

\`\`\`json
{
  "data": [],
  "total": 0
}
\`\`\`

### POST /resource

Create a new resource.

**Body**

\`\`\`json
{
  "name": "string",
  "value": "string"
}
\`\`\``,

    changelog: `# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- New feature A
- New feature B

### Fixed
- Bug fix description

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release
- Core functionality`,

    pr: `# Pull Request: Feature Name

## Summary

Brief description of what this PR does and why.

## Changes

- **Added**: Description of additions
- **Modified**: Description of modifications
- **Removed**: Description of removals

## Testing

- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Edge cases handled

## Screenshots

_Add screenshots if applicable._

## Related Issues

Closes #123`,
};

// ─── DOM References ────────────────────────────────────────────────────────────
const parser         = new MarkdownParser();
const markdownInput  = document.getElementById('markdownInput');
const previewOutput  = document.getElementById('previewOutput');
const downloadBtn    = document.getElementById('downloadBtn');
const themeToggle    = document.getElementById('themeToggle');
const themeIcon      = document.querySelector('.theme-icon');
const copyHtmlBtn    = document.getElementById('copyHtmlBtn');
const exportHtmlBtn  = document.getElementById('exportHtmlBtn');
const charCount      = document.getElementById('charCount');
const wordCount      = document.getElementById('wordCount');
const lineCount      = document.getElementById('lineCount');
const readTime       = document.getElementById('readTime');
const shortcutsBtn   = document.getElementById('shortcutsBtn');
const shortcutsModal = document.getElementById('shortcutsModal');
const closeModal     = document.getElementById('closeModal');
const importBtn      = document.getElementById('importBtn');
const clearBtn       = document.getElementById('clearBtn');
const fileInput      = document.getElementById('fileInput');
const toolbarBtns    = document.querySelectorAll('.toolbar-btn[data-action]');
const templateBtn    = document.getElementById('templateBtn');
const templateMenu   = document.getElementById('templateMenu');
const templateItems  = document.querySelectorAll('.template-item');
const zenBtn         = document.getElementById('zenBtn');
const appContainer   = document.getElementById('appContainer');
const syncScrollBtn  = document.getElementById('syncScrollBtn');
const findReplaceBar = document.getElementById('findReplaceBar');
const findInput      = document.getElementById('findInput');
const replaceInput   = document.getElementById('replaceInput');
const matchCount     = document.getElementById('matchCount');
const replaceOneBtn  = document.getElementById('replaceOneBtn');
const replaceAllBtn  = document.getElementById('replaceAllBtn');
const closeFindBar   = document.getElementById('closeFindBar');

// ─── State ─────────────────────────────────────────────────────────────────────
let syncScrollEnabled = true;
let zenMode = false;
let findMatches = [];
let currentMatchIndex = 0;

// ─── Core: Preview & Stats ─────────────────────────────────────────────────────

function updatePreview() {
    const markdown = markdownInput.value;
    previewOutput.innerHTML = parser.parse(markdown);
    updateStats();
}

// Update character, word, line counts and estimated read time
function updateStats() {
    const text = markdownInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));  // ~200 wpm reading speed

    charCount.textContent = `${text.length} chars`;
    wordCount.textContent = `${words} words`;
    lineCount.textContent = `${text.split('\n').length} lines`;
    readTime.textContent  = `~${mins} min read`;
}

// ─── Download / Export ─────────────────────────────────────────────────────────

function downloadMarkdown() {
    triggerDownload(markdownInput.value, 'clipboard.md', 'text/markdown');
}

function exportHtml() {
    const html = previewOutput.innerHTML;
    const full = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Exported Markdown</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.7; }
        pre  { background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        blockquote { border-left: 4px solid #667eea; padding-left: 15px; color: #666; }
        a { color: #667eea; }
        img { max-width: 100%; border-radius: 6px; }
    </style>
</head>
<body>${html}</body>
</html>`;
    triggerDownload(full, 'exported.html', 'text/html');
}

function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Copy HTML ─────────────────────────────────────────────────────────────────

function copyHtmlToClipboard() {
    navigator.clipboard.writeText(previewOutput.innerHTML).then(() => {
        const orig = copyHtmlBtn.textContent;
        copyHtmlBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyHtmlBtn.textContent = orig; }, 2000);
    });
}

// ─── Theme ─────────────────────────────────────────────────────────────────────

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '☀️';
    }
}

// ─── LocalStorage Persistence ──────────────────────────────────────────────────

function saveToLocalStorage() {
    localStorage.setItem('markdown', markdownInput.value);
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('markdown');
    if (saved) markdownInput.value = saved;
}

// ─── Toolbar Insertion ─────────────────────────────────────────────────────────

// Insert markdown syntax at cursor position, preserving selection
function insertMarkdown(action) {
    const start = markdownInput.selectionStart;
    const end   = markdownInput.selectionEnd;
    const text  = markdownInput.value;
    const sel   = text.substring(start, end);
    let insertion = '', cursorOffset = 0;

    switch (action) {
        case 'bold':       insertion = `**${sel || 'bold text'}**`;                          cursorOffset = sel ? 0 : -2;   break;
        case 'italic':     insertion = `*${sel || 'italic text'}*`;                          cursorOffset = sel ? 0 : -1;   break;
        case 'heading':    insertion = `## ${sel || 'Heading'}`;                             break;
        case 'link':       insertion = `[${sel || 'link text'}](url)`;                       cursorOffset = -5;             break;
        case 'image':      insertion = `![${sel || 'alt text'}](image-url)`;                 cursorOffset = -10;            break;
        case 'code':
            insertion = sel.includes('\n')
                ? `\`\`\`\n${sel || 'code'}\n\`\`\``
                : `\`${sel || 'code'}\``;
            cursorOffset = sel ? 0 : -1;
            break;
        case 'blockquote': insertion = `> ${sel || 'blockquote'}`;                          break;
        case 'list':       insertion = `- ${sel || 'list item'}`;                           break;
        case 'hr':         insertion = '\n---\n';                                            break;
    }

    markdownInput.value = text.substring(0, start) + insertion + text.substring(end);
    markdownInput.focus();
    const pos = start + insertion.length + cursorOffset;
    markdownInput.setSelectionRange(pos, pos);
    updatePreview();
    saveToLocalStorage();
}

// ─── Clear & Import ────────────────────────────────────────────────────────────

function clearEditor() {
    if (markdownInput.value && confirm('Clear the editor? This cannot be undone.')) {
        markdownInput.value = '';
        updatePreview();
        saveToLocalStorage();
    }
}

function importFile() { fileInput.click(); }

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            markdownInput.value = event.target.result;
            updatePreview();
            saveToLocalStorage();
        };
        reader.readAsText(file);
    }
    fileInput.value = '';
});

// ─── Template Picker ───────────────────────────────────────────────────────────

function toggleTemplateMenu() {
    const isOpen = templateMenu.classList.toggle('open');
    templateBtn.setAttribute('aria-expanded', isOpen);
}

templateItems.forEach(item => {
    item.addEventListener('click', () => {
        const key = item.dataset.template;
        if (markdownInput.value.trim() && !confirm('Replace current content with template?')) return;
        markdownInput.value = TEMPLATES[key];
        updatePreview();
        saveToLocalStorage();
        templateMenu.classList.remove('open');
    });
});

// Close template menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.template-picker')) {
        templateMenu.classList.remove('open');
    }
});

// ─── Zen Mode ──────────────────────────────────────────────────────────────────

function toggleZenMode() {
    zenMode = !zenMode;
    appContainer.classList.toggle('zen-mode', zenMode);
    document.body.classList.toggle('zen-body', zenMode);
    zenBtn.textContent = zenMode ? '✕ Exit Zen' : '🧘 Zen';
    if (zenMode) markdownInput.focus();
}

// ─── Sync Scroll ───────────────────────────────────────────────────────────────

// Mirror editor scroll position to preview panel proportionally
markdownInput.addEventListener('scroll', () => {
    if (!syncScrollEnabled) return;
    const ratio = markdownInput.scrollTop / (markdownInput.scrollHeight - markdownInput.clientHeight);
    const previewScrollable = previewOutput.parentElement;
    previewScrollable.scrollTop = ratio * (previewScrollable.scrollHeight - previewScrollable.clientHeight);
});

function toggleSyncScroll() {
    syncScrollEnabled = !syncScrollEnabled;
    syncScrollBtn.classList.toggle('active', syncScrollEnabled);
    syncScrollBtn.setAttribute('aria-pressed', syncScrollEnabled);
    syncScrollBtn.title = syncScrollEnabled ? 'Sync Scroll (on)' : 'Sync Scroll (off)';
}

// ─── Find & Replace ────────────────────────────────────────────────────────────

function openFindBar() {
    findReplaceBar.classList.add('open');
    findReplaceBar.setAttribute('aria-hidden', 'false');
    findInput.focus();
    if (findInput.value) runFind();
}

function closeFindBarFn() {
    findReplaceBar.classList.remove('open');
    findReplaceBar.setAttribute('aria-hidden', 'true');
    clearHighlights();
    findMatches = [];
}

// Highlight all matches in the textarea (read-only visual via selection cycle)
function runFind() {
    const needle = findInput.value;
    const haystack = markdownInput.value;
    findMatches = [];

    if (!needle) { matchCount.textContent = '0 matches'; return; }

    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        findMatches.push(idx);
        idx += needle.length;
    }

    matchCount.textContent = `${findMatches.length} match${findMatches.length !== 1 ? 'es' : ''}`;
    currentMatchIndex = 0;
    highlightMatch();
}

function highlightMatch() {
    if (!findMatches.length) return;
    const needle = findInput.value;
    const idx = findMatches[currentMatchIndex];
    markdownInput.focus();
    markdownInput.setSelectionRange(idx, idx + needle.length);
    matchCount.textContent = `${currentMatchIndex + 1} / ${findMatches.length}`;
}

function clearHighlights() {
    matchCount.textContent = '0 matches';
}

function replaceOne() {
    if (!findMatches.length) return;
    const needle   = findInput.value;
    const replacement = replaceInput.value;
    const idx = findMatches[currentMatchIndex];
    const text = markdownInput.value;

    markdownInput.value = text.substring(0, idx) + replacement + text.substring(idx + needle.length);
    updatePreview();
    saveToLocalStorage();
    runFind();
}

function replaceAll() {
    const needle = findInput.value;
    if (!needle) return;
    markdownInput.value = markdownInput.value.split(needle).join(replaceInput.value);
    updatePreview();
    saveToLocalStorage();
    runFind();
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function openShortcutsModal() { shortcutsModal.classList.add('active'); }
function closeShortcutsModal() { shortcutsModal.classList.remove('active'); }

// ─── Event Listeners ───────────────────────────────────────────────────────────

markdownInput.addEventListener('input', () => { updatePreview(); saveToLocalStorage(); });
downloadBtn.addEventListener('click', downloadMarkdown);
themeToggle.addEventListener('click', toggleTheme);
copyHtmlBtn.addEventListener('click', copyHtmlToClipboard);
exportHtmlBtn.addEventListener('click', exportHtml);
shortcutsBtn.addEventListener('click', openShortcutsModal);
closeModal.addEventListener('click', closeShortcutsModal);
importBtn.addEventListener('click', importFile);
clearBtn.addEventListener('click', clearEditor);
templateBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleTemplateMenu(); });
zenBtn.addEventListener('click', toggleZenMode);
syncScrollBtn.addEventListener('click', toggleSyncScroll);
closeFindBar.addEventListener('click', closeFindBarFn);
findInput.addEventListener('input', runFind);
findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        currentMatchIndex = (currentMatchIndex + 1) % (findMatches.length || 1);
        highlightMatch();
    }
});
replaceOneBtn.addEventListener('click', replaceOne);
replaceAllBtn.addEventListener('click', replaceAll);

// Toolbar buttons
toolbarBtns.forEach(btn => {
    btn.addEventListener('click', () => insertMarkdown(btn.dataset.action));
});

// Shortcuts modal backdrop click
shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) closeShortcutsModal();
});

// ─── Keyboard Shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 's') { e.preventDefault(); downloadMarkdown(); }
    if (mod && e.key === 'b') { e.preventDefault(); insertMarkdown('bold'); }
    if (mod && e.key === 'i') { e.preventDefault(); insertMarkdown('italic'); }
    if (mod && e.key === 'd') { e.preventDefault(); toggleTheme(); }
    if (mod && e.key === 'f') { e.preventDefault(); openFindBar(); }
    if (mod && e.shiftKey && e.key === 'Z') { e.preventDefault(); toggleZenMode(); }
    if (mod && e.shiftKey && e.key === 'C') { e.preventDefault(); copyHtmlToClipboard(); }
    if (mod && e.shiftKey && e.key === 'E') { e.preventDefault(); exportHtml(); }

    if (e.key === 'Escape') {
        if (zenMode) toggleZenMode();
        closeShortcutsModal();
        closeFindBarFn();
    }
});

// ─── Init ──────────────────────────────────────────────────────────────────────

loadTheme();
loadFromLocalStorage();
updatePreview();

// Set sync scroll button initial active state
syncScrollBtn.classList.add('active');
