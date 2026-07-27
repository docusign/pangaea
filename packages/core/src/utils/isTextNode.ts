// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

export function isTextNode(node: ChildNode): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}
