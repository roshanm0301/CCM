# Security Principles

## Purpose
This document defines the security baseline for CCM so all agents implement the system with consistent protection controls.

## Agents that use this document
| Agent | How it is used |
|---|---|
| Solution Architect Agent | Makes architecture decisions that preserve security boundaries |
| Backend Engineer Agent | Enforces authentication, authorization, validation, and data protection |
| Frontend Engineer Agent | Implements secure UI behavior, masking, and client-side handling |
| DevOps Engineer Agent | Secures containers, secrets, networks, and deployment flow |
| QA Engineer Agent | Tests security controls and misuse scenarios |

## Security stance
CCM handles operational data and potentially personal identifiers. Security must be proactive, layered, and auditable.

## Core principles

### 1. Least privilege
Users, services, and environments must receive only the access required for their function.

### 2. Strong trust boundaries
Validate and authorize at every trust boundary:
- browser to API,
- API to database,
- API to external system,
- admin/deployment access to runtime.

### 3. Defense in depth
Do not rely on a single layer such as UI checks. Combine:
- authentication,
- RBAC,
- input validation,
- secure configuration,
- auditability,
- monitoring.

### 4. Data minimization
Store only the data needed for CCM workflow and traceability. Avoid unnecessary duplication of master data and personal data.

### 5. Sensitive data handling
Apply masking, redaction, and access control to identifiers and personal data where full visibility is not required.

### 6. Secure defaults
All new endpoints, components, and jobs should be considered private and denied by default until explicitly exposed.

## Control areas

### Authentication
Recommended:
- centralized identity provider or secure internal auth approach
- session/token expiry handling
- secure sign-out
- prevention of unauthorized workspace access

### Authorization
Requirements:
- role-based access control
- permission checks on backend, not only frontend
- no UI-only hiding as a security measure
- access failure produces safe error messages

### Input and payload validation
Requirements:
- validate all external and user inputs
- reject malformed or unexpected payloads
- sanitize or encode output where appropriate
- guard adapter mappings against schema drift

### Secret management
Requirements:
- no secrets in source control
- no secrets embedded in container images
- use environment-secret injection or secret manager
- rotate secrets under policy

### Network and transport
Requirements:
- TLS in transit
- restricted service-to-service access
- minimal exposed ports
- production networking follows least exposure

### Container security
Requirements:
- minimal base images where possible
- vulnerability scanning
- non-root execution where feasible
- pinned image sources or approved registries
- remove unnecessary packages/tools from runtime images

### Data protection
Requirements:
- encrypt data in transit
- protect database access through network and credential controls
- backup encryption and restore access control
- retention and purge policies defined

### Audit and detection
Requirements:
- log security-significant events
- alert on repeated authorization failures or abnormal access patterns
- preserve auditability for sensitive workflow changes

## UI security rules
- mask sensitive identifiers where business need does not require full display
- prevent DOM exposure of values that should never be shown
- handle session expiry gracefully and securely
- do not trust client-side role or state for authorization

## Secure development rules
- dependency scanning in CI
- SAST where available
- no debug endpoints in production
- review third-party package necessity
- protect against injection, broken access control, and insecure direct object references

## Security test expectations
- authorization negative tests
- input validation abuse tests
- secrets scanning
- dependency vulnerability checks
- session expiry and renewal checks
- masking verification in UI and logs

## Agent-specific notes
### Backend Engineer Agent
- Security controls must live in shared middleware/services where practical so they are hard to bypass.

### Frontend Engineer Agent
- Treat all client-side data as potentially inspectable.
- Use frontend controls for usability, never as the only security barrier.

### DevOps Engineer Agent
- Ensure runtime, registry, CI secrets, and deployment credentials follow organizational least-privilege policy.
