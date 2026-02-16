# CLAUDE.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

Twake Workplace Common Settings is a SvelteKit-based microservice that manages user settings for the Twake Workplace ecosystem. It provides a centralized API for creating, reading, and updating user settings, with RabbitMQ integration for broadcasting changes to other services.

## Core Architecture

### Technology Stack
- **Framework**: SvelteKit 2 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Message Queue**: RabbitMQ (AMQP)
- **Authentication**: OIDC (OpenID Connect) + Static Bearer tokens
- **Testing**: Vitest

### Service Layer Pattern

The application follows a service-based architecture with singleton services initialized at startup:

- **Bootstrap Service** (`src/lib/services/bootstrap/index.ts`): Orchestrates initialization of all services in sequence
- **Settings Service** (`src/lib/services/settings/index.ts`): Core business logic for user settings CRUD operations and RabbitMQ message handling
- **RabbitMQ Service** (`src/lib/services/rabbitmq/index.ts`): Handles all message queue operations with automatic reconnection and retry logic
- **Auth Service** (`src/lib/services/auth/index.ts`): Validates OIDC tokens via the identity provider
- **Logger Service** (`src/lib/services/logger/index.ts`): Structured logging with tslog

Services are initialized via `src/hooks.server.ts` using SvelteKit's `init` hook.

### Authentication Model

Two authentication mechanisms are used:

1. **Admin API** (`/api/admin/*`): Requires static `SECRET_API_KEY` Bearer token for internal service-to-service communication
2. **User API** (`/api/user/*`): Requires OIDC access token validated against `IDENTITY_PROVIDER_URL`

The middleware (`src/lib/server/middleware/index.ts`) sets `event.locals.user` for authenticated requests. API key validation uses timing-safe comparison to prevent timing attacks.

### Database Schema

Single table design using Drizzle ORM (`src/lib/server/db/schema.ts`):

```typescript
userSettingsTable {
  nickname: text (primary key, unique, indexed)
  settings: jsonb (Partial<Nullable<UserSettings>>)
  version: integer (default: 1, for optimistic concurrency)
}
```

The `version` field implements optimistic locking - incoming updates must have a higher version than the stored version.

### RabbitMQ Message Flow

The service acts as both consumer and producer:

**Consumes**: `user.settings.update` messages on the input queue to update local database
**Publishes**: `user.settings.updated` messages to notify other services of changes

Message format (`SettingsMessage` type):
```typescript
{
  source: string;           // Origin service identifier
  nickname: string;         // User identifier
  request_id: string;       // Request tracking ID
  timestamp: number;        // Unix timestamp
  payload: UserSettings;    // Settings data (partial)
  version: number;          // Version for optimistic locking
}
```

Key features:
- Topic exchange with configurable routing keys
- Dead letter queues (DLQ) for failed messages
- Automatic retry with configurable attempts and delays
- Connection resilience with automatic reconnection

See `documentation/rabbit-mq.md` for message format details.

### API Routes Structure

- `/api/health` - Health check endpoint
- `/api/admin/user/settings` - Admin POST to create user settings
- `/api/admin/user/settings/[username]` - Admin GET and PUT for specific user settings
- `/api/admin/user/settings/sync` - Sync all user settings to RabbitMQ
- `/api/admin/user/settings/sync/[username]` - Sync specific user settings to RabbitMQ
- `/api/user/settings` - User GET endpoint (OIDC authenticated)

## Common Commands

### Development
```bash
npm run dev               # Start dev server with hot reload
npm run check             # Type check with svelte-check
npm run check:watch       # Type check in watch mode
```

### Build & Preview
```bash
npm run build            # Production build
npm run preview          # Preview production build
```

### Testing
```bash
npm run test             # Run tests once
npm run test:unit        # Run tests in watch mode
```

### Linting & Formatting
```bash
npm run lint             # Check code style (Prettier + ESLint)
npm run format           # Auto-fix formatting issues
```

### Database Operations
```bash
npm run db:start         # Start PostgreSQL + RabbitMQ via Docker Compose
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI
```

## Environment Configuration

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_API_KEY` - Static Bearer token for admin API
- `RABBITMQ_URL` - RabbitMQ AMQP connection string
- `RABBITMQ_EXCHANGE` - Exchange name for settings messages
- `RABBITMQ_SETTINGS_INPUT_QUEUE` - Queue name for incoming updates
- `RABBITMQ_SETTINGS_INPUT_ROUTING_KEY` - Routing key for consuming updates
- `RABBITMQ_SETTINGS_OUTPUT_ROUTING_KEY` - Routing key for publishing updates
- `IDENTITY_PROVIDER_URL` - OIDC provider URL for token validation

Optional RabbitMQ tuning:
- `RABBITMQ_MAX_RETRIES` - Max message processing attempts (default: 3)
- `RABBITMQ_RETRY_DELAY` - Delay between retries in ms (default: 1000)
- `RABBITMQ_CONNECTION_RETRY_DELAY` - Delay between reconnection attempts in ms (default: 5000)

## Key Implementation Details

### UserSettings Interface

The `UserSettings` type (`src/types/index.ts`) defines the available settings fields:

```typescript
interface UserSettings {
  language: string;
  timezone: string;
  avatar: string;
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  matrix_id: string;
  display_name: string;
}
```

Only certain fields are editable by users via OIDC-authenticated endpoints: `language`, `timezone`, `avatar`, `display_name` (defined in `EDITABLE_USER_SETTINGS`).

### User Settings Validation

Zod schemas in `src/lib/schemas/user-settings.ts` validate all incoming data:
- Phone numbers must pass E.164 validation (via `validator` library)
- Email must be valid email format
- Avatar must be valid URL
- Nickname must pass custom Twake validation (`validateNickName`)
- Language defaults to 'en' if not provided

### Settings Synchronization

The `/api/admin/user/settings/sync` endpoints support batch synchronization:
- Processes users in batches (`SYNC_BATCH_SIZE` = 50 users per batch)
- Adds delays between batches (`SYNC_PROCESS_DELAY` = 500ms) to avoid overwhelming RabbitMQ
- Publishes all stored settings to the output routing key

### Connection Resilience

RabbitMQ service includes:
- Automatic reconnection on connection loss
- Retry logic for publishing with infinite attempts
- Consumer retry with configurable max attempts before DLQ
- Connection state tracking to prevent duplicate reconnection attempts

### Error Handling

Services use structured logging with context. API routes follow SvelteKit conventions:
- Use `error()` helper from `@sveltejs/kit` for HTTP errors
- Return appropriate status codes (400, 401, 404, 409, 500)
- Log errors with relevant context for debugging

## Development Workflow

1. Start infrastructure: `npm run db:start`
2. Copy `.env.example` to `.env` and configure
3. Push database schema: `npm run db:push`
4. Start dev server: `npm run dev`
5. Run tests: `npm run test`

When adding new features:
- Add types to `src/types/index.ts`
- Update schemas in `src/lib/schemas/` for validation
- Add tests in `tests/` directory matching source structure
- Update API documentation in `documentation/api.md` if routes change
