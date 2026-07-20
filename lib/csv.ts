export type CsvRow = Record<string, string>;

function detectSeparator(firstLine: string): "," | ";" {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseLine(line: string, separator: "," | ";"): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === separator && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(content: string): CsvRow[] {
  const normalized = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  const lines: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      current += char;
      if (quoted && next === '"') {
        current += next;
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "\n" && !quoted) {
      if (current.trim()) lines.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) lines.push(current);
  if (lines.length < 2) return [];

  const separator = detectSeparator(lines[0]);
  const headers = parseLine(lines[0], separator).map((header) =>
    header
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_"),
  );

  return lines.slice(1).map((line) => {
    const values = parseLine(line, separator);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
    );
  });
}
