// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Self-contained pseudolocalization utility.
 *
 * Pseudolocalization takes source text and produces a "fake translation" that:
 *  - accents Latin characters so untranslated strings stand out,
 *  - pads the string with extra characters to simulate the length growth of a
 *    real translation (used by the layout-stability analyzer to detect overflow),
 *  - wraps the result in delimiters (`[` … `]`),
 *  - leaves interpolation tokens (e.g. `{{name}}`, `<b>`) untouched.
 *
 * Padding is deterministic per input string so repeated runs on the same text
 * produce identical output.
 */

export interface PseudolocalizeOptions {
  prepend: string;
  append: string;
  delimiter?: string | string[];
  startDelimiter: string | string[];
  endDelimiter: string | string[];
  extend: number;
  override?: string;
}

export interface PseudolocalizeConfiguration {
  Options: PseudolocalizeOptions;
  dummyData: { division: string };
  pad: number;
  startRange: number;
  endRange: number;
}

export const defaultConfigurationJSON: PseudolocalizeConfiguration = {
  Options: {
    prepend: '[',
    append: ']',
    startDelimiter: ['{{', '<'],
    endDelimiter: ['}}', '>'],
    extend: 0,
  },
  dummyData: {
    division: '～',
  },
  pad: 0.3,
  startRange: 0x4e00,
  endRange: 0x9fff,
};

/** Maps ASCII letters to visually similar accented characters. */
const charactersMapping: Record<string, string> = {
  A: 'À',
  a: 'à',
  B: 'ß',
  b: 'ƀ',
  C: 'Ć',
  c: 'ć',
  D: 'Ď',
  d: 'ď',
  E: 'Ē',
  e: 'ē',
  F: 'Ɓ',
  f: 'ƒ',
  G: 'Ĝ',
  g: 'ĝ',
  H: 'Ĥ',
  h: 'ĥ',
  I: 'Ĩ',
  i: 'ĩ',
  J: 'Ĵ',
  j: 'ĵ',
  K: 'Ķ',
  k: 'ķ',
  L: 'Ĺ',
  l: 'ĺ',
  N: 'Ń',
  n: 'ń',
  O: 'Ō',
  o: 'ō',
  P: 'Ƥ',
  p: 'ƥ',
  Q: 'Ǫ',
  q: 'ǫ',
  R: 'Ŕ',
  r: 'ŕ',
  S: 'Ś',
  s: 'ś',
  T: 'Ţ',
  t: 'ţ',
  U: 'Ũ',
  u: 'ũ',
  W: 'Ŵ',
  w: 'ŵ',
  Y: 'Ŷ',
  y: 'ŷ',
  Z: 'Ź',
  z: 'ź',
};

function escapeRegExp(value: string): string {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Builds a regex that matches delimiter-wrapped tokens (e.g. `{{name}}`, `<b>`)
 * so they can be preserved verbatim during character mapping.
 */
function getDelimiterRegExp(
  startDelimiter: string | string[],
  endDelimiter: string | string[],
  delimiter: string | string[] | undefined,
): RegExp {
  const startDelimiters = Array.isArray(startDelimiter) ? startDelimiter : [startDelimiter];
  const endDelimiters = Array.isArray(endDelimiter) ? endDelimiter : [endDelimiter];
  const delimiters = Array.isArray(delimiter) ? delimiter : [delimiter];

  const patterns: string[] = [];

  const maxLength = Math.max(startDelimiters.length, endDelimiters.length);
  for (let i = 0; i < maxLength; i++) {
    const start = startDelimiters[i];
    const end = endDelimiters[i];
    if (start && end && start !== '' && end !== '') {
      patterns.push(`${escapeRegExp(start)}.*?${escapeRegExp(end)}`);
    }
  }

  for (const delim of delimiters) {
    if (delim && delim !== '') {
      const escaped = escapeRegExp(delim);
      patterns.push(`${escaped}.*?${escaped}`);
    }
  }

  if (patterns.length === 0) {
    return /(?!)/g; // never matches
  }

  return new RegExp(patterns.join('|'), 'g');
}

function getTokens(
  input: string,
  startDelimiter: string | string[],
  endDelimiter: string | string[],
  delimiter: string | string[] | undefined,
): RegExpExecArray[] {
  const regExp = getDelimiterRegExp(startDelimiter, endDelimiter, delimiter);
  const results: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = regExp.exec(input))) {
    results.push(match);
  }
  return results;
}

/** Extends the width of the string by the given percentage, split across both sides. */
function widthPad(input: string, percent: number): string {
  let lengthLeft = Math.floor((input.length * percent) / 2);
  let lengthRight = lengthLeft;
  let padded = input;
  while (lengthLeft-- > 0) {
    padded = ` ${padded}`;
  }
  while (lengthRight-- > 0) {
    padded = `${padded} `;
  }
  return padded;
}

/**
 * Applies character mapping to `input` while preserving delimiter tokens, then
 * wraps the result with the configured prepend/append markers.
 */
function transform(input: string, options: PseudolocalizeOptions): string {
  const { startDelimiter, endDelimiter, delimiter, prepend, append, extend, override } = options;

  const tokens = getTokens(input, startDelimiter, endDelimiter, delimiter);

  let tokenIdx = 0;
  let result = '';
  while (result.length < input.length) {
    const token = tokens[tokenIdx];
    if (token && token.index === result.length) {
      result += token[0];
      tokenIdx++;
      continue;
    }
    const character = override || input[result.length];
    result += charactersMapping[character] || character;
  }

  return prepend + widthPad(result, extend) + append;
}

/**
 * Small deterministic PRNG (mulberry32) seeded from a string, so a given input
 * always yields the same padding characters.
 */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntInclusive(random: () => number, min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(random() * (hi - lo + 1) + lo);
}

/**
 * Pads the string with deterministic pseudo-random characters drawn from the
 * configured Unicode range, growing the length by `configuration.pad`.
 */
function lengthPad(input: string, configuration: PseudolocalizeConfiguration): string {
  const random = seededRandom(input);
  let additionalLength = Math.ceil(input.length * (configuration.pad ?? 0));
  let output = input;
  while (additionalLength-- > 0) {
    const codePoint = randomIntInclusive(
      random,
      configuration.startRange ?? 97,
      configuration.endRange ?? 97,
    );
    output += String.fromCharCode(codePoint);
  }
  return output;
}

/**
 * Pseudolocalizes a string: pads it to simulate translation growth, then applies
 * character mapping and delimiters.
 */
export function pseudolocalize(
  inputText: string,
  configuration: PseudolocalizeConfiguration = defaultConfigurationJSON,
): string {
  const padded = lengthPad(inputText, configuration);
  return transform(padded, configuration.Options);
}
