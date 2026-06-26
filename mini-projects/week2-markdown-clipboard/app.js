// Markdown parser class - converts Markdown to HTML
class MarkdownParser {
    parse(markdown) {
        let html = markdown;

        html = this.parseHeaders(html);
        html = this.parseCodeBlocks(html);
        html = this.parseInlineCode(html);
        html = this.parseBoldItalic(html);
        html = this.parseLinks(html);
        html = this.parseImages(html);
        html = this.parseLists(html);
        html = this.parseBlockquotes(html);
        html = this.parseHorizontalRules(html);
        html = this.parseParagraphs(html);

        return html;
    }

    // Parse headers (# to ######)
    parseHeaders(text) {
        return text.replace(/^#{1,6}\s+(.+)$/gm, (match, content, offset, string) => {
            const level = match.match(/^#+/)[0].length;
            return `<h${level}>${content}</h${level}>`;
        });
    }

    // Parse code blocks (```code```)
    parseCodeBlocks(text) {
        return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
        });
    }

    // Parse inline code (`code`)
    parseInlineCode(text) {
        return text.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    // Parse bold (**text**) and italic (*text*)
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
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    // Parse images ![alt](url)
    parseImages(text) {
        return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    }

    // Parse unordered (-) and ordered (1.) lists
    parseLists(text) {
        const lines = text.split('\n');
        let result = [];
        let inUl = false;
        let inOl = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const ulMatch = line.match(/^[\*\-]\s+(.+)$/);
            const olMatch = line.match(/^\d+\.\s+(.+)$/);

            if (ulMatch) {
                if (!inUl) {
                    if (inOl) {
                        result.push('</ol>');
                        inOl = false;
                    }
                    result.push('<ul>');
                    inUl = true;
                }
                result.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (!inOl) {
                    if (inUl) {
                        result.push('</ul>');
                        inUl = false;
                    }
                    result.push('<ol>');
                    inOl = true;
                }
                result.push(`<li>${olMatch[1]}</li>`);
            } else {
                if (inUl) {
                    result.push('</ul>');
                    inUl = false;
                }
                if (inOl) {
                    result.push('</ol>');
                    inOl = false;
                }
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
        let result = [];
        let inBlockquote = false;

        for (let line of lines) {
            if (line.startsWith('> ')) {
                if (!inBlockquote) {
                    result.push('<blockquote>');
                    inBlockquote = true;
                }
                result.push(line.substring(2));
            } else {
                if (inBlockquote) {
                    result.push('</blockquote>');
                    inBlockquote = false;
                }
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

    // Wrap remaining text in paragraphs
    parseParagraphs(text) {
        const lines = text.split('\n');
        let result = [];
        let inParagraph = false;

        for (let line of lines) {
            const trimmed = line.trim();
            
            if (trimmed === '') {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
            } else if (!trimmed.match(/^[<hulol]/)) {
                if (!inParagraph) {
                    result.push('<p>');
                    inParagraph = true;
                }
                result.push(trimmed);
            } else {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(trimmed);
            }
        }

        if (inParagraph) result.push('</p>');

        return result.join('\n');
    }

    // Escape HTML special characters
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize parser and DOM elements
const parser = new MarkdownParser();
const markdownInput = document.getElementById('markdownInput');
const previewOutput = document.getElementById('previewOutput');
const downloadBtn = document.getElementById('downloadBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-icon');
const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const exportHtmlBtn = document.getElementById('exportHtmlBtn');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lineCount = document.getElementById('lineCount');
const shortcutsBtn = document.getElementById('shortcutsBtn');
const shortcutsModal = document.getElementById('shortcutsModal');
const closeModal = document.getElementById('closeModal');
const importBtn = document.getElementById('importBtn');
const clearBtn = document.getElementById('clearBtn');
const fileInput = document.getElementById('fileInput');

// Update preview on input
function updatePreview() {
    const markdown = markdownInput.value;
    const html = parser.parse(markdown);
    previewOutput.innerHTML = html;
    updateStats();
}

// Update character, word, and line counts
function updateStats() {
    const text = markdownInput.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    
    charCount.textContent = `${chars} chars`;
    wordCount.textContent = `${words} words`;
    lineCount.textContent = `${lines} lines`;
}

// Download markdown as .md file
function downloadMarkdown() {
    const markdown = markdownInput.value;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clipboard.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Toggle dark/light mode
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '☀️';
    }
}

// Save markdown to localStorage
function saveToLocalStorage() {
    localStorage.setItem('markdown', markdownInput.value);
}

// Load markdown from localStorage
function loadFromLocalStorage() {
    const savedMarkdown = localStorage.getItem('markdown');
    if (savedMarkdown) {
        markdownInput.value = savedMarkdown;
    }
}

// Modal functions
function openShortcutsModal() {
    shortcutsModal.classList.add('active');
}

function closeShortcutsModal() {
    shortcutsModal.classList.remove('active');
}

// Clear editor
function clearEditor() {
    if (markdownInput.value && confirm('Are you sure you want to clear the editor?')) {
        markdownInput.value = '';
        updatePreview();
        updateStats();
        saveToLocalStorage();
    }
}

// Import file
function importFile() {
    fileInput.click();
}

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            markdownInput.value = event.target.result;
            updatePreview();
            updateStats();
            saveToLocalStorage();
        };
        reader.readAsText(file);
    }
    fileInput.value = '';
});

// Copy HTML to clipboard
function copyHtmlToClipboard() {
    const html = previewOutput.innerHTML;
    navigator.clipboard.writeText(html).then(() => {
        const originalText = copyHtmlBtn.textContent;
        copyHtmlBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyHtmlBtn.textContent = originalText;
        }, 2000);
    });
}

// Export as HTML file
function exportHtml() {
    const html = previewOutput.innerHTML;
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Markdown</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
        blockquote { border-left: 4px solid #667eea; padding-left: 15px; color: #666; }
    </style>
</head>
<body>
${html}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Event listeners
markdownInput.addEventListener('input', () => {
    updatePreview();
    saveToLocalStorage();
});
downloadBtn.addEventListener('click', downloadMarkdown);
themeToggle.addEventListener('click', toggleTheme);
copyHtmlBtn.addEventListener('click', copyHtmlToClipboard);
exportHtmlBtn.addEventListener('click', exportHtml);
shortcutsBtn.addEventListener('click', openShortcutsModal);
closeModal.addEventListener('click', closeShortcutsModal);
importBtn.addEventListener('click', importFile);
clearBtn.addEventListener('click', clearEditor);

// Initial render
loadTheme();
loadFromLocalStorage();
updatePreview();
updateStats();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S: Download markdown
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        downloadMarkdown();
    }
    
    // Ctrl/Cmd + Shift + C: Copy HTML
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copyHtmlToClipboard();
    }
    
    // Ctrl/Cmd + Shift + E: Export HTML
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        exportHtml();
    }
    
    // Ctrl/Cmd + D: Toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
    }
    
    // Ctrl/Cmd + I: Import file
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        importFile();
    }
    
    // Escape: Close modal
    if (e.key === 'Escape') {
        shortcutsModal.classList.remove('active');
    }
});

// Close modal when clicking outside
shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) {
        closeShortcutsModal();
    }
});
