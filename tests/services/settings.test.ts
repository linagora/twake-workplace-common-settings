import { beforeEach, describe, expect, it, vi } from 'vitest';
import settingsService from '$services/settings';
import type { SettingsMessage, UserSettingsResponse } from '$types';

const { mockFindFirst, mockInsertValues, mockUpdateSet, mockSubscribe, mockPublish } = vi.hoisted(
	() => ({
		mockFindFirst: vi.fn(),
		mockInsertValues: vi.fn(),
		mockUpdateSet: vi.fn(),
		mockSubscribe: vi.fn(),
		mockPublish: vi.fn()
	})
);

vi.mock('$services/rabbitmq', () => ({
	default: {
		subscribe: mockSubscribe,
		publish: mockPublish
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		RABBITMQ_EXCHANGE: 'exchange',
		RABBITMQ_SETTINGS_INPUT_QUEUE: 'queue',
		RABBITMQ_SETTINGS_INPUT_ROUTING_KEY: 'inKey',
		RABBITMQ_SETTINGS_OUTPUT_ROUTING_KEY: 'outKey'
	}
}));

vi.mock('$db', () => {
	return {
		db: {
			query: {
				userSettingsTable: {
					findFirst: mockFindFirst
				}
			},
			insert: vi.fn(() => ({
				values: mockInsertValues
			})),
			update: vi.fn(() => ({
				set: mockUpdateSet
			}))
		}
	};
});

vi.mock('$services/logger', () => ({
	default: {
		getSubLogger: () => ({
			info: vi.fn(),
			error: vi.fn()
		})
	}
}));

vi.mock('$utils/config', () => ({
	DEFAULT_RABBITMQ_EXCHANGE: 'exchange',
	DEFAULT_SETTINGS_INPUT_QUEUE: 'queue',
	DEFAULT_SETTINGS_INPUT_ROUTING_KEY: 'inKey',
	DEFAULT_SETTINGS_OUTPUT_ROUTING_KEY: 'outKey',
	EDITABLE_USER_SETTINGS: ['language', 'timezone', 'avatar', 'display_name']
}));

vi.mock('$lib/schemas/user-settings', async () => {
	const actual = await vi.importActual('$lib/schemas/user-settings');
	return {
		updateUserSettingsSchema: actual.updateUserSettingsSchema,
		createUserSettingsSchema: actual.createUserSettingsSchema
	};
});

describe('Settings service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('the init function', () => {
		it('should subscribe to RabbitMQ', async () => {
			await settingsService.init();
			expect(mockSubscribe).toHaveBeenCalledWith(
				'exchange',
				'inKey',
				'queue',
				expect.any(Function)
			);
		});

		it('should throw an error if subscribe fails', async () => {
			mockSubscribe.mockImplementationOnce(() => {
				throw new Error('fail');
			});
			await expect(settingsService.init()).rejects.toThrow('Failed to initialize settings service');
		});
	});

	describe('the getUserSettings method', () => {
		it('should return the user settings when found', async () => {
			mockFindFirst.mockResolvedValue({
				nickname: 'testuser',
				version: 2,
				settings: {
					language: 'en',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					matrix_id: null,
					display_name: 'John Doe'
				}
			});

			const result = await settingsService.getUserSettings('testuser');

			expect(result).toEqual({
				nickname: 'testuser',
				version: 2,
				language: 'en',
				timezone: 'UTC',
				avatar: 'https://example.com/avatar.png',
				last_name: 'Doe',
				first_name: 'John',
				email: 'john@example.com',
				phone: '+1234567890',
				matrix_id: null,
				display_name: 'John Doe'
			});
		});

		it('should return null when not found or something wrong happens', async () => {
			mockFindFirst.mockImplementationOnce(() => {
				throw new Error('db error');
			});

			const result = await settingsService.getUserSettings('testuser');

			expect(result).toBeNull();
		});
	});

	describe('the createUserSettings method', () => {
		it('should inserts settings into DB', async () => {
      mockFindFirst.mockResolvedValue(undefined);
			mockInsertValues.mockResolvedValue(undefined);

			const payload = {
				language: 'en',
				timezone: 'UTC',
				avatar: 'https://example.com/avatar.png',
				last_name: 'Doe',
				first_name: 'John',
				email: 'john@example.com',
				phone: '+1234567890',
				matrix_id: null,
				display_name: 'John Doe'
			};

			await settingsService.createUserSettings('testuser', payload, 1);

			expect(mockInsertValues).toHaveBeenCalledWith({
				nickname: 'testuser',
				settings: payload,
				version: 1
			});
		});

		it('should throw an error if something wrong happens', async () => {
			mockInsertValues.mockRejectedValue(new Error('insert fail'));

			await expect(settingsService.createUserSettings('testuser', {} as any, 1)).rejects.toThrow();
		});

    it('should throw an error if the user already has settings', async () => {
      mockFindFirst.mockResolvedValue({
        nickname: 'testuser',
        version: 1,
        settings: {
          language: 'en',
          timezone: 'UTC',
          avatar: 'https://example.com/avatar.png',
          last_name: 'Doe',
          first_name: 'John',
          email: 'john@example.com',
          phone: '+1234567890',
          matrix_id: null,
          display_name: 'John Doe'
        }
      });

      await expect(settingsService.createUserSettings('testuser', {} as any, 1)).rejects.toThrow();
    })
	});

	describe('the updateUserSettings method', () => {
		it('should update the user settings when the payload is valid', async () => {
			mockFindFirst.mockResolvedValue({
				nickname: 'testuser',
				version: 1,
				settings: {
					language: 'en',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					display_name: 'John Doe'
				}
			});

			mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

			const message: SettingsMessage = {
				source: 'test',
				nickname: 'testuser',
				request_id: 'req1',
				timestamp: Date.now(),
				version: 2,
				payload: {
					language: 'fr'
				}
			};

			await settingsService.updateUserSettings('testuser', message);

			expect(mockUpdateSet).toHaveBeenCalledWith({
				settings: {
					language: 'fr',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					display_name: 'John Doe'
				},
				version: 2
			});
		});

		it('should throw an error if user settings are not found', async () => {
			mockFindFirst.mockResolvedValue(null);

			const message: SettingsMessage = {
				source: 'test',
				nickname: 'testuser',
				request_id: 'req1',
				timestamp: Date.now(),
				version: 2,
				payload: {
					language: 'fr'
				}
			};

			await expect(settingsService.updateUserSettings('testuser', message)).rejects.toThrow();
		});

		it('should throw an error if version not higher than acutal settings version', async () => {
			mockFindFirst.mockResolvedValue({
				nickname: 'testuser',
				version: 3,
				settings: {
					language: 'en',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					matrix_id: '@user:example.com',
					display_name: 'John Doe'
				}
			});

			const message: SettingsMessage = {
				source: 'test',
				nickname: 'testuser',
				request_id: 'req1',
				timestamp: Date.now(),
				version: 2,
				payload: {
					language: 'fr'
				}
			};

			await expect(settingsService.updateUserSettings('testuser', message)).rejects.toThrow();
		});

		it('should ignore unmodifiable or extra unknown fields', async () => {
			mockFindFirst.mockResolvedValue({
				nickname: 'testuser',
				version: 1,
				settings: {
					language: 'en',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					matrix_id: '@user:example.com',
					display_name: 'John Doe'
				}
			});

			mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

			const message = {
				source: 'test',
				nickname: 'testuser',
				request_id: 'XXXX',
				timestamp: Date.now(),
				version: 2,
				payload: {
					language: 'fr',
					unknown_field: 'unknown',
					display_name: 'John Doe'
				}
			};

			await settingsService.updateUserSettings('testuser', message);

			expect(mockUpdateSet).toHaveBeenCalledWith({
				settings: {
					language: 'fr',
					timezone: 'UTC',
					avatar: 'https://example.com/avatar.png',
					last_name: 'Doe',
					first_name: 'John',
					email: 'john@example.com',
					phone: '+1234567890',
					matrix_id: '@user:example.com',
					display_name: 'John Doe'
				},
				version: 2
			});
		});
	});

	describe('broadcastUserSettingsUpdateNotification', () => {
		it('should publish the updated settings in rabbitMQ', async () => {
			const payload: UserSettingsResponse = {
				nickname: 'testuser',
				version: 2,
				language: 'en',
				timezone: 'UTC',
				avatar: 'https://example.com/avatar.png',
				last_name: 'Doe',
				first_name: 'John',
				email: 'john@example.com',
				phone: '+1234567890',
				matrix_id: null,
				display_name: 'John Doe'
			};

			mockPublish.mockResolvedValue(undefined);

			await settingsService.broadcastUserSettingsUpdateNotification('testuser', payload);

			expect(mockPublish).toHaveBeenCalledWith(
				'exchange',
				'outKey',
				expect.objectContaining({
					nickname: 'testuser',
					payload,
					source: expect.any(String),
					request_id: expect.any(String),
					version: 2
				})
			);
		});

		it('should throw an error if publishfails ', async () => {
			mockPublish.mockRejectedValue(new Error('publish fail'));

			const payload: UserSettingsResponse = {
				nickname: 'testuser',
				version: 2,
				language: 'en',
				timezone: 'UTC',
				avatar: 'https://example.com/avatar.png',
				last_name: 'Doe',
				first_name: 'John',
				email: 'john@example.com',
				phone: '+1234567890',
				matrix_id: null,
				display_name: 'John Doe'
			};

			await expect(
				settingsService.broadcastUserSettingsUpdateNotification('testuser', payload)
			).rejects.toThrow();
		});
	});

	describe('the sendSettingsUpdateNotification method', () => {
		it('should not throw an error if user settings are not found', async () => {
			mockFindFirst.mockResolvedValue(null);

			await expect(
				settingsService.sendSettingsUpdateNotification('testuser')
			).resolves.toBeUndefined();
		});
	});
});
