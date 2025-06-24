import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

import { GET, PUT } from '$src/routes/api/admin/user/settings/[username]/+server';
import { POST } from '$src/routes/api/admin/user/settings/+server';

const validUsername = 'validUser';
const {
	mockGetUserSettings,
	mockUpdateUserSettings,
	mockSendSettingsUpdateNotification,
	mockCreateUserSettings
} = vi.hoisted(() => ({
	mockGetUserSettings: vi.fn(),
	mockUpdateUserSettings: vi.fn(),
	mockSendSettingsUpdateNotification: vi.fn(),
	mockCreateUserSettings: vi.fn()
}));

vi.mock('$lib/services/settings', () => ({
	default: {
		getUserSettings: mockGetUserSettings,
		updateUserSettings: mockUpdateUserSettings,
		sendSettingsUpdateNotification: mockSendSettingsUpdateNotification,
		createUserSettings: mockCreateUserSettings
	}
}));

vi.mock('$services/logger', () => ({
	default: {
		getSubLogger: () => ({
			info: vi.fn(),
			error: vi.fn()
		})
	}
}));

function makeRequestEvent({
	user,
	usernameParam,
	body
}: {
	user?: string;
	usernameParam?: string;
	body?: any;
}) {
	const locals: any = {};
	if (user !== undefined) {
		locals.user = user;
	}

	const params: any = {};
	if (usernameParam !== undefined) {
		params.username = usernameParam;
	}

	const request: any = {
		json: async () => {
			return body;
		},

		get body() {
			return body !== undefined ? {} : null;
		}
	};

	return { locals, params, request };
}

beforeAll(() => {});

describe('GET /api/admin/user/settings/:username', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 if unauthorized', async () => {
		const event: any = makeRequestEvent({ user: undefined, usernameParam: validUsername });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
	});

	it('should return 400 if invalid username', async () => {
		const event: any = makeRequestEvent({ user: 'API', usernameParam: '-invalid' });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should return 404 if settings not found', async () => {
		mockGetUserSettings.mockResolvedValue(null);
		const event: any = makeRequestEvent({ user: 'API', usernameParam: validUsername });

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 404));
	});

	it('should return the user settings', async () => {
		const settings = {
			nickname: validUsername,
			version: 1,
			language: 'en',
			timezone: 'UTC',
			avatar: 'https://example.com/avatar.png',
			last_name: 'Doe',
			first_name: 'John',
			email: 'john@example.com',
			phone: '+1234567890',
			matrix_id: '@user:server.com',
			display_name: 'John Doe'
		};

		mockGetUserSettings.mockResolvedValue(settings);

		const event: any = makeRequestEvent({ user: 'API', usernameParam: validUsername });
		const response = await GET(event);
		const data = await (response as Response).json();

		expect(data).toEqual(settings);
	});
});

describe('PUT /api/admin/user/settings/:username', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 if unauthorized', async () => {
		const event: any = makeRequestEvent({
			user: undefined,
			usernameParam: validUsername,
			body: {}
		});

		await expect(PUT(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
	});

	it('should return 400 if missing username', async () => {
		const event: any = makeRequestEvent({ user: 'API', usernameParam: undefined, body: {} });

		await expect(PUT(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should return 400 if invalid username', async () => {
		const event: any = makeRequestEvent({ user: 'API', usernameParam: '-invalid', body: {} });

		await expect(PUT(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should return 400 if body invalid JSON', async () => {
		const event: any = makeRequestEvent({
			user: 'API',
			usernameParam: validUsername,
			body: '<hello />'
		});

		await expect(PUT(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('returns 400 if schema validation fails', async () => {
		const event: any = makeRequestEvent({
			user: 'API',
			usernameParam: validUsername,
			body: { foo: 'bar' }
		});

		await expect(PUT(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should call updateUserSettings and sendSettingsUpdateNotification on success', async () => {
		mockUpdateUserSettings.mockResolvedValue(undefined);
		mockSendSettingsUpdateNotification.mockResolvedValue(undefined);

		const body = {
			source: 'test',
			nickname: validUsername,
			request_id: 'req1',
			timestamp: Date.now(),
			version: 2,
			payload: { language: 'fr' }
		};

		const event: any = makeRequestEvent({ user: 'API', usernameParam: validUsername, body });
		const response = await PUT(event);

		expect(mockUpdateUserSettings).toHaveBeenCalledWith(validUsername, body);
		expect(mockSendSettingsUpdateNotification).toHaveBeenCalledWith(validUsername);

		const text = await (response as Response).text();
		expect(text).toBe('ok');
		expect(response.status).toBe(200);
	});
});

describe('POST /api/admin/user/settings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 if unauthorized', async () => {
		const event: any = makeRequestEvent({
			user: undefined,
			usernameParam: validUsername,
			body: {}
		});

		await expect(POST(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
	});

	it('should return 400 if missing body', async () => {
		const event: any = makeRequestEvent({ user: 'XXX', usernameParam: validUsername });

		await expect(POST(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should return 400 if invalid JSON body', async () => {
		const event: any = makeRequestEvent({
			user: 'XXX',
			usernameParam: validUsername,
			body: '<hello />'
		});

		await expect(POST(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should return 400 if schema validation fails', async () => {
		const body = { foo: 'bar' };
		const event: any = makeRequestEvent({ user: 'XXX', usernameParam: validUsername, body });

		await expect(POST(event)).rejects.toThrow();
	});

	it('should call createUserSettings and sendSettingsUpdateNotification if payload is valid', async () => {
		const validBody = {
			source: 'provision',
			nickname: validUsername,
			request_id: 'req1',
			timestamp: Date.now(),
			version: 1,
			payload: {
				language: 'en',
				timezone: 'UTC',
				avatar: 'https://example.com/avatar.png',
				last_name: 'Doe',
				first_name: 'John',
				email: 'john@example.com',
				phone: '+33700000001',
				matrix_id: '@user:server.com',
				display_name: 'John Doe'
			}
		};

		mockCreateUserSettings.mockResolvedValue(undefined);
		mockSendSettingsUpdateNotification.mockResolvedValue(undefined);

		const event: any = makeRequestEvent({
			user: 'XXX',
			usernameParam: validUsername,
			body: validBody
		});

		const response = await POST(event);

		expect(mockCreateUserSettings).toHaveBeenCalledWith(
			validUsername,
			validBody.payload,
			validBody.version
		);

		expect(mockSendSettingsUpdateNotification).toHaveBeenCalledWith(validUsername);

		const text = await (response as Response).text();
		expect(text).toBe('ok');
	});
});
