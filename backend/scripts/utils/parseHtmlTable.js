// Reads the first table of an HTML page into an array of rows (each row an array of cell texts).
// BOSS "Excel" exports (.xls) are really HTML tables like this, and their rows leave out </tr> and </td>.

// The HTML entities BOSS uses, plus the common ones
const ENTITIES = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&#039;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
};

function cellText(html) {
  let text = html.replace(/<[^>]+>/g, ''); // drop any tags inside the cell
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function parseHtmlTable(html) {
  const rows = [];

  // Everything after each <tr> is one row
  const rowChunks = html.split(/<tr[^>]*>/i).slice(1);
  for (const chunk of rowChunks) {
    const cells = [];
    // A cell runs from its <td> or <th> to the next cell, the end of the row, or the end of the text
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)(?=<t[dh][\s>]|<\/tr|<\/table|$)/gi;
    for (const match of chunk.matchAll(cellPattern)) {
      cells.push(cellText(match[1].replace(/<\/t[dh]>/gi, '')));
    }
    rows.push(cells);
  }
  return rows;
}
