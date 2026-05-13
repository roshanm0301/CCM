# DevOps, CI/CD, and Containerization

## Purpose
This document defines the delivery architecture, container strategy, local stack, and CI/CD approach for CCM.

## Agents that use this document
| Agent | How it is used |
|---|---|
| DevOps Engineer Agent | Designs pipelines, images, environments, and deployment flow |
| Backend Engineer Agent | Ensures API service is container-ready and environment-safe |
| Frontend Engineer Agent | Ensures web app builds and runs in containerized environments |
| QA Engineer Agent | Uses environment topology for automated and manual verification |
| Solution Architect Agent | Verifies runtime architecture aligns with application design |

## Containerization principles
1. Every runtime dependency required for local development and integration testing must be containerizable.
2. Images must be immutable and versioned.
3. Runtime config must come from environment variables or mounted secrets, not hard-coded values.
4. Development conveniences may use Compose profiles and must not weaken production posture.
5. Keep production images minimal.

## Recommended deployment units
- `web`: React application container
- `api`: Node.js backend container
- `postgres`: PostgreSQL
- `mongo`: MongoDB
- optional dev-only:
  - `pgadmin`
  - `mongo-express`

## Image strategy

### Frontend image
Recommended multi-stage build:
1. dependency install
2. production build
3. static file serving container (for example Nginx or equivalent)

### Backend image
Recommended multi-stage build:
1. dependency install
2. TypeScript build
3. production runtime image with compiled output only

## Example Dockerfile patterns

### Frontend Dockerfile skeleton
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY ./ops/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend Dockerfile skeleton
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Docker Compose architecture
Use Compose for:
- local development
- CI integration environments
- smoke testing
- demo or sandbox environments where appropriate

### Compose topology
```text
[web] --> [api] --> [postgres]
                \-> [mongo]

[pgadmin] ------> [postgres]   (dev profile only)
[mongo-express] -> [mongo]     (dev profile only)
```

### Sample multi-service compose skeleton
```yaml
services:
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      VITE_API_BASE_URL: http://localhost:3000
    depends_on:
      - api

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      POSTGRES_URL: postgresql://ccm:ccm@postgres:5432/ccm
      MONGO_URL: mongodb://mongo:27017/ccm
      LOG_LEVEL: info
    depends_on:
      - postgres
      - mongo

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ccm
      POSTGRES_USER: ccm
      POSTGRES_PASSWORD: ccm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  pgadmin:
    image: dpage/pgadmin4
    profiles: ["devtools"]
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  mongo-express:
    image: mongo-express:1
    profiles: ["devtools"]
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://mongo:27017/
    ports:
      - "8081:8081"
    depends_on:
      - mongo

volumes:
  postgres_data:
  mongo_data:
```

## Environment strategy
| Environment | Purpose | Notes |
|---|---|---|
| Local | developer implementation | Compose-based, may include dev tools |
| CI | automated validation | ephemeral containers, seeded test data |
| Integration | cross-component verification | closer to production config |
| UAT/Staging | release candidate validation | stable environment, controlled access |
| Production | live runtime | managed secrets, controlled networking, monitoring required |

## CI pipeline blueprint
```text
Commit / PR
  -> Install dependencies
  -> Lint
  -> Type check
  -> Unit tests
  -> Component/integration tests
  -> Build artifacts
  -> Security scans
  -> Build container images
  -> Container smoke test
  -> Publish versioned images
```

## CD pipeline blueprint
```text
Approved build
  -> Deploy to integration/staging
  -> Run smoke tests
  -> Run selected end-to-end tests
  -> Manual or policy gate
  -> Deploy to production
  -> Post-deploy verification
  -> Rollback if health checks fail
```

## Required CI/CD controls
- pinned base images where practical
- dependency caching for speed, with invalidation strategy
- secret injection via CI secret manager
- no secrets in repo or image layers
- SBOM generation where organizationally required
- image vulnerability scanning
- migration step governance and rollback plan

## Database migration rules
- PostgreSQL migrations versioned and executed in controlled order
- MongoDB index/bootstrap scripts versioned
- migration must be forward-safe and rollback-aware
- never apply destructive production schema changes without explicit plan

## Deployment safeguards
- readiness and liveness probes
- startup order not assumed only by `depends_on`
- health checks required for API and supporting services
- structured startup logs
- rollback procedure documented before production use

## Agent-specific notes
### DevOps Engineer Agent
- Keep local Compose simple enough for fast onboarding.
- Separate dev-only tooling from production runtime concerns.

### Frontend Engineer Agent
- Ensure build output is environment-agnostic except for approved runtime config injection strategy.

### Backend Engineer Agent
- Ensure API starts only after config validation succeeds and exposes health endpoints for orchestration.
