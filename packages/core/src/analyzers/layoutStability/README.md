# Layout Stability Analyzer

Detects layout breakage caused by text expansion during localization. Translated text is typically
30–40% longer than English, which can cause content to overflow containers or break layouts. This
analyzer simulates that expansion via pseudolocalization and measures the impact.

## How It Works

The analyzer uses a **pseudolocalize-and-diff** approach: capture element geometry, expand all text,
capture again, then compare.

```
                  LayoutStabilityAnalyzer.run(rootElement)
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
             collectElements   buildContext    run strategies
                   │               │               │
                   │       ┌───────┴───────┐       │
                   │       ▼               ▼       │
                   │   capture         capture     │
                   │   BEFORE          AFTER       │
                   │   snapshots       snapshots   │
                   │       │               │       │
                   │       │ pseudolocalize│       │
                   │       │ text nodes    │       │
                   │       │ (~30% expand) │       │
                   │       │               │       │
                   │       └───────┬───────┘       │
                   │               ▼               │
                   │ LayoutStabilityAnalyzerContext│
                   │               │               │
                   └───────────────┼───────────────┘
                                   ▼
                             Issue[] result
```

### Step-by-step

1. **Collect elements** — `querySelectorAll` grabs all visual elements (plus the root), then
   `isAnalyzableElement` filters out hidden, zero-size, or off-page elements.
2. **Capture BEFORE snapshots** — Record `getBoundingClientRect()`, `scrollWidth`, `scrollHeight`,
   `clientWidth`, and `clientHeight` for every element.
3. **Pseudolocalize** — Walk each element's direct text nodes and expand them (~30%) using the
   pseudolocalization tool. Only direct children are processed to avoid double-expanding nested
   text.
4. **Wait for layout** — Double `requestAnimationFrame` ensures the browser completes reflow.
5. **Capture AFTER snapshots** — Same measurements, now with expanded text.
6. **Revert text** — Restore all original text content.
7. **Run strategies** — Each strategy receives the context (both snapshot maps + options) and
   returns issues.

## Strategies

### 1. SelfOverflowAnalyzerStrategy

Detects when expanded text overflows **its own container** (scrollWidth > clientWidth).

```
  Before expansion                    After expansion
  ┌─────────────┐               ┌─────────────────┐
  │ Hello world │               │   Ħëľľö ŵöŕľð   │!!!
  └─────────────┘               └─────────────────┘
                                ◄── clientWidth ──►
                                ◄──── scrollWidth ────►
                                                ▲
                                            overflow (new)
```

**What it checks:**

```
overflowXDelta = (scrollWidth - clientWidth)_after  −  (scrollWidth - clientWidth)_before
overflowYDelta = (scrollHeight - clientHeight)_after − (scrollHeight - clientHeight)_before
```

The effective threshold adapts to element size:

```
horizontalThreshold = max(pixelThreshold, percentThreshold / 100 × elementWidth)
verticalThreshold   = max(pixelThreshold, percentThreshold / 100 × elementHeight)
```

An issue is flagged if **either** direction exceeds its effective threshold. Using the max of both
thresholds prevents false positives on large elements (where a few px are invisible) and small
elements (where a small % is insignificant).

**Skip conditions:**

- Elements without direct text content (pure containers)
- Elements with `overflow: hidden/scroll/auto` (they handle overflow by design)
- Elements that already had overflow before expansion (pre-existing issues)

### 2. ParentOverflowAnalyzerStrategy

Detects when an element's bounding rect **escapes its parent** after expansion.

```
  Before expansion                    After expansion
  ┌─────── parent ───────┐           ┌─────── parent ───────┐
  │  ┌──── child ────┐   │           │  ┌──── child ────────┼──┐
  │  │ Hello world   │   │           │  │ Ħëľľö ŵöŕľð !!!   │  │
  │  └───────────────┘   │           │  └───────────────────┼──┘
  └──────────────────────┘           └──────────────────────┘
                                                             ▲
                                                     overflow right
```

**What it checks (per direction):**

| Direction | Overflow calculation           |
| --------- | ------------------------------ |
| Right     | `child.right − parent.right`   |
| Left      | `parent.left − child.left`     |
| Bottom    | `child.bottom − parent.bottom` |
| Top       | `parent.top − child.top`       |

The effective threshold adapts to parent size:

```
horizontalThreshold = max(pixelThreshold, percentThreshold / 100 × parentWidth)
verticalThreshold   = max(pixelThreshold, percentThreshold / 100 × parentHeight)
```

An issue is flagged if **any** direction exceeds its effective threshold.

**Skip conditions:**

- Parents with `overflow: hidden/scroll/auto` (they clip content)
- Elements already overflowing their parent before expansion
- Zero-dimension parents (collapsed containers)
- Missing snapshots for element or parent

## Threshold Logic

Both strategies use the same threshold approach — the effective threshold is the **max** of the
pixel threshold and the percent threshold (converted to pixels based on element/parent size):

```
effectiveThreshold = max(pixelThreshold, percentThreshold / 100 × dimension)
```

This ensures overflow must be significant in both absolute and relative terms before being reported.

## Configuration

```typescript
const analyzer = new LayoutStabilityAnalyzer({
  overflowDeltaPercentThreshold: 5, // % of element/parent size (default: 5)
  overflowDeltaPixelThreshold: 10, // absolute pixel minimum (default: 10)
});
```

## File Structure

| File                                     | Purpose                                                               |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `layoutStabilityAnalyzer.ts`             | Orchestrator — collects elements, pseudolocalizes, runs strategies    |
| `selfOverflowAnalyzerStrategy.ts`        | Strategy — detects content overflowing its own box                    |
| `parentOverflowAnalyzerStrategy.ts`      | Strategy — detects elements escaping parent boundaries                |
| `types.ts`                               | `LayoutStabilityAnalyzerOptions` and `LayoutStabilityAnalyzerContext` |
| `layoutStabilityAnalyzer.test.ts`        | Unit tests for the analyzer orchestrator                              |
| `selfOverflowAnalyzerStrategy.test.ts`   | Unit tests for the self-overflow strategy                             |
| `parentOverflowAnalyzerStrategy.test.ts` | Unit tests for the parent-overflow strategy                           |

## Extending with Custom Strategies

The analyzer accepts custom strategies via the constructor:

```typescript
import type { AnalyzerStrategy } from '../../types/types';
import type { LayoutStabilityAnalyzerContext } from './types';

class MyCustomStrategy implements AnalyzerStrategy<LayoutStabilityAnalyzerContext> {
  readonly name = 'my-custom-check';

  analyze(context: LayoutStabilityAnalyzerContext): Issue[] {
    // Access context.beforeSnapshots, context.afterSnapshots, etc.
    return [];
  }
}

const analyzer = new LayoutStabilityAnalyzer({}, [new MyCustomStrategy()]);
```
