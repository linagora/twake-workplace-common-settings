# RabbitMQ Message Documentation: User Settings Update

## Overview

This document describes the structure of a message expected from **RabbitMQ** when a user settings are updated in the common settings service.

This message is consumed by backend services responsible for updating their caches / UI.

## exchange information

- Content-Type: json
- Delivery Mode: persistant
- Exchange type: topic

## Payload Structure

```json
{
	"source": "IAM",
	"nickname": "johndoe",
	"request_id": "req_1234567890",
	"timestamp": 1718897400000,
	"version": 1,
	"payload": {
		"language": "en",
		"timezone": "Europe/Paris",
		"avatar": "https://example.com/avatar.png",
		"last_name": "Doe",
		"first_name": "John",
		"email": "john.doe@example.com",
		"phone": "+33612345678",
		"matrix_id": "@johndoe:matrix.org",
		"display_name": "John Doe",
		"ai_assistant_enabled": false
	}
}
```

## Field Descriptions

### top level fields:

| Field        | Type    | Description                                                  |
| ------------ | ------- | ------------------------------------------------------------ |
| `source`     | string  | Source of the message.                                       |
| `nickname`   | string  | Unique nickname (primary key) of the user in the database.   |
| `request_id` | string  | Unique identifier for this update request .                  |
| `timestamp`  | integer | Unix timestamp in milliseconds when the message was emitted. |
| `version`    | integer | Version of the user settings.                                |
| `payload`    | object  | Actual user settings to be updated.                          |

### the payload object:

| Field                  | Type    | Description                                                                    |
| ---------------------- | ------- | ------------------------------------------------------------------------------ |
| `language`             | string  | User's preferred language (e.g., `"en"`, `"fr"`).                              |
| `timezone`             | string  | IANA timezone string (e.g., `"Europe/Paris"`).                                 |
| `avatar`               | string  | URL to user's avatar image.                                                    |
| `last_name`            | string  | User's last name.                                                              |
| `first_name`           | string  | User's first name.                                                             |
| `email`                | string  | User's email address.                                                          |
| `phone`                | string  | User's phone number in E.164 format.                                           |
| `matrix_id`            | string  | User's Matrix ID. (can be null)                                                |
| `display_name`         | string  | Full display name to show in UIs.                                              |
| `ai_assistant_enabled` | boolean | Whether the user turned on their Twake Space personal agent. Absent means off. |

## Expected Consumer Behavior

- Each application declares and binds a quorum queue.
- Respect optimistic concurrency using the version field if applicable.

# RabbitMQ Message Documentation: Workplace Locator

## Overview

The workplace locator stores each user's workplace address, keyed by email ([ADR 063](https://github.com/linagora/twake-workplace-private/pull/1762)). It learns it from `user.created`, which the service that creates the instance publishes once the instance exists.

## Binding

- Exchange: `RABBITMQ_AUTH_EXCHANGE` (default `auth`), durable topic
- Routing key: `RABBITMQ_USER_CREATED_ROUTING_KEY` (default `user.created`)
- Queue: `RABBITMQ_LOCATOR_QUEUE` (default `common-settings.workplace-locator`), with its dead letter queue `<queue>.dlq`

## Payload Structure

```json
{
	"twakeId": "alice",
	"internalEmail": "alice@example.com",
	"workplaceFqdn": "alice.twake.app"
}
```

Only `internalEmail` and `workplaceFqdn` are read. Other fields are ignored.

## Consumer Behavior

- The email is lowercased and the row for it is added or replaced, so a message delivered twice changes nothing.
- A message without `internalEmail` or `workplaceFqdn` is logged and acknowledged.
- A database failure is retried, then dead lettered.

## Schema

The service does not migrate its database on start. Deployments apply `migrations/workplace_locator.sql` with `psql` before running this version. It is plain SQL, not a drizzle-kit migration, and safe to run twice.
