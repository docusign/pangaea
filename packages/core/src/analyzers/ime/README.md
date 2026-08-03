# IME Analyzer

Detects event handlers on text input elements that are missing an `event.isComposing` check, which
can break Input Method Editor (IME) composition for CJK (Chinese, Japanese, Korean) languages.

## Why It Matters

IME users compose characters through multiple keystrokes. During composition, keyboard events fire
but shouldn't trigger app logic (e.g. `preventDefault()`, form submission). Without an `isComposing`
guard, the app interrupts the composition mid-stroke.

```
  User typing 中 (zhōng) with IME:

  Keystroke    Event           isComposing    Action
  ─────────────────────────────────────────────────────
  z            keydown         true           ← skip
  h            keydown         true           ← skip
  o            keydown         true           ← skip
  n            keydown         true           ← skip
  g            keydown         true           ← skip
  Enter        compositionend  false          ✅ commit 中

  ❌ Without check: each keydown calls preventDefault() → composition breaks
  ✅ With check:    if (event.isComposing) return; → composition completes
```

## How It Works

```
                       IMEAnalyzer.run(rootElement)
                                  │
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
            collectElements  buildContext    run strategies
                  │               │               │
           CSS selector +         │         EventHandlerStrategy
           isAnalyzableElement    │               │
                  │               │          ┌────┴────┐
                  │               │          ▼         ▼
                  │               │       detect   formatIssue
                  │               │          │         │
                  └───────────────┼──────────┴─────────┘
                                  ▼
                            Issue[] result
```

### Step-by-step

1. **Collect elements** — CSS selector finds all text input elements (`input[type="text"]`,
   `textarea`, etc.), then `isAnalyzableElement` filters out hidden/zero-size elements.
2. **Build context** — Packages elements, root, and options (including `getEventListeners`) into an
   `IMEAnalyzerContext`.
3. **Run strategies** — Each strategy receives the context and returns issues. Results are merged
   via `Promise.all` + `flat()`.

## Event Handler Strategy

One of two default strategies. It inspects event listeners on each input element for missing
`isComposing` checks.

### Detection Logic

For each element, the strategy:

1. Calls `getEventListeners(element)` to retrieve all registered listeners.
2. Checks listeners for keyboard events (`keydown`, `keyup`, `keypress`) and input events (`input`,
   `beforeinput`).
3. Converts each listener function to its source string via `.toString()`.
4. Flags the handler if the source doesn't contain `isComposing`.

Each flagged handler produces one issue with the `eventType` in `issueMetadata`.

## React Props Strategy

The second default strategy. Frameworks like React attach handlers via synthetic props rather than
`addEventListener`, so `getEventListeners` can't see them. This strategy reads React's internal
fiber/props keys directly off the DOM element (`__reactProps$`, `__reactFiber$`, or
`__reactInternalInstance$`, depending on React version) and inspects `onKeyDown`, `onKeyUp`,
`onKeyPress`, `onInput`, `onBeforeInput`, and `onChange` handlers for a missing `isComposing` check.
Issues from this strategy are always `critical` severity.

### `getEventListeners` — Dependency Injection

The `getEventListeners` function is **required** and must be provided by the client. Different
environments supply it differently:

| Environment    | How to provide                                                         |
| -------------- | ---------------------------------------------------------------------- |
| **DevTools**   | Chrome console API `getEventListeners` (available in DevTools context) |
| **Playwright** | Built from CDP's `DOMDebugger.getEventListeners`                       |

```typescript
// DevTools
new IMEAnalyzer({ getEventListeners: getEventListeners });

// Playwright (simplified)
const getEventListeners = buildFromCDP(cdpSession);
new IMEAnalyzer({ getEventListeners });
```

When the real API is unavailable, consumers pass a no-op fallback `() => ({})`.

## Target Elements

The analyzer targets text-accepting input elements:

| Selector                                           | Covers                      |
| -------------------------------------------------- | --------------------------- |
| `input[type="text"]`                               | Standard text fields        |
| `input[type="search"]`                             | Search fields               |
| `input[type="email"]`                              | Email fields                |
| `input[type="url"]`                                | URL fields                  |
| `input[type="tel"]`                                | Telephone fields            |
| `input[type="password"]`                           | Password fields             |
| `input:not([type])`                                | Inputs defaulting to text   |
| `textarea`                                         | Multi-line text areas       |
| `[contenteditable="true"]`, `[contenteditable=""]` | Editable non-input elements |

Non-text inputs (`checkbox`, `number`, `button`, etc.) are excluded — they don't accept IME
composition.

## Configuration

```typescript
const analyzer = new IMEAnalyzer({
  getEventListeners: myGetEventListenersFn, // required
});
```

## File Structure

| File                           | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `imeAnalyzer.ts`               | Orchestrator — collects elements, builds context, runs strategies             |
| `eventHandlerStrategy.ts`      | Detection strategy — inspects listeners for missing `isComposing`             |
| `reactPropsStrategy.ts`        | Detection strategy — inspects React synthetic props for missing `isComposing` |
| `types.ts`                     | `IMEAnalyzerOptions`, `IMEAnalyzerContext`, `GetEventListenersFn`             |
| `imeAnalyzer.test.ts`          | Unit tests for the analyzer orchestrator                                      |
| `eventHandlerStrategy.test.ts` | Unit tests for the event handler strategy                                     |
| `reactPropsStrategy.test.ts`   | Unit tests for the React props strategy                                       |

## Extending with Custom Strategies

```typescript
import type { AnalyzerStrategy } from '../../types/types';
import type { IMEAnalyzerContext } from './types';

class MyCustomStrategy implements AnalyzerStrategy<IMEAnalyzerContext> {
  readonly name = 'my-custom-check';

  analyze(context: IMEAnalyzerContext): Issue[] {
    // Access context.elements, context.options.getEventListeners, etc.
    return [];
  }
}

const analyzer = new IMEAnalyzer({ getEventListeners: myFn }, [new MyCustomStrategy()]);
```
