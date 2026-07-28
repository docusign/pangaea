# Analyzers

## Encoding Analyzer

### Supported Mojibake Patterns

- **UTF-8 → Windows-1252**: 268 patterns (64 1-grams, 103 2-grams, 101 3-grams)
- **UTF-8 → Shift_JIS**: 224 patterns (48 1-grams, 82 2-grams, 94 3-grams)
- **UTF-8 → EUC-JP**: 279 patterns (65 1-grams, 94 2-grams, 120 3-grams)
- **Generic patterns**: Additional cross-encoding mojibake detection

Detection uses cumulative matching across all dictionaries with a 15% threshold.
