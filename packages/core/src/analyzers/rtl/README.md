# RTL Analyzer

Detects elements that don't properly mirror when the page direction switches between LTR and RTL.
This catches hardcoded directional CSS (e.g. `left: 100px`, `margin-right: 20px`) that breaks
right-to-left layouts.

## How It Works

The analyzer uses a **snapshot-diff** approach: capture element geometry, flip the direction,
capture again, then compare.

```
                         RTLAnalyzer.run(rootElement)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              collectElements  buildContext    run strategies
                    │               │               │
                    │       ┌───────┴───────┐       │
                    │       ▼               ▼       │
                    │   capture         capture     │
                    │   BEFORE          AFTER       │
                    │   snapshots       snapshots   │
                    │       │               │       │
                    │       │  flip dir     │       │
                    │       │  LTR ↔ RTL    │       │
                    │       │               │       │
                    │       └───────┬───────┘       │
                    │               ▼               │
                    │        RTLAnalyzerContext     │
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
                              Issue[] result
```

### Step-by-step

1. **Collect elements** — `querySelectorAll` grabs all visual elements, then `isAnalyzableElement`
   filters out hidden, zero-size, or off-page elements.
2. **Capture BEFORE snapshots** — Record `getBoundingClientRect()` and scroll dimensions for every
   element in the current direction.
3. **Flip direction** — Set `style.direction` to the opposite value (`ltr` → `rtl` or vice versa).
4. **Wait for layout** — Double `requestAnimationFrame` ensures the browser completes reflow.
5. **Capture AFTER snapshots** — Same measurements, now in the flipped direction.
6. **Revert direction** — Always restores the original `style.direction`, even if capture fails.
7. **Run strategies** — Each strategy receives the context (both snapshot maps + options) and
   returns issues.

## Mirroring Check (MirroringStrategy)

The default (and currently only) strategy. It checks whether each element "mirrors" across the
container when direction flips.

### The Mirror Test

In a correct RTL layout, an element's distance from the **right** edge in LTR should equal its
distance from the **left** edge in RTL:

```
  LTR layout                          RTL layout (expected)
  ┌──────────────────────────┐        ┌──────────────────────────┐
  │                          │        │                          │
  │  ┌──────┐                │        │               ┌──────┐   │
  │  │ elem │                │        │               │ elem │   │
  │  └──────┘                │        │               └──────┘   │
  │                          │        │                          │
  └──────────────────────────┘        └──────────────────────────┘
  ◄──►       ◄───────────────►        ◄──────────────►        ◄──►
   100px  distFromRight=700px          distFromLeft=700px  100px

  ✅ Mirrors correctly: distFromRight (LTR) == distFromLeft (RTL)
```

When an element uses hardcoded CSS like `left: 100px`, it stays pinned:

```
  LTR layout                          RTL layout (broken)
  ┌──────────────────────────┐        ┌──────────────────────────┐
  │                          │        │                          │
  │  ┌──────┐                │        │  ┌──────┐                │
  │  │ elem │                │        │  │ elem │  ← didn't move │
  │  └──────┘                │        │  └──────┘                │
  │                          │        │                          │
  └──────────────────────────┘        └──────────────────────────┘
  ◄──►       ◄───────────────►        ◄──►
   100px  distFromRight=700px          distFromLeft=100px

  ❌ Asymmetry: |700 - 100| = 600px
```

### What Gets Checked

For each element, three measurements are compared before vs. after:

| Metric                 | How it's calculated                                  |
| ---------------------- | ---------------------------------------------------- |
| **Position asymmetry** | `\|distanceFromRight(LTR) - distanceFromLeft(RTL)\|` |
| **Width difference**   | `\|width(before) - width(after)\|`                   |
| **Height difference**  | `\|height(before) - height(after)\|`                 |

An issue is flagged if **any** of these exceed the threshold.

### Threshold Calculation

The threshold adapts to element size:

```
thresholdPx = max(elementWidth × asymmetryThresholdPercent / 100, asymmetryThresholdPx)
```

- **Percentage threshold** — Scales with element width (default: 15%)
- **Pixel floor** — Prevents tiny thresholds on small elements (default: 20px)

For a 200px-wide element: `max(200 × 0.15, 20) = max(30, 20) = 30px`

### Noise Reduction

The strategy applies two filters to avoid false positives:

- **Parent-relative measurement** — Each element's position is measured relative to its parent, not
  the page root. This means a child that correctly mirrors within a broken parent shows zero drift
  and isn't flagged — no ancestor walking needed.
- **Inline text element filtering** — Inline elements (`display: inline*`) inside a parent with
  direct text content are skipped. These flow with BIDI text reordering and don't need independent
  mirroring.

## Configuration

```typescript
const analyzer = new RTLAnalyzer({
  asymmetryThresholdPercent: 15, // % of element width (default: 15)
  asymmetryThresholdPx: 20, // absolute pixel floor (default: 20)
});
```

## File Structure

| File                        | Purpose                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `rtlAnalyzer.ts`            | Orchestrator — collects elements, captures snapshots, runs strategies |
| `mirroringStrategy.ts`      | Detection strategy — compares before/after geometry                   |
| `utils.ts`                  | Pure functions: threshold calc, position drift, inherited shift       |
| `types.ts`                  | Options, context, and issue metadata interfaces                       |
| `rtlAnalyzer.test.ts`       | Unit tests for the analyzer orchestrator                              |
| `mirroringStrategy.test.ts` | Unit tests for the mirroring strategy                                 |
| `utils.test.ts`             | Unit tests for extracted pure utility functions                       |

## Extending with Custom Strategies

The analyzer accepts custom strategies via the constructor:

```typescript
import type { AnalyzerStrategy } from '../../types/types';
import type { RTLAnalyzerContext } from './types';

class MyCustomStrategy implements AnalyzerStrategy<RTLAnalyzerContext> {
  readonly name = 'my-custom-check';

  analyze(context: RTLAnalyzerContext): Issue[] {
    // Access context.beforeSnapshots, context.afterSnapshots, etc.
    return [];
  }
}

const analyzer = new RTLAnalyzer({}, [new MyCustomStrategy()]);
```
