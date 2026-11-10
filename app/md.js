// Tiny Markdown -> HTML renderer for the write-ups (headings, lists, code, bold, links, simple tables).
// Input is escaped first, so even a malicious doc cannot inject HTML.
window.renderMarkdown = function (src) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`</${list}>`); list = null; };
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushPara(); flushList();
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (line.trim().startsWith("|")) {
      flushPara(); flushList();
      const rows = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(lines[i]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const body = rows.filter((r) => !/^\s*\|[\s|:-]+\|\s*$/.test(r)).map(cells);
      out.push("<table>" + body.map((r, k) => "<tr>" + r.map((c) => (k ? `<td>${c}</td>` : `<th>${c}</th>`)).join("") + "</tr>").join("") + "</table>");
      continue;
    }
    const h = line.match(/^(#{1,3}) (.*)/);
    const li = line.match(/^\s*(?:[-*]|(\d+)\.) (.*)/);
    if (h) { flushPara(); flushList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (li) {
      flushPara();
      const kind = li[1] ? "ol" : "ul";
      if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(li[2])}</li>`);
    } else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return out.join("\n");
};
