# Logging and Monitoring

## Purpose
This document defines the observability baseline for CCM so operational issues can be detected, diagnosed, and resolved quickly.

## Agents that use this document
| Agent | How it is used |
|---|---|
| DevOps Engineer Agent | Implements telemetry pipelines, dashboards, and alerting |
| Backend Engineer Agent | Emits structured logs, metrics, and trace-friendly metadata |
| Frontend Engineer Agent | Emits controlled client telemetry and error context |
| QA Engineer Agent | Verifies observability exists for failure scenarios |
| Solution Architect Agent | Ensures architecture remains diagnosable |

## Observability goals
The system must answer these questions quickly:
1. Is CCM available?
2. Which workflow is failing?
3. Is failure in frontend, backend, database, or upstream integration?
4. Which user/request/interaction was affected?
5. Is the problem transient, systemic, or data-specific?

## Logging standards
### Structured logging
Use JSON logs with standard fields:
- `timestamp`
- `level`
- `service`
- `environment`
- `message`
- `correlation_id`
- `request_id`
- `user_id` where appropriate and allowed
- `interaction_id` where applicable
- `module`
- `error_code`
- `duration_ms` where relevant

### Log rules
- no secrets in logs
- no raw passwords/tokens
- avoid full PII unless explicitly approved and masked
- use consistent event names
- log at decision points, not every line of execution

## Metrics
### Backend
Track at minimum:
- request count
- error count
- latency percentiles
- dependency latency
- dependency failure rate
- database connection health
- queue depth if asynchronous audit/event handling exists

### Frontend
Track at minimum:
- page load timing
- API error rate
- JS runtime errors
- core workflow action failures
- session-level correlation where policy allows

## Alerting priorities
### Critical
- API unavailable
- database unavailable
- repeated failure of core interaction workflow
- error spike above threshold
- migration failure during deployment

### High
- sustained latency breach
- repeated upstream integration failure
- audit/event persistence failure

### Medium
- non-critical page errors
- dev tool or diagnostic panel failures
- degraded but not blocked dependency behavior

## Dashboard recommendations
Create dashboards for:
1. platform health
2. API performance
3. database health
4. integration adapter health
5. core workflow success/failure
6. deployment change impact

## Correlation model
Every request path should carry a correlation ID across:
- browser/client event where possible,
- API request,
- service logs,
- integration calls,
- audit/event records.

## Error monitoring
Use centralized error aggregation for:
- backend unhandled exceptions,
- frontend uncaught runtime errors,
- repeated validation/contract failures,
- adapter mapping failures.

## Retention guidance
Define log and metric retention by environment:
- shorter retention in dev
- operational retention in production aligned with policy
- longer audit retention only for governed business records, not generic logs

## Agent-specific notes
### Backend Engineer Agent
- Emit log events at workflow boundaries and failures.
- Include enough metadata to trace a single interaction safely.

### Frontend Engineer Agent
- Keep client telemetry purposeful.
- Do not leak sensitive data through browser logs or telemetry payloads.

### QA Engineer Agent
- Treat observability as testable behavior.
- Confirm that failures produce actionable logs, not generic noise.
