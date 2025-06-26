import { describe, it, expect, beforeEach, vi } from 'vitest';

import { POST } from '$src/routes/api/admin/user/settings/sync/+server';

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

describe('POST /api/admin/user/settings/sync', () => {
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

	it('should call synchronizeSettings and return 200', async () => {
		mockSynchronizeSettings.mockResolvedValue(undefined);

		const event: any = makeRequestEvent({
			user: 'XXX',
			usernameParam: validUsername,
			body: {}
		});

		const response = await POST(event);

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(mockSynchronizeSettings).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});
});
