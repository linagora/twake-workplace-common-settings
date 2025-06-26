import { describe, it, expect, beforeEach, vi } from 'vitest';

import { POST } from '$src/routes/api/admin/user/settings/sync/[username]/+server';

const validUsername = 'validUser';
const {
	mockGetUserSettings,
	mockUpdateUserSettings,
	mockSendSettingsUpdateNotification,
	mockCreateUserSettings,
	mockSynchronizeSettings
} = vi.hoisted(() => ({
	mockGetUserSettings: vi.fn(),
	mockUpdateUserSettings: vi.fn(),
	mockSendSettingsUpdateNotification: vi.fn(),
	mockCreateUserSettings: vi.fn(),
	mockSynchronizeSettings: vi.fn()
}));

vi.mock('$lib/services/settings', () => ({
	default: {
		getUserSettings: mockGetUserSettings,
		updateUserSettings: mockUpdateUserSettings,
		sendSettingsUpdateNotification: mockSendSettingsUpdateNotification,
		createUserSettings: mockCreateUserSettings,
		synchronizeSettings: mockSynchronizeSettings
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

describe('POST /api/admin/user/settingssync/:username', () => {
	it('should return 401 if user is not logged in', async () => {
		const event: any = makeRequestEvent({ user: undefined, usernameParam: validUsername });

		await expect(POST(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
	});

	it('should return 400 if username is not provided', async () => {
		const event: any = makeRequestEvent({ user: validUsername, usernameParam: undefined });

		await expect(POST(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 400));
	});

	it('should call the SendSettingsUpdateNotification method', async () => {
		const event: any = makeRequestEvent({
			user: validUsername,
			usernameParam: validUsername,
			body: { settings: { sync: true } }
		});

		const response = await POST(event);

		expect(mockSendSettingsUpdateNotification).toHaveBeenCalledWith(validUsername);

		expect(response.status).toBe(200);
	});
});
