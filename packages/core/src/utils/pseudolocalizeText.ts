// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

import { defaultConfigurationJSON, pseudolocalize } from './pseudolocalize';

export function pseudolocalizeText(text: string): string {
  const textWithDivision = text + defaultConfigurationJSON.dummyData.division;
  return pseudolocalize(textWithDivision, defaultConfigurationJSON);
}
