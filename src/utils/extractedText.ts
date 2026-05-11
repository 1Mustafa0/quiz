const NOTEBOOKLM_NOISE = /\bA\s+NotebookLM\b/gi;
const SECTION_MARKER = /^(Slide(?:\s+image)?|Page|Image|Sheet|Table|Row)\s+(\d+)(?:\s*\(([^)]*)\))?:\s*(.*)$/i;
const NAMED_SECTION_MARKER = /^(File|Document|Worksheet|Text|Code):\s*(.*)$/i;
const DECORATIVE_CHARS = /[|=~_]{2,}|[©®™]/g;
const BULLET_CHARS = /[\u2022\u25cf\u25cb\u25aa\u25ab]/g;

const normalizeToken = (token: string) =>
  token
    .toLowerCase()
    .replace(/^[^\w\u0600-\u06ff]+|[^\w\u0600-\u06ff]+$/g, '');

const phrasesEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((token, index) => normalizeToken(token) === normalizeToken(right[index]));

const removeAdjacentDuplicatePhrases = (line: string) => {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return line;

  const output: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    let foundDuplicate = false;
    const maxPhraseSize = Math.min(8, Math.floor((tokens.length - index) / 2));

    for (let size = maxPhraseSize; size >= 1; size -= 1) {
      const phrase = tokens.slice(index, index + size);
      const nextPhrase = tokens.slice(index + size, index + size * 2);

      if (!phrasesEqual(phrase, nextPhrase)) continue;

      output.push(...phrase);
      index += size * 2;

      while (index + size <= tokens.length && phrasesEqual(phrase, tokens.slice(index, index + size))) {
        index += size;
      }

      foundDuplicate = true;
      break;
    }

    if (!foundDuplicate) {
      output.push(tokens[index]);
      index += 1;
    }
  }

  return output.join(' ');
};

const cleanLine = (line: string) =>
  removeAdjacentDuplicatePhrases(
    line
      .replace(DECORATIVE_CHARS, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
  );

const pushBlank = (lines: string[]) => {
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('');
  }
};

const pushLine = (lines: string[], line: string) => {
  const cleaned = cleanLine(line);
  if (!cleaned) return;

  const previous = [...lines].reverse().find(Boolean);
  if (previous && normalizeToken(previous) === normalizeToken(cleaned)) return;

  lines.push(cleaned);
};

export const formatExtractedTextPreview = (value: string) => {
  if (!value.trim()) return '';

  const prepared = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(NOTEBOOKLM_NOISE, '\n')
    .replace(BULLET_CHARS, '\n- ')
    .replace(/\s*(Slide\s+image\s+\d+\s*\([^)]+\)\s*:)\s*/gi, '\n\n$1\n')
    .replace(/\s*((?:Slide|Page|Image|Sheet|Table|Row)\s+\d+\s*:)\s*/gi, '\n\n$1\n')
    .replace(/\s+[\u00ab\u00bb]\s*/g, '\n- ')
    .replace(/\s+([+*])\s+(?=[A-Za-z\u0600-\u06ff])/g, '\n- ')
    .replace(/\s+o\s+(?=[A-Za-z\u0600-\u06ff])/g, '\n  - ');

  const lines: string[] = [];

  prepared.split('\n').forEach((rawLine) => {
    const line = cleanLine(rawLine);
    if (!line) return;

    const section = line.match(SECTION_MARKER);
    if (section) {
      pushBlank(lines);
      const [, type, number, sourceName, rest] = section;
      const normalizedType = type.toLowerCase().startsWith('slide') ? 'Slide' : type;
      const source = sourceName ? ` (${sourceName})` : '';
      lines.push(`${normalizedType} ${number}${source}`);
      if (rest) pushLine(lines, rest);
      return;
    }

    const namedSection = line.match(NAMED_SECTION_MARKER);
    if (namedSection) {
      pushBlank(lines);
      lines.push(`${namedSection[1]}: ${namedSection[2]}`.trim());
      return;
    }

    if (/^[-+*]\s+/.test(line)) {
      pushLine(lines, `- ${line.replace(/^[-+*]\s+/, '')}`);
      return;
    }

    pushLine(lines, line);
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
