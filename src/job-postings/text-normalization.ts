const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      // U+00A0 (what &#xa0; / &nbsp; mean) would survive as an invisible,
      // non-collapsing character — normalize it to an ordinary space.
      if (codePoint === 0xa0) return ' ';
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Turns a posting description into plain lines of text for the
 * deterministic extractors and filters. Sources disagree on what
 * "description" is: Ashby/Lever give plain text; SmartRecruiters gives real
 * HTML; Greenhouse gives *entity-encoded* HTML (`&lt;li&gt;…&lt;/li&gt;`),
 * so the first decode pass turns encoded tags back into tags and the tag
 * pass then removes them. Ingest stores the result as the Job Posting's
 * description (the SourcePosting keeps the raw markup); the extractor and
 * hard filters still call this too, so rows ingested before that change
 * behave the same until they are re-extracted.
 */
export function htmlToPlainText(input: string): string {
  const withTags = decodeEntities(input);

  const withBreaks = withTags
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|li|div|ul|ol|h[1-6]|tr|section)\s*>/gi, '\n');

  // Requires a letter right after "<" so ordinary text like "x < 5" or
  // "<3" isn't mistaken for a tag.
  const withoutTags = withBreaks.replace(/<\/?[a-zA-Z][^>]*>/g, '');

  return decodeEntities(withoutTags)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0))
    .join('\n')
    .trim();
}
