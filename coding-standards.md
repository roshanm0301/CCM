# Coding Standards

## Purpose
This document defines the coding conventions for CCM so multiple Claude agents can contribute code with low merge friction and high consistency.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Frontend Engineer Agent | Builds React/MUI/TypeScript code consistently |
| Backend Engineer Agent | Builds Node.js/TypeScript services consistently |
| QA Engineer Agent | Aligns test code and fixtures to the same conventions |
| Solution Architect Agent | Reviews implementation quality and maintainability |
| DevOps Engineer Agent | Enforces standards in CI |

## General rules
1. TypeScript is mandatory for frontend and preferred mandatory standard for backend.
2. Enable strict mode.
3. Favor readability over cleverness.
4. Keep functions small and single-purpose.
5. Prefer explicit names over abbreviations.
6. Avoid hidden side effects.
7. Write code so another agent can understand it without chat context.

## Repository strategy
Recommended mono-repo structure:
```text
/
  /apps
    /web
    /api
  /packages
    /ui
    /config
    /types
    /eslint-config
    /tsconfig
  /docs
```

## Frontend standards
### Structure
Use a feature-aware structure with a shared design-system layer.
- `app/` for bootstrapping and routing
- `pages/` for route-level composition
- `features/` for phase-specific user capabilities
- `entities/` for reusable domain-oriented UI/data models
- `shared/` for UI primitives, theme, utilities, and API client helpers

### Rules
- Components are functional components.
- Props are explicitly typed.
- Shared UI components must be presentational.
- Feature containers handle orchestration and API interaction.
- No direct fetch logic inside purely presentational components.
- Prefer React Query or equivalent for server state.
- Form state must use a consistent library/pattern.
- Use MUI theming; avoid inline style drift.

### Naming
- Components: `PascalCase`
- Hooks: `useSomething`
- Utility functions: `camelCase`
- File names: match exported symbol where practical

## Backend standards
### Structure
- `modules/` for bounded functional areas
- `controllers/` or routes for transport handling
- `services/` for application logic
- `repositories/` for data access
- `adapters/` for external integrations
- `validators/` for input schemas
- `mappers/` for contract translation

### Rules
- Controllers stay thin.
- Business/application logic belongs in services.
- Data access belongs in repositories.
- External calls belong in adapters.
- DTOs and validation schemas must be explicit.
- Throw typed application errors, not raw strings.
- No database queries from controller code.

## Error handling
Requirements:
- standard error envelope for APIs,
- typed internal errors,
- correlation ID included in logs and responses where appropriate,
- no stack trace leakage to clients in production.

## Logging rules
- structured JSON logging,
- no secrets or raw sensitive identifiers in logs,
- use log levels consistently,
- emit domain-significant events at predictable points.

## Validation rules
- validate all incoming API data,
- normalize at trust boundaries,
- do not rely on UI-only validation,
- external payloads require schema guarding.

## Testing in codebase
- unit tests near implementation or in mirrored test folders
- integration tests grouped by module
- end-to-end tests separated by workflow

## Dependency rules
- add dependencies only with clear justification
- prefer established libraries over custom infrastructure code
- centralize versions where possible
- remove unused packages promptly

## Documentation in code
Write lightweight but useful documentation:
- comments explain why, not what, unless logic is non-obvious
- README per major package/app if needed
- architecture decisions belong in docs, not scattered comments

## Formatting and linting
Recommended baseline:
- ESLint
- Prettier
- import sorting
- no unused imports/variables
- no `any` without explicit exception comment
- consistent path alias strategy

## Example backend service shape
```ts
export class StartInteractionService {
  constructor(
    private readonly interactionRepo: InteractionRepository,
    private readonly auditRepo: AuditRepository,
  ) {}

  async execute(input: StartInteractionInput, actor: ActorContext): Promise<StartInteractionResult> {
    // validate invariants
    // persist interaction
    // persist audit event
    // return typed result
  }
}
```

## Example frontend container shape
```tsx
export function InteractionSearchContainer() {
  const { data, isLoading, error } = useSearchQuery();
  return (
    <SearchWorkspace
      results={data?.results ?? []}
      loading={isLoading}
      error={error}
    />
  );
}
```

## Agent-specific notes
### Frontend Engineer Agent
- Build reusable primitives first.
- Keep component APIs stable and small.
- Avoid cross-feature imports that bypass the shared layer.

### Backend Engineer Agent
- Design modules so they can later be extracted without contract breakage.
- Keep persistence logic and adapter logic out of application services.

### QA Engineer Agent
- Name tests by business intent and expected behavior.
- Prefer deterministic fixtures over fragile environment-dependent tests.
