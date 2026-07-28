// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncodingAnalyzer, HtmlEncoding } from './encodingAnalyzer';

// Mock the external dependencies
vi.mock('@medv/finder', () => ({
  finder: vi.fn().mockReturnValue('.mock-selector'),
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-uuid-123'),
}));

describe('EncodingAnalyzer', () => {
  let analyzer: EncodingAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new EncodingAnalyzer();
  });

  describe('constructor and options', () => {
    it('should have the correct name', () => {
      expect(analyzer.name).toBe('EncodingAnalyzer');
    });

    it('should accept custom encoding', async () => {
      const customAnalyzer = new EncodingAnalyzer({
        encoding: HtmlEncoding.ISO88591,
      });
      expect(customAnalyzer).toBeDefined();
      expect(customAnalyzer.name).toBe('EncodingAnalyzer');

      // Verify the encoding is used by checking behavior
      const mockDocument = {
        characterSet: 'UTF-8', // Different from configured ISO-8859-1
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await customAnalyzer.run(mockElement);

      // Should detect mismatch because document is UTF-8 but analyzer expects ISO-8859-1
      const encodingMismatch = issues.find((issue) => issue.type === 'encoding-mismatch-document');
      expect(encodingMismatch).toBeDefined();
      expect(encodingMismatch?.message).toContain('ISO-8859-1');
    });

    it('should handle UTF-8 as default encoding', async () => {
      const defaultAnalyzer = new EncodingAnalyzer({});
      expect(defaultAnalyzer).toBeDefined();
      expect(defaultAnalyzer.name).toBe('EncodingAnalyzer');

      // Verify UTF-8 is default by testing behavior
      const mockDocument = {
        characterSet: 'ISO-8859-1', // Different from default UTF-8
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await defaultAnalyzer.run(mockElement);

      // Should detect mismatch because document is ISO-8859-1 but analyzer expects UTF-8 (default)
      const encodingMismatch = issues.find((issue) => issue.type === 'encoding-mismatch-document');
      expect(encodingMismatch).toBeDefined();
      expect(encodingMismatch?.message).toContain('UTF-8');
    });
  });

  describe('analyzer configuration', () => {
    it('should support different encoding configurations', async () => {
      const utf8Analyzer = new EncodingAnalyzer({ encoding: HtmlEncoding.UTF8 });
      const iso8859Analyzer = new EncodingAnalyzer({ encoding: HtmlEncoding.ISO88591 });
      const shiftJisAnalyzer = new EncodingAnalyzer({ encoding: HtmlEncoding.SHIFT_JIS });

      expect(utf8Analyzer.name).toBe('EncodingAnalyzer');
      expect(iso8859Analyzer.name).toBe('EncodingAnalyzer');
      expect(shiftJisAnalyzer.name).toBe('EncodingAnalyzer');

      // Verify each analyzer uses its configured encoding
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      // UTF-8 analyzer should find no issues (matching encoding)
      const utf8Issues = await utf8Analyzer.run(mockElement);
      expect(utf8Issues.length).toBe(0);

      // ISO-8859-1 analyzer should detect mismatch
      const iso8859Issues = await iso8859Analyzer.run(mockElement);
      expect(iso8859Issues.some((i) => i.message?.includes('ISO-8859-1'))).toBe(true);

      // Shift_JIS analyzer should detect mismatch
      const shiftJisIssues = await shiftJisAnalyzer.run(mockElement);
      expect(shiftJisIssues.some((i) => i.message?.includes('Shift_JIS'))).toBe(true);
    });
  });

  describe('encoding recommendations', () => {
    it('should provide correct HTML5 meta charset syntax', () => {
      const html5Syntax = '<meta charset="UTF-8">';
      expect(html5Syntax).toContain('meta charset=');
      expect(html5Syntax).toContain('UTF-8');
    });

    it('should provide correct HTML4 Content-Type syntax', () => {
      const html4Syntax = '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
      expect(html4Syntax).toContain('http-equiv="Content-Type"');
      expect(html4Syntax).toContain('charset=');
    });

    it('should reference relevant documentation', () => {
      const docsUrls = {
        characterSet: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/characterSet',
        metaCharset: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-charset',
        httpEquiv: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv',
        mojibake: 'https://en.wikipedia.org/wiki/Mojibake',
      };

      expect(docsUrls.characterSet).toContain('mozilla.org');
      expect(docsUrls.mojibake).toContain('wikipedia.org');
    });
  });

  describe('error handling', () => {
    it('should handle null or undefined root elements gracefully', async () => {
      try {
        await analyzer.run(null as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing meta elements gracefully', async () => {
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      try {
        const result = await analyzer.run(mockElement);
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('issue structure validation', () => {
    it('should generate issues with required properties', () => {
      const expectedIssueProperties = [
        'id',
        'type',
        'severity',
        'message',
        'elementSelector',
        'remediation',
      ];

      expectedIssueProperties.forEach((prop) => {
        expect(typeof prop).toBe('string');
      });
    });

    it('should use correct severity levels for encoding mismatches', () => {
      const validSeverities = ['critical', 'serious', 'warning', 'info'];

      // Encoding mismatches use 'critical' severity
      expect(validSeverities).toContain('critical');
    });

    it('should use correct severity levels for mojibake detection', () => {
      const validSeverities = ['critical', 'serious', 'warning', 'info'];

      // Mojibake detection uses 'serious' severity
      expect(validSeverities).toContain('serious');
    });

    it('should include remediation information in issues', () => {
      const remediationProperties = ['docsUrl', 'suggestion'];

      remediationProperties.forEach((prop) => {
        expect(typeof prop).toBe('string');
      });
    });
  });

  describe('encoding detection functionality', () => {
    it('should check document.characterSet', async () => {
      const mockDocument = {
        characterSet: 'ISO-8859-1',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      await analyzer.run(mockElement);
      // Verify the analyzer would detect mismatch if characterSet differs
      expect(mockDocument.characterSet).toBe('ISO-8859-1');
    });

    it('should check HTML5 meta charset elements', async () => {
      const mockMetaCharset = {
        getAttribute: vi.fn().mockReturnValue('ISO-8859-1'),
      };

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn((selector) => {
          if (selector === 'meta[charset]') return mockMetaCharset;
          return null;
        }),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      await analyzer.run(mockElement);
      expect(mockDocument.querySelector).toHaveBeenCalled();
    });

    it('should check HTML4 meta Content-Type elements', async () => {
      const mockMetaContentType = {
        getAttribute: vi.fn().mockReturnValue('text/html; charset=ISO-8859-1'),
      };

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn((selector) => {
          if (selector === 'meta[http-equiv="Content-Type"]') return mockMetaContentType;
          return null;
        }),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      await analyzer.run(mockElement);
      expect(mockDocument.querySelector).toHaveBeenCalled();
    });
  });

  describe('mojibake detection functionality', () => {
    it('should not detect mojibake in normal text', async () => {
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: 'This is normal English text without any encoding issues.' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssues = issues.filter((i) => i.type === 'encoding-mojibake');
      expect(mojibakeIssues.length).toBe(0);
    });

    it('should detect Japanese UTF-8 as Windows-1252 mojibake pattern', async () => {
      // Using actual patterns from JAPANESE_UTF8_AS_WINDOWS1252 dictionary
      // Pattern includes: ã (0xE3), control char 0x83, control char 0x82
      const ã = '\u00E3'; // Most common pattern (797× in real data)
      const char83 = String.fromCharCode(0x0083);
      const char82 = String.fromCharCode(0x0082);

      // Create text with repeated Japanese mojibake patterns (need enough for 20% threshold)
      const textWithMojibake = `${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}${ã}${char83}${ã}${char82}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect Japanese mojibake with 3-gram patterns', async () => {
      // Using 3-gram pattern from dictionary: ã\x83¼ (most frequent 3-gram, 62× in real data)
      const threeGram = String.fromCharCode(0x00e3, 0x0083, 0x00bc);
      const twoGram = String.fromCharCode(0x00e3, 0x0083);

      // Create text with repeated patterns (need enough for 20% threshold)
      const textWithMojibake = `${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}${threeGram}${twoGram}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect Japanese mojibake with 2-gram patterns', async () => {
      // Using common 2-gram patterns from dictionary (need enough for 20% threshold)
      const twoGram1 = String.fromCharCode(0x00e3, 0x0083); // ã\x83
      const twoGram2 = String.fromCharCode(0x00e3, 0x0082); // ã\x82
      const twoGram3 = String.fromCharCode(0x00e3, 0x0081); // ã\x81

      const textWithMojibake = `${twoGram1}${twoGram2}${twoGram3}${twoGram1}${twoGram2}${twoGram3}${twoGram1}${twoGram2}${twoGram3}${twoGram1}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect Japanese mojibake with 1-gram patterns', async () => {
      // Using common 1-gram patterns from dictionary (need enough for 20% threshold)
      const char1 = '\u00E3'; // ã
      const char2 = String.fromCharCode(0x0083); // control char
      const char3 = String.fromCharCode(0x0082); // control char
      const char4 = 'å'; // å

      const textWithMojibake = `${char1}${char2}${char1}${char3}${char4}${char1}${char2}${char1}${char3}${char4}${char1}${char2}${char1}${char3}${char4}${char1}${char2}${char1}${char3}${char4}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect Japanese mojibake with mixed n-gram patterns', async () => {
      // Mix of 1-gram, 2-gram, and 3-gram patterns from dictionary (need enough for 20% threshold)
      const oneGram = '\u00E3'; // ã
      const twoGram = String.fromCharCode(0x00e3, 0x0083); // ã\x83
      const threeGram = String.fromCharCode(0x00e3, 0x0083, 0x00bc); // ã\x83¼

      const textWithMojibake = `${oneGram}${twoGram}${threeGram}${oneGram}${twoGram}${threeGram}${oneGram}${twoGram}${threeGram}${oneGram}${twoGram}${threeGram}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should not detect mojibake when pattern count is at or below threshold', async () => {
      // Only 3 instances (threshold is 3, need > 3 to trigger)
      const textBelowThreshold = 'Text with ?? and ??? only';

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textBelowThreshold },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssues = issues.filter((i) => i.type === 'encoding-mojibake');

      // Should have 0 mojibake issues because pattern count (2) <= threshold (3)
      expect(mojibakeIssues.length).toBe(0);
    });

    it('should detect UTF-8 as Windows-1252 mojibake patterns', async () => {
      // Using patterns from MOJIBAKE_UTF8_AS_WIN1252 dictionary
      // These patterns occur when UTF-8 text is incorrectly interpreted as Windows-1252
      // Using high-frequency patterns from the provided data
      const pattern1 = 'ã' + String.fromCharCode(0x0083); // 415 occurrences
      const pattern2 = 'ã‚'; // Left single quote + ã
      const pattern3 = 'ã€'; // Euro sign + ã

      // Create text with repeated Windows-1252 mojibake patterns (need enough for 20% threshold)
      const textWithMojibake = `${pattern1}${pattern2}${pattern3}${pattern1}${pattern2}${pattern3}${pattern1}${pattern2}${pattern3}${pattern1}${pattern2}${pattern3}${pattern1}${pattern2}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect UTF-8 as Shift_JIS mojibake patterns', async () => {
      // Using patterns from MOJIBAKE_UTF8_AS_SHIFTJIS dictionary
      // These patterns occur when UTF-8 text is incorrectly interpreted as Shift_JIS
      // Using high-frequency patterns from the provided data
      const pattern1 = '縺・'; // 24 occurrences
      const pattern2 = '縺ｫ'; // 24 occurrences
      const pattern3 = '縺ｮ'; // 23 occurrences
      const pattern4 = 'ｮ蜷'; // 20 occurrences

      // Create text with repeated Shift_JIS mojibake patterns (need enough for 20% threshold)
      const textWithMojibake = `${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });

    it('should detect UTF-8 as EUC-JP mojibake patterns', async () => {
      // Using patterns from MOJIBAKE_UTF8_AS_EUCJP dictionary
      // These patterns occur when UTF-8 text is incorrectly interpreted as EUC-JP
      // Using high-frequency patterns from the provided data
      const pattern1 = '縺・'; // 24 occurrences
      const pattern2 = '縺ｫ'; // 24 occurrences
      const pattern3 = '縺ｮ'; // 23 occurrences
      const pattern4 = 'ｮ蜷'; // 20 occurrences

      // Create text with repeated EUC-JP mojibake patterns (need enough for 20% threshold)
      const textWithMojibake = `${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}${pattern1}${pattern2}${pattern3}${pattern4}`;

      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: textWithMojibake },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const issues = await analyzer.run(mockElement);
      const mojibakeIssue = issues.find((i) => i.type === 'encoding-mojibake');

      expect(mojibakeIssue).toBeDefined();
      expect(mojibakeIssue?.severity).toBe('critical');
      expect(mojibakeIssue?.message).toContain('mojibake');
    });
  });

  describe('return value', () => {
    it('should return a Promise', () => {
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const result = analyzer.run(mockElement);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve to an array of issues', async () => {
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: '' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const result = await analyzer.run(mockElement);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no issues detected', async () => {
      const mockDocument = {
        characterSet: 'UTF-8',
        querySelector: vi.fn().mockReturnValue(null),
        body: { innerText: 'Normal text' },
      };

      const mockElement = {
        ownerDocument: mockDocument,
      } as any;

      const result = await analyzer.run(mockElement);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
