// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { francAll } from 'franc-min';

/**
 * Map from ISO 639-3 codes (used by franc) to ISO 639-1 codes (used in HTML `lang` attributes).
 * Covers the most commonly localized languages. Extended as needed.
 */
const ISO_639_3_TO_1: Record<string, string> = {
  afr: 'af',
  amh: 'am',
  ara: 'ar',
  aze: 'az',
  bel: 'be',
  ben: 'bn',
  bos: 'bs',
  bul: 'bg',
  cat: 'ca',
  ceb: 'ceb',
  ces: 'cs',
  cmn: 'zh',
  dan: 'da',
  deu: 'de',
  ell: 'el',
  eng: 'en',
  est: 'et',
  eus: 'eu',
  fas: 'fa',
  fin: 'fi',
  fra: 'fr',
  gle: 'ga',
  glg: 'gl',
  guj: 'gu',
  hat: 'ht',
  hau: 'ha',
  heb: 'he',
  hin: 'hi',
  hrv: 'hr',
  hun: 'hu',
  hye: 'hy',
  ibo: 'ig',
  ind: 'id',
  isl: 'is',
  ita: 'it',
  jav: 'jv',
  jpn: 'ja',
  kan: 'kn',
  kat: 'ka',
  kaz: 'kk',
  khm: 'km',
  kin: 'rw',
  kor: 'ko',
  kur: 'ku',
  lao: 'lo',
  lat: 'la',
  lav: 'lv',
  lit: 'lt',
  ltz: 'lb',
  mal: 'ml',
  mar: 'mr',
  mkd: 'mk',
  mlg: 'mg',
  mlt: 'mt',
  mon: 'mn',
  mri: 'mi',
  msa: 'ms',
  mya: 'my',
  nep: 'ne',
  nld: 'nl',
  nob: 'nb',
  nor: 'no',
  nya: 'ny',
  pan: 'pa',
  pol: 'pl',
  por: 'pt',
  pus: 'ps',
  ron: 'ro',
  rus: 'ru',
  sin: 'si',
  slk: 'sk',
  slv: 'sl',
  sna: 'sn',
  som: 'so',
  spa: 'es',
  sqi: 'sq',
  srp: 'sr',
  sun: 'su',
  swa: 'sw',
  swe: 'sv',
  tam: 'ta',
  tel: 'te',
  tgl: 'tl',
  tha: 'th',
  tur: 'tr',
  ukr: 'uk',
  urd: 'ur',
  uzb: 'uz',
  vie: 'vi',
  yor: 'yo',
  zho: 'zh',
  zul: 'zu',
};

/**
 * Map from ISO 639-1 to a set of related language codes.
 * Used to avoid flagging closely-related languages (e.g., 'nb'/'nn'/'no' are all Norwegian).
 */
const LANGUAGE_FAMILIES: Record<string, string[]> = {
  zh: ['zh', 'cmn', 'yue', 'wuu', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-Hans', 'zh-Hant'],
  no: ['no', 'nb', 'nn'],
  nb: ['no', 'nb', 'nn'],
  nn: ['no', 'nb', 'nn'],
  sr: ['sr', 'hr', 'bs'], // Serbian/Croatian/Bosnian mutual intelligibility
  hr: ['sr', 'hr', 'bs'],
  bs: ['sr', 'hr', 'bs'],
  en: ['en', 'sco'], // Scots and English are closely related; franc often conflates them
  sco: ['en', 'sco'],
};

export interface DetectionResult {
  /** Detected ISO 639-1 language code, or 'und' if undetermined */
  lang: string;
  /** Confidence score 0–1 (1 = highest) */
  confidence: number;
  /** Second-best ISO 639-1 language code (for top-2 consensus checks), or 'und' */
  secondLang: string;
}

/**
 * Detects the language of a text string using franc trigram analysis.
 *
 * @param text - The text to analyze
 * @param minLength - Minimum text length for detection (default: 10)
 * @returns Detection result with ISO 639-1 code and confidence
 */
export function detectLanguage(text: string, minLength = 10): DetectionResult {
  if (text.length < minLength) {
    return { lang: 'und', confidence: 0, secondLang: 'und' };
  }

  const results = francAll(text, { minLength });
  if (results.length === 0 || results[0][0] === 'und') {
    return { lang: 'und', confidence: 0, secondLang: 'und' };
  }

  const [topCode] = results[0];
  const iso1 = ISO_639_3_TO_1[topCode] ?? topCode;

  // Second-best language (skipping same-family members)
  let secondLang = 'und';
  for (let i = 1; i < results.length; i++) {
    const code = ISO_639_3_TO_1[results[i][0]] ?? results[i][0];
    const family = LANGUAGE_FAMILIES[iso1];
    const isSameFamily =
      code === iso1 ||
      (family && family.includes(code)) ||
      (LANGUAGE_FAMILIES[code] && LANGUAGE_FAMILIES[code].includes(iso1));
    if (!isSameFamily) {
      secondLang = code;
      break;
    }
  }

  // franc returns similarity scores where the best match is always 1.0.
  // Confidence is derived from the margin between the best and the first
  // result that is NOT in the same language family. This prevents closely
  // related languages (e.g., eng/sco, nor/nob) from suppressing confidence.
  const topFamily = LANGUAGE_FAMILIES[iso1];
  let competitorScore = 0;
  for (let i = 1; i < results.length; i++) {
    const competitorCode = ISO_639_3_TO_1[results[i][0]] ?? results[i][0];
    const isSameFamily =
      competitorCode === iso1 ||
      (topFamily && topFamily.includes(competitorCode)) ||
      (LANGUAGE_FAMILIES[competitorCode] && LANGUAGE_FAMILIES[competitorCode].includes(iso1));
    if (!isSameFamily) {
      competitorScore = results[i][1];
      break;
    }
  }
  const confidence = Math.max(0, 1 - competitorScore);

  return { lang: iso1, confidence, secondLang };
}

/**
 * Normalizes an HTML `lang` attribute value to a base language code.
 * Strips region/script subtags: `en-US` → `en`, `zh-Hans` → `zh`, `pt-BR` → `pt`.
 */
export function normalizeLanguageCode(lang: string): string {
  if (!lang) return '';
  // Take only the primary language subtag (before first '-')
  return lang.toLowerCase().split('-')[0];
}

/**
 * Checks whether two language codes are compatible (same language family).
 *
 * @param declared - The language declared in the HTML `lang` attribute (e.g., 'en', 'zh-CN')
 * @param detected - The language detected by franc (ISO 639-1, e.g., 'en', 'zh')
 * @returns true if the languages match or are in the same family
 */
export function isLanguageMatch(declared: string, detected: string): boolean {
  if (detected === 'und') return true; // Can't determine → don't flag

  const normDeclared = normalizeLanguageCode(declared);
  const normDetected = normalizeLanguageCode(detected);

  // Exact match
  if (normDeclared === normDetected) return true;

  // Check language family (e.g., 'no'/'nb'/'nn' are all Norwegian)
  const declaredFamily = LANGUAGE_FAMILIES[normDeclared];
  if (declaredFamily && declaredFamily.includes(normDetected)) return true;

  const detectedFamily = LANGUAGE_FAMILIES[normDetected];
  if (detectedFamily && detectedFamily.includes(normDeclared)) return true;

  return false;
}

/**
 * Map of languages to their primary writing script.
 * Used to determine if two languages share the same script,
 * which makes franc trigram detection less reliable for short text.
 */
const LANGUAGE_SCRIPTS: Record<string, string> = {
  // Latin script
  en: 'latin',
  fr: 'latin',
  de: 'latin',
  es: 'latin',
  pt: 'latin',
  it: 'latin',
  nl: 'latin',
  da: 'latin',
  sv: 'latin',
  no: 'latin',
  nb: 'latin',
  nn: 'latin',
  fi: 'latin',
  pl: 'latin',
  cs: 'latin',
  sk: 'latin',
  ro: 'latin',
  hu: 'latin',
  hr: 'latin',
  bs: 'latin',
  sl: 'latin',
  et: 'latin',
  lv: 'latin',
  lt: 'latin',
  tr: 'latin',
  az: 'latin',
  sq: 'latin',
  eu: 'latin',
  ca: 'latin',
  gl: 'latin',
  id: 'latin',
  ms: 'latin',
  tl: 'latin',
  vi: 'latin',
  sw: 'latin',
  ha: 'latin',
  yo: 'latin',
  ig: 'latin',
  zu: 'latin',
  af: 'latin',
  mt: 'latin',
  lb: 'latin',
  is: 'latin',
  ga: 'latin',
  la: 'latin',
  ht: 'latin',
  jv: 'latin',
  su: 'latin',
  mi: 'latin',
  sco: 'latin',
  ceb: 'latin',
  mg: 'latin',
  ny: 'latin',
  sn: 'latin',
  so: 'latin',
  rw: 'latin',
  uz: 'latin',
  // Cyrillic
  ru: 'cyrillic',
  uk: 'cyrillic',
  bg: 'cyrillic',
  sr: 'cyrillic',
  mk: 'cyrillic',
  be: 'cyrillic',
  kk: 'cyrillic',
  mn: 'cyrillic',
  // Arabic
  ar: 'arabic',
  fa: 'arabic',
  ur: 'arabic',
  ps: 'arabic',
  ku: 'arabic',
  // CJK
  zh: 'cjk',
  ja: 'cjk-ja',
  ko: 'cjk-ko',
  // Devanagari
  hi: 'devanagari',
  mr: 'devanagari',
  ne: 'devanagari',
  // Other scripts
  el: 'greek',
  ka: 'georgian',
  hy: 'armenian',
  he: 'hebrew',
  th: 'thai',
  km: 'khmer',
  lo: 'lao',
  my: 'myanmar',
  si: 'sinhala',
  ta: 'tamil',
  te: 'telugu',
  kn: 'kannada',
  ml: 'malayalam',
  bn: 'bengali',
  gu: 'gujarati',
  pa: 'gurmukhi',
  am: 'ethiopic',
};

/**
 * Returns true when both languages use the same writing script.
 * Same-script language pairs (e.g. English/French, Spanish/Portuguese)
 * share many trigrams, making franc unreliable for short text.
 */
export function isSameScript(lang1: string, lang2: string): boolean {
  const s1 = LANGUAGE_SCRIPTS[normalizeLanguageCode(lang1)];
  const s2 = LANGUAGE_SCRIPTS[normalizeLanguageCode(lang2)];
  if (!s1 || !s2) return false;
  return s1 === s2;
}

/**
 * Resolves the effective `lang` attribute for an element by walking up
 * the DOM tree. Returns the `lang` from the nearest ancestor that has one,
 * or empty string if none is found.
 */
export function getEffectiveLanguage(element: Element): string {
  let current: Element | null = element;
  while (current) {
    const lang = current.getAttribute('lang');
    if (lang) return lang;
    current = current.parentElement;
  }
  return '';
}
