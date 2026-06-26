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

// Update preview on input
function updatePreview() {
    const markdown = markdownInput.value;
    const html = parser.parse(markdown);
    previewOutput.innerHTML = html;
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

// Event listeners
markdownInput.addEventListener('input', updatePreview);
downloadBtn.addEventListener('click', downloadMarkdown);

// Initial render
updatePreview();
