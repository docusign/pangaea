# Pangaea DevTools Extension

A Chrome DevTools extension for auditing web applications for globalization issues including RTL
support, layout flow, and text encoding.

## Development

### Build the Extension

```bash
# From the root of the monorepo
yarn build

# Or build just the devtools-extension package
cd packages/devtools-extension
yarn build
```

## Loading the Extension in Chrome

### Step 1: Build the Extension

Make sure you've built the extension first (see above).

### Step 2: Open Chrome Extensions Page

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner

### Step 3: Load the Extension

1. Click the "Load unpacked" button
2. Navigate to and select the `packages/devtools-extension/dist` folder
3. The extension should now appear in your extensions list

### Step 4: Using the Extension

1. Open Chrome DevTools (F12 or Right-click → Inspect)
2. Look for the "Pangæa" tab in the DevTools panel
3. Select which analyzers to run, configure any options, and click "Run Audit"
4. View the results and print/export the report as needed

## Features

- **RTL Analysis**: Detects RTL layout issues and missing `dir` attributes
- **Layout Stability Analysis**: Detects content that overflows its container when text expands
  during localization
- **Encoding Analysis**: Finds encoding issues and problematic character usage (mojibake)
- **IME Analysis**: Checks Input Method Editor support for CJK languages
- **Language Analysis** _(experimental)_: Detects text and link language mismatches with the page
  language
- **Collation Analysis**: Detects unsorted lists, selects, and table columns that ignore
  locale-aware collation
- **Interactive Reports**: Click on issues to highlight elements in the page
- **Print/PDF Export**: Opens the report in a new window and triggers the browser's print dialog,
  where it can be saved as a PDF

## Troubleshooting

### Extension Not Showing in DevTools

- Make sure the extension is enabled in `chrome://extensions/`
- Try closing and reopening DevTools
- Check that the build was successful and the `dist` folder exists

### Audit Gets Stuck

- The extension includes a 60-second timeout for audits
- If the connection between the DevTools panel and the extension's background worker drops (e.g. the
  worker restarts), the panel automatically reconnects

### PDF Export Not Working

- Make sure pop-ups are not blocked for the DevTools window
- The report is opened in a new window and printed via the browser's print dialog - choose "Save as
  PDF" there
