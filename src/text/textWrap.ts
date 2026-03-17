/**
 * Wrap text into lines that fit printer width (384px).
 * Approximates character width as fontSize * 0.55 (sans-serif).
 * Cat-Printer style: wrap by space when enabled, else break anywhere.
 */

const PRINTER_WIDTH = 384;

/**
 * Approximate chars that fit in one line for a given font size.
 */
function maxCharsPerLine(fontSize: number): number {
  const charWidth = fontSize * 0.55;
  return Math.max(1, Math.floor(PRINTER_WIDTH / charWidth));
}

/**
 * Split text into lines that fit the printer width.
 * @param text - Full text (may contain \n)
 * @param fontSize - Font size in px
 * @param wrapBySpaces - If true, break at spaces when possible
 */
export function wrapTextToLines(
  text: string,
  fontSize: number,
  wrapBySpaces: boolean
): string[] {
  const maxLen = maxCharsPerLine(fontSize);
  const lines: string[] = [];

  const wrapLine = (line: string): string[] => {
    if (line.length <= maxLen) return [line];
    const result: string[] = [];
    let rest = line;
    while (rest.length > maxLen) {
      let splitAt = maxLen;
      if (wrapBySpaces) {
        const chunk = rest.slice(0, maxLen + 1);
        const lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > 0) splitAt = lastSpace;
      }
      result.push(rest.slice(0, splitAt).trim());
      rest = rest.slice(splitAt).trim();
    }
    if (rest) result.push(rest);
    return result;
  };

  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  for (const para of paragraphs) {
    lines.push(...wrapLine(para));
  }
  return lines.filter((l) => l.length > 0);
}

export { PRINTER_WIDTH as TEXT_PRINT_WIDTH };
