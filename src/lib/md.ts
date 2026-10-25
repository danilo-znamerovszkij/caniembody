// ponytail: tiny Markdown subset for glossary bodies (paragraphs, lists, links, **bold**, *em*, `code`, > quotes).
// Swap for a real parser if entries ever need tables or nested lists.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/)[^)\s]+)\)/g, '<a href="$2">$1</a>');

export function md(src: string) {
  return src.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
    if (lines.every((l) => /^\s*\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\. /, ''))}</li>`).join('')}</ol>`;
    if (lines.every((l) => l.startsWith('>'))) return `<blockquote>${inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))}</blockquote>`;
    return `<p>${inline(lines.join(' '))}</p>`;
  }).join('\n');
}

// self-check: node src/lib/md.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = md('A **b** *c* `d` [e](/policy/act) <x>\n\n- one\n- two');
  console.assert(out.includes('<strong>b</strong>') && out.includes('<em>c</em>') && out.includes('<a href="/policy/act">e</a>') && out.includes('&lt;x&gt;') && out.includes('<ul><li>one</li>'), out);
  console.assert(!md('[x](javascript:alert(1))').includes('href'), 'blocks non-https links');
  console.log('md ok');
}
