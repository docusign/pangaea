# Analyzers

## Encoding Analyzer

### Supported Mojibake Patterns

Pattern dictionaries (1-, 2-, and 3-character n-grams) are defined in `mojibake-patterns.ts` for:

- **UTF-8 → Windows-1252**
- **UTF-8 → Shift_JIS**
- **UTF-8 → EUC-JP**
- **Generic patterns**: Additional cross-encoding mojibake detection

Detection uses cumulative matching across all dictionaries with a 15% threshold.
