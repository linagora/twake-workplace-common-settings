import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import settingsService from '$services/settings';
import type { SettingsMessage, UserSettingsResponse } from '$types';

const {
	mockFindFirst,
	mockInsertValues,
	mockUpdateSet,
	mockSubscribe,
	mockPublish,
	fromMock,
	whereMock,
	orderByMock,
	limitMock,
	selectMock
} = vi.hoisted(() => ({
	mockFindFirst: vi.fn(),
	mockInsertValues: vi.fn(),
	mockUpdateSet: vi.fn(),
	mockSubscribe: vi.fn(),
	mockPublish: vi.fn(),
	fromMock: vi.fn(),
	whereMock: vi.fn(),
	orderByMock: vi.fn(),
	limitMock: vi.fn(),
	selectMock: vi.fn()
}));

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
			})),
			select: selectMock.mockReturnThis(),
			from: fromMock.mockReturnThis(),
			where: whereMock.mockReturnThis(),
			orderBy: orderByMock.mockReturnThis(),
			limit: limitMock.mockReturnThis()
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
	EDITABLE_USER_SETTINGS: ['language', 'timezone', 'avatar', 'display_name'],
	SYNC_BATCH_SIZE: 5,
	SYNC_PROCESS_DELAY: 500,
	SETTINGS_NOTIFICATION_SOURCE: 'common-settings'
}));

vi.mock('$lib/schemas/user-settings', async () => {
	const actual = await vi.importActual('$lib/schemas/user-settings');
	return {
		updateUserSettingsSchema: actual.updateUserSettingsSchema,
		createUserSettingsSchema: actual.createUserSettingsSchema
	};
});

/**
 * The settings column is now patched with a jsonb merge SQL expression rather
 * than a plain object, so the mocked chain can't be asserted directly. These
 * helpers grab the argument passed to `.set()` and compile it to real SQL so
 * tests can verify which fields are merged and that it's a merge, not an
 * overwrite.
 */
const lastUpdateSet = (): { settings: SQL; version: number } =>
	mockUpdateSet.mock.calls.at(-1)?.[0] as { settings: SQL; version: number };

const compileMerge = (settings: SQL): { sql: string; params: unknown[] } =>
	new PgDialect().sqlToQuery(settings);

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

	describe('the userSettingsExist method', () => {
		it('should return true if the user settings exist', async () => {
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

			const result = await settingsService.userSettingsExist('testuser');

			expect(result).toBe(true);
		});

		it('should return false if the user settings do not exist', async () => {
			mockFindFirst.mockResolvedValue(undefined);

			const result = await settingsService.userSettingsExist('testuser');

			expect(result).toBe(false);
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
		});
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

			mockUpdateSet.mockReturnValue({
				where: vi
					.fn()
					.mockReturnValue({ returning: vi.fn().mockResolvedValue([{ nickname: 'testuser' }]) })
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

			await settingsService.updateUserSettings('testuser', message);

			const setArg = lastUpdateSet();
			// Settings is patched as a jsonb merge against the live row, not a
			// full-blob overwrite built from the earlier read.
			expect(setArg.settings).toBeInstanceOf(SQL);
			expect(setArg.version).toBe(2);

			const { sql, params } = compileMerge(setArg.settings);
			expect(sql).toContain('|| ');
			expect(sql).toContain('::jsonb');
			// Only the changed editable field is merged; untouched fields are left
			// to the database's current value.
			expect(params).toEqual(['{"language":"fr"}']);
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

		it('should throw a conflict when the atomic update affects no rows', async () => {
			// App-level pre-check passes (incoming version 2 > stored 1), but a
			// concurrent writer advances the stored version in the gap before our
			// write, so the conditional UPDATE matches no rows.
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

			mockUpdateSet.mockReturnValue({
				where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) })
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

			mockUpdateSet.mockReturnValue({
				where: vi
					.fn()
					.mockReturnValue({ returning: vi.fn().mockResolvedValue([{ nickname: 'testuser' }]) })
			});

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

			const setArg = lastUpdateSet();
			expect(setArg.settings).toBeInstanceOf(SQL);
			expect(setArg.version).toBe(2);

			// Unknown and non-editable fields are dropped; only the editable fields
			// from the payload end up in the merge.
			const { params } = compileMerge(setArg.settings);
			expect(params).toEqual(['{"language":"fr","display_name":"John Doe"}']);
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

	describe('the synchronizeSettings method', () => {
		it('should batch fetch user settings', async () => {
			limitMock.mockResolvedValue([]);

			await settingsService.synchronizeSettings();

			expect(limitMock).toHaveBeenCalledWith(5);
		});

		it('should batch call the rabbitmq publish method', async () => {
			limitMock.mockResolvedValue([
				{
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
				},
				{
					nickname: 'testuser2',
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
				}
			]);

			await settingsService.synchronizeSettings();

			expect(mockPublish).toHaveBeenCalledTimes(2);
		});

		it('should handle empty results from database', async () => {
			limitMock.mockResolvedValue([]);
			mockPublish.mockResolvedValue(undefined);

			await settingsService.synchronizeSettings();

			expect(mockPublish).not.toHaveBeenCalled();
		});

		it('should continue processing remaining records if publishing one fails', async () => {
			limitMock.mockResolvedValue([
				{
					nickname: 'user1',
					version: 1,
					settings: {
						language: 'en',
						timezone: 'UTC'
					}
				},
				{
					nickname: 'user2',
					version: 2,
					settings: {
						language: 'fr',
						timezone: 'CET'
					}
				}
			]);

			mockPublish
				.mockRejectedValueOnce(new Error('Publish failed'))
				.mockResolvedValueOnce(undefined);

			await settingsService.synchronizeSettings();

			expect(mockPublish).toHaveBeenCalledTimes(2);
		});

		it('should throw an error if something wrong happens', async () => {
			limitMock.mockRejectedValue(new Error('db error'));

			await expect(settingsService.synchronizeSettings()).rejects.toThrow();
		});

		it('should should not throw an error if the message fails to be published', async () => {
			limitMock.mockResolvedValue([
				{
					nickname: 'user1',
					version: 1,
					settings: {
						language: 'en',
						timezone: 'UTC'
					}
				}
			]);

			mockPublish.mockRejectedValue(new Error('db error'));

			await expect(settingsService.synchronizeSettings()).resolves.not.toThrow();
		});
	});
});
