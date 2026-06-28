// Minimal but robust Markdown-to-HTML converter.
// Handles tables, nested lists, code blocks, and all common formatting.

export function md2html(md: string): string {
  // 1. Strip YAML frontmatter
  let html = md.replace(/^---[\s\S]*?---\n*/, "");

  // 2. Escape HTML entities (save code blocks first)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(`<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK${codeBlocks.length - 1}%%`;
  });
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `%%INLINECODE${inlineCodes.length - 1}%%`;
  });

  // Escape remaining HTML
  html = escapeHtml(html);

  // Restore code
  html = html.replace(/%%CODEBLOCK(\d+)%%/g, (_, i) => codeBlocks[+i]);
  html = html.replace(/%%INLINECODE(\d+)%%/g, (_, i) => inlineCodes[+i]);

  const lines = html.split("\n");
  const out: string[] = [];

  let inTable = false;
  let inList: string | null = null; // "ul" or "ol"
  let inBlockquote = false;
  let listStack: string[] = [];

  function closeList() {
    while (listStack.length > 0) {
      out.push(`</${listStack.pop()}>`);
    }
    inList = null;
  }

  function closeBlockquote() {
    if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }
  }

  function closeTable() {
    if (inTable) { out.push("</tbody></table>"); inTable = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Inline formatting (must be done per line)
    line = applyInline(line);

    // Blank line
    if (/^\s*$/.test(line)) {
      closeBlockquote();
      closeList();
      closeTable();
      continue;
    }

    // Table row
    if (/^\|.*\|$/.test(line) && !inList && !inBlockquote) {
      if (line.includes("---") && line.includes("|")) {
        // Separator row — skip, but this also indicates table start
        if (!inTable) {
          closeBlockquote(); closeList();
          out.push("<table><thead>");
          inTable = true;
        }
        // Convert previous thead row to actual thead
        const lastIdx = out.length - 1;
        if (lastIdx >= 0 && out[lastIdx].startsWith("<tr>")) {
          out[lastIdx] = out[lastIdx].replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>");
          out.push("</thead><tbody>");
        }
        continue;
      }
      const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
      const tag = inTable && out.includes("</thead><tbody>") ? "td" : "td";
      if (!inTable) {
        closeBlockquote(); closeList();
        out.push("<table><thead>");
        inTable = true;
      }
      out.push("<tr>" + cells.map(c => `<${tag}>${c}</${tag}>`).join("") + "</tr>");
      continue;
    } else {
      closeTable();
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true; }
      // Remove only the leading "> " (not inner ones)
      const content = line.replace(/^>\s?/, "");
      out.push(applyInline(content));
      continue;
    } else {
      closeBlockquote();
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      out.push("<hr>");
      continue;
    }

    // Header
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      out.push(`<h${level}>${hMatch[2]}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      closeBlockquote();
      const indent = ulMatch[1].length;
      const depth = Math.floor(indent / 2) + 1;
      // Adjust list stack
      while (listStack.length > depth) {
        out.push(`</${listStack.pop()}>`);
      }
      while (listStack.length < depth) {
        const t = "ul";
        out.push(`<${t}>`);
        listStack.push(t);
      }
      inList = "ul";
      out.push(`<li>${ulMatch[2]}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      closeBlockquote();
      const indent = olMatch[1].length;
      const depth = Math.floor(indent / 2) + 1;
      while (listStack.length > depth) {
        out.push(`</${listStack.pop()}>`);
      }
      while (listStack.length < depth) {
        const t = "ol";
        out.push(`<${t}>`);
        listStack.push(t);
      }
      inList = "ol";
      out.push(`<li>${olMatch[2]}</li>`);
      continue;
    }

    // Non-list, non-special: close any open list
    closeList();

    // Regular paragraph
    out.push(line);
  }

  closeList();
  closeBlockquote();
  closeTable();

  // Wrap in paragraphs: join lines and split on double newlines
  let result = out.join("\n");
  result = result.replace(/\n\n+/g, "</p><p>");
  result = "<p>" + result + "</p>";

  // Clean empty paragraphs
  result = result.replace(/<p>\s*<\/p>/g, "");
  // Don't wrap block elements in <p>
  result = result.replace(/<p>(<(?:h[1-6]|table|blockquote|hr|pre|ul|ol)[\s>])/g, "$1");
  result = result.replace(/(<\/(?:table|blockquote|pre|ul|ol)>)\s*<\/p>/g, "$1");

  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyInline(line: string): string {
  // Bold-italic ***...***
  line = line.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold **...**
  line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic *...*
  line = line.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Images ![alt](url)
  line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  // Links [text](url)
  line = line.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return line;
}
