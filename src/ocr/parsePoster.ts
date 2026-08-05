/**
 * Turns raw OCR text blocks off a poster photo into a best-guess title, dates,
 * and lineup — no network call, no model, just position/shape heuristics.
 * Runs entirely on the ML Kit output already sitting on-device.
 */

export interface OcrBlock {
  text: string;
  /** Bounding box height in pixels, as reported by the OCR engine — a proxy for font size. */
  height: number;
  /** Vertical position of the block's top edge, in pixels from the top of the photo. */
  top: number;
}

export interface PosterGuess {
  title: string | null;
  dateRange: string | null;
  lineup: string[];
}

const DATE_RANGE_PATTERN =
  /\b(\d{1,2})(?:st|nd|rd|th)?[\s–—-]{1,3}(\d{1,2})?(?:st|nd|rd|th)?\s+(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUNE?|JULY?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\.?\s*,?\s*(\d{4})?\b/i;

const STRONG_SEPARATORS = /[•·|/]|\n/;
const COMMA_SEPARATOR = /,\s/;

/**
 * Picks the delimiter to split a block on. Bullet/slash/newline separators are
 * unambiguous, so prefer them; only fall back to commas when nothing else is
 * present, since artist names themselves can contain commas (e.g. "Tyler, The Creator").
 */
function lineupDelimiter(text: string): RegExp {
  return STRONG_SEPARATORS.test(text) ? STRONG_SEPARATORS : COMMA_SEPARATOR;
}

/** A block reads as a lineup block when it's mostly short, capitalized, delimited names. */
function looksLikeLineup(text: string): boolean {
  const parts = text
    .split(lineupDelimiter(text))
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return false;
  const capitalizedRatio =
    parts.filter((p) => /^[A-Z0-9][\w&.,''\-\s]*$/.test(p)).length / parts.length;
  return capitalizedRatio > 0.6;
}

function splitLineupNames(text: string): string[] {
  return text
    .split(lineupDelimiter(text))
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
}

export function parsePoster(blocks: OcrBlock[]): PosterGuess {
  let title: string | null = null;
  let dateRange: string | null = null;
  const lineup: string[] = [];

  const titleCandidates = blocks
    .filter((b) => b.text.trim().length > 0 && b.text.trim().length <= 40)
    .filter((b) => !DATE_RANGE_PATTERN.test(b.text))
    .filter((b) => !looksLikeLineup(b.text));

  if (titleCandidates.length > 0) {
    const tallest = titleCandidates.reduce((a, b) => (b.height > a.height ? b : a));
    title = tallest.text.trim();
  }

  for (const block of blocks) {
    if (!dateRange) {
      const match = block.text.match(DATE_RANGE_PATTERN);
      if (match) dateRange = match[0].trim();
    }
    if (looksLikeLineup(block.text)) {
      lineup.push(...splitLineupNames(block.text));
    }
  }

  return { title, dateRange, lineup: Array.from(new Set(lineup)) };
}
