#!/usr/bin/env node

// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Merge coverage reports from all packages
 * This script finds all coverage-final.json files and merges them using monocart-coverage-reports
 */

import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CoverageReport } from 'monocart-coverage-reports';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function mergeCoverage() {
  try {
    // Setup paths
    const rootDir = path.resolve(__dirname, '..');
    const outputDir = path.join(rootDir, 'coverage');

    console.log('Starting coverage merge process...');

    // Clean up existing coverage directory
    if (fs.existsSync(outputDir)) {
      console.log('Cleaning up existing coverage directory...');
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    // Find all coverage files
    console.log('Finding coverage files...');
    const pattern = 'packages/**/coverage/coverage-final.json';
    const coverageFiles = globSync(pattern, {
      cwd: rootDir,
      absolute: true,
    });

    // Check if any files were found
    if (coverageFiles.length === 0) {
      console.log('No coverage files found. This is normal if no packages were tested.');

      // Create empty coverage directory with placeholder report
      fs.mkdirSync(outputDir, { recursive: true });

      // Create empty cobertura report for CI
      const emptyReport = `<?xml version="1.0" ?>
<coverage version="1">
  <packages></packages>
</coverage>`;
      fs.writeFileSync(path.join(outputDir, 'cobertura-coverage.xml'), emptyReport);

      console.log('Created empty coverage report for CI.');
      return;
    }

    console.log(`Found ${coverageFiles.length} coverage reports:`);
    coverageFiles.forEach((file) => {
      console.log(`  - ${path.relative(rootDir, file)}`);
    });

    // Read and collect all coverage data
    console.log('\nMerging reports...');
    const coverageData = [];

    for (const file of coverageFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(content);
      coverageData.push(data);
    }

    // Configure and generate merged report using monocart
    const coverageReport = new CoverageReport({
      name: 'Merged Coverage Report',
      outputDir: outputDir,
      reports: [
        ['html', { subdir: 'html' }],
        ['cobertura'],
        ['text-summary'],
        ['json', { file: 'coverage-final.json' }],
      ],
      cleanCache: true,
    });

    // Add all coverage data
    for (const data of coverageData) {
      await coverageReport.add(data);
    }

    // Generate the merged report
    await coverageReport.generate();

    console.log('\n✅ Coverage merge completed successfully!');
    console.log(`📊 HTML report: ${path.join(outputDir, 'html', 'index.html')}`);
    console.log(`📄 Cobertura report: ${path.join(outputDir, 'cobertura-coverage.xml')}`);
  } catch (error) {
    console.error('❌ Error merging coverage reports:', error.message);
    process.exit(1);
  }
}

// Run the merge
mergeCoverage();
