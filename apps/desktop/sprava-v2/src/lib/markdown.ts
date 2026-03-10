/**
 * Simple markdown renderer for chat messages.
 * Supports: bold, italic, strikethrough, inline code, code blocks, links.
 * No external dependencies — uses regex-based parsing.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(text: string): string {
  // Code blocks: ```...```
  let result = escapeHtml(text);

  // Multi-line code blocks
  result = result.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) =>
      `<pre class="md-code-block"><code>${code.trim()}</code></pre>`,
  );

  // Inline code: `...`
  result = result.replace(
    /`([^`\n]+)`/g,
    '<code class="md-inline-code">$1</code>',
  );

  // Bold + italic: ***...***
  result = result.replace(
    /\*\*\*(.+?)\*\*\*/g,
    "<strong><em>$1</em></strong>",
  );

  // Bold: **...** or __...__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *...* or _..._
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Strikethrough: ~~...~~
  result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  );

  // Auto-link bare URLs
  result = result.replace(
    /(?<![="'])(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  );

  // Mentions: @username
  result = result.replace(
    /(?<![&\w])@(\w+)/g,
    '<span class="md-mention" data-mention="$1">@$1</span>',
  );

  // Line breaks
  result = result.replace(/\n/g, "<br>");

  return result;
}
