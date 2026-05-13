# Documentation Evolution

## Purpose
This document explains how the CCM documentation set should evolve across phases so multiple Claude agents can work incrementally without corrupting the architecture or introducing cross-phase ambiguity.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Product Owner Agent | Decides whether a change is phase-specific or foundational |
| Solution Architect Agent | Maintains long-lived architecture coherence |
| UX Designer Agent | Updates design-system only when patterns truly become shared |
| Frontend Engineer Agent | Knows whether to implement a shared primitive or a phase-specific feature |
| Backend Engineer Agent | Prevents temporary phase logic from polluting core modules |
| QA Engineer Agent | Aligns regression scope to documentation changes |
| DevOps Engineer Agent | Updates delivery docs when runtime or environment needs change |

## Change classification
Every proposed documentation change must be classified as one of the following:

### 1. Phase-specific functional change
Belongs in:
- phase requirement doc,
- feature spec,
- user story,
- API contract for that phase.

Do **not** change shared architecture/design docs unless the change affects the platform baseline.

### 2. Shared platform change
Belongs in:
- architecture docs,
- coding standards,
- testing strategy,
- DevOps docs,
- security/observability docs.

### 3. Shared UX system change
Belongs in:
- design-system docs,
- shared component library,
- theme/tokens.

## Update rules
1. Do not rewrite stable documents for every phase.
2. Add decision notes or deltas when possible.
3. Preserve backward readability for future agents reading the repo later.
4. Document why a change was made, not only what changed.
5. Update the minimum number of documents required to keep the system coherent.

## Versioning recommendation
Use a simple version header or changelog entry per document:
- version
- date
- change summary
- reason
- impacted agents

## Recommended phase documentation structure
```text
/docs
  /design-system
  architecture-principles.md
  high-level-architecture.md
  non-functional-requirements.md
  data-model-outline.md
  coding-standards.md
  testing-strategy.md
  devops-ci-cd.md
  logging-and-monitoring.md
  security-principles.md
  documentation-evolution.md
  /phases
    phase-01/
      functional-docs...
      api-contracts...
      ux-specs...
    phase-02/
      functional-docs...
```

## Decision workflow
Before changing a shared document, ask:
1. Is this truly cross-phase?
2. Will future phases likely need the same rule?
3. Does this change alter existing implementation behavior?
4. Which agents need to re-read this document after the change?

## Review responsibility
| Document type | Primary reviewer |
|---|---|
| Design system | UX + Frontend |
| Architecture/data/security | Solution Architect + Backend |
| Testing | QA + Architecture |
| DevOps/observability | DevOps + Architecture |
| Non-functional requirements | Product + Architecture + QA |

## Anti-patterns to avoid
- putting future-phase feature detail into core architecture docs
- turning temporary implementation shortcuts into permanent standards
- adding generic placeholders for not-yet-approved capabilities
- allowing one phase's workaround to redefine the whole platform

## Agent-specific notes
### Product Owner Agent
- Use this document to protect scope and avoid accidental product expansion.

### Solution Architect Agent
- Maintain a stable foundation, not a constantly rewritten one.

### Frontend and Backend Engineer Agents
- Resist promoting feature-specific patterns into the shared layer too early.
