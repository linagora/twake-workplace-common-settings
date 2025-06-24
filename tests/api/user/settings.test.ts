import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '$src/routes/api/user/settings/+server';

const { mockGetUserSettings } = vi.hoisted(() => ({
	mockGetUserSettings: vi.fn()
}));

vi.mock('$lib/services/settings', () => ({
	default: {
		getUserSettings: mockGetUserSettings
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

describe('GET /api/user/settings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return 401 if unauthorized', async () => {
		const event: any = {
			locals: {
				user: null
			}
		};

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 401));
	});

	it('should return 404 if no settings were found for the user', async () => {
		const event: any = {
			locals: {
				user: {
					id: '123'
				}
			}
		};

		mockGetUserSettings.mockResolvedValue(null);

		await expect(GET(event)).rejects.toThrow(expect.toSatisfy((err) => err.status === 404));
	});

	it('should return the user settings', async () => {
		const settings = {
			nickname: '123',
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

		const event: any = {
			locals: {
				user: {
					id: '123'
				}
			}
		};

		mockGetUserSettings.mockResolvedValue(settings);

		const response = await GET(event);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(settings);
	});
});
