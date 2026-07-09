# Freedom Legacy Elevation Framework

[![Security Scan](https://github.com/learn2earn2008-lab/build-your-dreams-569/actions/workflows/security.yml/badge.svg)](https://github.com/learn2earn2008-lab/build-your,dreams-569/actions/workflows/security.yml)

Entrepreneur credit, funding, and cash-flow education platform built with TanStack Start.

## Security

This repository runs automated security checks on every push to `main` and every pull request via the [Security Scan workflow](https://github.com/learn2earn2008-lab/build-your,dreams-569/actions/workflows/security.yml):

- **CodeQL analysis** – static analysis for JavaScript/TypeScript vulnerabilities
- **Dependency vulnerability audit** – `npm audit` with high/critical severity blocking
- **Secret scan** – TruffleHog scan for verified leaked secrets

Branch protection on `main` requires all three checks to pass before a pull request can be merged.

- View workflow runs: [Actions](https://github.com/learn2earn2008-lab/build-your-dreams-569/actions/workflows/security.yml)
- View CodeQL findings: [Security → Code scanning](https://github.com/learn2earn2008-lab/build-your,dreams-569/security/code-scanning)
