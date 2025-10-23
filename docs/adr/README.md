# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Football Minutes project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:

- **Title**: ADR ### - Decision Title
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: YYYY-MM-DD
- **Decision Makers**: Who was involved
- **Tags**: Relevant keywords

Then sections for:
- Context
- Decision
- Consequences
- Alternatives Considered
- References

## Index of ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-hybrid-serverless-express-architecture.md) | Hybrid Serverless + Express Architecture | Accepted | 2025-10-23 |
| [002](./002-typescript-module-resolution.md) | TypeScript Module Resolution Strategy | Accepted | 2025-10-23 |

## Creating New ADRs

When making significant architectural decisions:

1. Copy the template (or use an existing ADR as reference)
2. Number it sequentially (next available number)
3. Fill in all sections thoughtfully
4. Get review from team
5. Update this index
6. Commit with message: `docs: add ADR-### [title]`

## ADR Lifecycle

- **Proposed**: Under discussion
- **Accepted**: Decision made and implemented
- **Deprecated**: No longer current but kept for history
- **Superseded**: Replaced by another ADR (reference the new ADR)
