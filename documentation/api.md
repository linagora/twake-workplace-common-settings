---
# 📘 User Settings API

These admin endpoints allow authenticated services (with a static Bearer token) to **create**, **retrieve**, and **update** common settings for a specific user.
---

## Authentication

All admin endpoints require a **Bearer token** to be included in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

---

## Base Path

```
/api/admin/user/settings
```

---

## POST `/api/admin/user/settings`

Create new user settings.

### Request Body

```json
{
	"source": "admin-panel",
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
		"theme": "dark"
	}
}
```

### Response

- **200 OK** – Successfully created
- **400 Bad Request** – Invalid data
- **401 Unauthorized** – Missing or invalid token
- **500 Internal Server Error** - something wrong happaned

---

## GET `/api/admin/user/settings/:userId`

Fetch the settings of a specific user as an internal service ( admin API )

### Path Parameters

| Param  | Type   | Description             |
| ------ | ------ | ----------------------- |
| userId | string | The username (nickname) |

### Response

- **200 OK** – Returns user settings:

```json
{
	"nickname": "johndoe",
	"version": 1,
	"language": "en",
	"timezone": "Europe/Paris",
	"avatar": "https://example.com/avatar.png",
	"last_name": "Doe",
	"first_name": "John",
	"email": "john.doe@example.com",
	"phone": "+33612345678",
	"matrix_id": "@johndoe:matrix.org",
	"display_name": "John Doe",
	"theme": "dark"
}
```

- **400 Bad Request** – Invalid or missing username
- **401 Unauthorized** – Missing or invalid token
- **404 Not Found** – Settings not found
- **500 Internal Server Error** - something wrong happaned

---

## PUT `/api/admin/user/settings/:userId`

Update settings for an existing user.

### Path Parameters

| Param  | Type   | Description             |
| ------ | ------ | ----------------------- |
| userId | string | The username (nickname) |

### Request Body

Partial `payload` is accepted. All other fields (`source`, `nickname`, `request_id`, `timestamp`, `version`) are **required**.

```json
{
	"source": "admin-panel",
	"nickname": "johndoe",
	"request_id": "req_0987654321",
	"timestamp": 1718897400000,
	"version": 2,
	"payload": {
		"timezone": "America/New_York",
		"avatar": "https://example.com/new-avatar.png"
	}
}
```

At least one field inside `payload` must be provided. A field left out keeps its stored value.

### Response

- **200 OK** – Successfully updated
- **400 Bad Request** – Invalid data or missing username
- **401 Unauthorized** – Missing or invalid token
- **500 Internal Server Error** - something wrong happaned

## GET `/api/user/settings`

Fetch the user settings using an access token

### Authentication

requires a **Bearer token** to be included in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

the `access_token` is an OIDC access token. The service sends it to the identity provider's `/oauth2/userinfo` and reads the settings of the user whose `nickname` equals the returned `sub`. It does not check the token audience.

The service sends no CORS headers.

### Response

- **200 OK** – Returns user settings:

```json
{
	"nickname": "johndoe",
	"version": 1,
	"language": "en",
	"timezone": "Europe/Paris",
	"avatar": "https://example.com/avatar.png",
	"last_name": "Doe",
	"first_name": "John",
	"email": "john.doe@example.com",
	"phone": "+33612345678",
	"matrix_id": "@johndoe:matrix.org",
	"display_name": "John Doe",
	"theme": "dark"
}
```

- **401 Unauthorized** – Missing or invalid token
- **404 Not Found** – Settings not found
- **500 Internal Server Error** - something wrong happaned

---

## POST `/api/admin/user/settings/sync`

Synchronize all users settings with all apps by publishing update messages to RabbitMQ ( admin API )

### Response

- **200 OK** - the job started
- **400 Bad Request** – Invalid or missing username
- **401 Unauthorized** – Missing or invalid token
- **500 Internal Server Error** - something wrong happaned

---

## POST `/api/admin/user/settings/sync/:userId`

Synchronize specific user settings with all apps by publishing update messages to RabbitMQ ( admin API )

### Path Parameters

| Param  | Type   | Description             |
| ------ | ------ | ----------------------- |
| userId | string | The username (nickname) |

### Response

- **200 OK** - the settings were synchronized
- **400 Bad Request** – Invalid or missing username
- **401 Unauthorized** – Missing or invalid token
- **500 Internal Server Error** - something wrong happaned

---

## GET `/api/admin/locator/:email`

Look up the workplace address of a user by email ( admin API ). The match ignores case.

### Path Parameters

| Param | Type   | Description                   |
| ----- | ------ | ----------------------------- |
| email | string | The user's email, URL encoded |

### Response

- **200 OK** – Returns the workplace address:

```json
{
	"workplaceFqdn": "alice.twake.app"
}
```

- **400 Bad Request** – Invalid email
- **401 Unauthorized** – Missing or invalid token
- **404 Not Found** – No workplace address for this email
- **500 Internal Server Error** - something wrong happaned

---

## 📘 Notes

- The `version` must be incremented appropriately when updating.
- The `nickname` must pass custom twake validation.
- `phone` number must be in the `E.164` format
- `language` must be in the `ISO 639-1` format
- `theme` is optional and must be `light`, `dark` or `auto`
