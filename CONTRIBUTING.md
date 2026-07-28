# Contributing

Thanks for your interest in improving Pangaea. This document explains how to set up the project,
make changes, and get them merged.

By participating in this project, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Prerequisites

- **Node.js 22+** (see `.node-version` / `.nvmrc`)
- **Yarn 4** via Corepack — enabled automatically through `.yarnrc.yml`

```bash
git clone https://github.com/docusign/pangaea.git
cd pangaea
yarn install
yarn build
```

This is a [Turborepo](https://turbo.build/repo) monorepo with packages under `packages/*`. See the
[README](README.md) for the package layout.

---

## Development Workflow

1. **Create a branch** off `main` (e.g. `yourname/short-description`).
2. **Make your change** in the relevant package(s).
3. **Add tests** covering the change and keep existing tests green.
4. **Add a changeset** if your change affects a published package (see below).
5. **Open a pull request** against `main` and fill out the PR template.

### Common commands

```bash
yarn build            # Build all packages
yarn test             # Run all unit tests
yarn test:coverage    # Run tests with coverage
yarn lint             # Lint all packages
yarn lint:fix         # Lint and auto-fix
yarn format           # Auto-format all files
yarn format:check     # Check formatting without writing
yarn check-types      # TypeScript type-check all packages
```

`git commit` runs `lint-staged` via a Husky pre-commit hook, which lints and formats staged files
automatically.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <summary>
```

Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`.

Example:

```
feat(ime): detect missing isComposing check on React onChange handlers
```

---

## Changesets

Publishable packages are versioned with [Changesets](https://github.com/changesets/changesets). If
your change should ship in a release, add one:

```bash
yarn changeset
```

Pick the affected packages and the appropriate semver bump (patch / minor / major), and write a
short human-readable summary. Commit the generated file in `.changeset/` with your PR. Changes that
touch only tests, docs, or tooling generally do not need a changeset.

---

## Pull Requests

- Keep PRs focused; smaller PRs are reviewed faster.
- Ensure `yarn lint`, `yarn check-types`, and `yarn test` all pass locally.
- Fill out the PR template, linking any related issue where applicable.
- PRs require review from a [CODEOWNER](.github/CODEOWNERS) before merging.

---

## Reporting Bugs & Requesting Features

Open a [GitHub issue](https://github.com/docusign/pangaea/issues) with a clear description and, for
bugs, minimal reproduction steps.

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
