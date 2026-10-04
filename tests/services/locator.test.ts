import { beforeEach, describe, expect, it, vi } from 'vitest';
import locatorService from '$services/locator';
import { workplaceLocatorTable } from '$db/schema';

const { mockSubscribe, mockInsert, mockValues, mockOnConflictDoUpdate } = vi.hoisted(() => ({
	mockSubscribe: vi.fn(),
	mockInsert: vi.fn(),
	mockValues: vi.fn(),
	mockOnConflictDoUpdate: vi.fn()
}));

vi.mock('$services/rabbitmq', () => ({
	default: {
		subscribe: mockSubscribe
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		RABBITMQ_AUTH_EXCHANGE: 'auth-exchange',
		RABBITMQ_USER_CREATED_ROUTING_KEY: 'created-key',
		RABBITMQ_LOCATOR_QUEUE: 'locator-queue'
	}
}));

vi.mock('$db', () => ({
	db: {
		insert: mockInsert.mockImplementation(() => ({
			values: mockValues.mockImplementation(() => ({
				onConflictDoUpdate: mockOnConflictDoUpdate
			}))
		}))
	}
}));

vi.mock('$services/logger', () => ({
	default: {
		getSubLogger: () => ({
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn()
		})
	}
}));

const subscribedHandler = async (): Promise<(m: unknown) => Promise<void>> => {
	await locatorService.init();

	return mockSubscribe.mock.calls.at(-1)?.[3] as (m: unknown) => Promise<void>;
};

describe('Locator service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockOnConflictDoUpdate.mockResolvedValue(undefined);
	});

	describe('the init function', () => {
		it('should subscribe to user.created on its own queue', async () => {
			await locatorService.init();

			expect(mockSubscribe).toHaveBeenCalledWith(
				'auth-exchange',
				'created-key',
				'locator-queue',
				expect.any(Function)
			);
		});

		it('should throw an error if subscribe fails', async () => {
			mockSubscribe.mockRejectedValueOnce(new Error('fail'));

			await expect(locatorService.init()).rejects.toThrow('Failed to initialize locator service');
		});
	});

	describe('the user.created handler', () => {
		it('should store the workplace address keyed by the lowercased email', async () => {
			const handle = await subscribedHandler();

			await handle({
				twakeId: 'alice',
				internalEmail: 'Alice@Example.COM',
				workplaceFqdn: 'alice.twake.app'
			});

			expect(mockInsert).toHaveBeenCalledWith(workplaceLocatorTable);
			expect(mockValues).toHaveBeenCalledWith({
				email: 'alice@example.com',
				workplaceFqdn: 'alice.twake.app'
			});
			expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
				target: workplaceLocatorTable.email,
				set: { workplaceFqdn: 'alice.twake.app' }
			});
		});

		it.each([
			['internalEmail', { workplaceFqdn: 'alice.twake.app' }],
			['workplaceFqdn', { internalEmail: 'alice@example.com' }],
			['an empty workplaceFqdn', { internalEmail: 'alice@example.com', workplaceFqdn: '' }]
		])('should acknowledge a message without %s and store nothing', async (_, message) => {
			const handle = await subscribedHandler();

			await expect(handle(message)).resolves.toBeUndefined();
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it('should rethrow a database failure so the message is retried', async () => {
			const handle = await subscribedHandler();
			mockOnConflictDoUpdate.mockRejectedValueOnce(new Error('db down'));

			await expect(
				handle({ internalEmail: 'alice@example.com', workplaceFqdn: 'alice.twake.app' })
			).rejects.toThrow('db down');
		});
	});
});
