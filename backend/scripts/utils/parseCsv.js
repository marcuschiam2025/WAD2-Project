// Read a CSV file into an array of rows. Handles quoted fields containing commas, quotes and newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'; // "" inside quotes is an escaped quote
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  // The last line may not end with a newline
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
