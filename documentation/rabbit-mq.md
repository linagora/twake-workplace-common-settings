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
		"display_name": "John Doe"
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
| `version`    | integer | Version of the message or schema used.                       |
| `payload`    | object  | Actual user settings to be updated.                          |

### the payload object:

| Field          | Type   | Description                                       |
| -------------- | ------ | ------------------------------------------------- |
| `language`     | string | User's preferred language (e.g., `"en"`, `"fr"`). |
| `timezone`     | string | IANA timezone string (e.g., `"Europe/Paris"`).    |
| `avatar`       | string | URL to user's avatar image.                       |
| `last_name`    | string | User's last name.                                 |
| `first_name`   | string | User's first name.                                |
| `email`        | string | User's email address.                             |
| `phone`        | string | User's phone number in international format.      |
| `matrix_id`    | string | User's Matrix ID.                                 |
| `display_name` | string | Full display name to show in UIs.                 |

## Expected Consumer Behavior

- Each application declares and binds a quorum queue.
- Check version for compatibility.
- Respect optimistic concurrency using the version field if applicable.
