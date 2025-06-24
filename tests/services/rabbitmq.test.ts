import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import rabbitmq from '$services/rabbitmq';
import type { RabbitMQMessage } from '$types';

const { assertExchange, publish, waitForConfirms, assertQueue, bindQueue, consume, close } =
	vi.hoisted(() => ({
		assertExchange: vi.fn(),
		assertQueue: vi.fn(),
		bindQueue: vi.fn(),
		publish: vi.fn().mockReturnValue(true),
		waitForConfirms: vi.fn(),
		consume: vi.fn(),
		ack: vi.fn(),
		nack: vi.fn(),
		on: vi.fn(),
		close: vi.fn()
	}));

const { createConfirmChannelMock } = vi.hoisted(() => ({
	createConfirmChannelMock: vi.fn(() => ({
		assertExchange,
		assertQueue,
		bindQueue,
		publish,
		waitForConfirms,
		consume,
		ack: vi.fn(),
		nack: vi.fn(),
		on: vi.fn(),
		close
	}))
}));

const { connectionCloseMock } = vi.hoisted(() => ({
	connectionCloseMock: vi.fn()
}));

const { connectionMock } = vi.hoisted(() => ({
	connectionMock: vi.fn().mockReturnValue({
		createConfirmChannel: createConfirmChannelMock,
		on: vi.fn(),
		close: connectionCloseMock
	})
}));

vi.mock('amqplib', () => ({
	default: {
		connect: connectionMock
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		RABBITMQ_URL: 'amqp://localhost'
	}
}));

vi.mock('$services/logger', () => ({
	default: {
		getSubLogger: () => ({
			info: vi.fn(),
			error: vi.fn(),
      warn: vi.fn(),
		})
	}
}));

describe('the RabbitMQ Service', () => {
	beforeAll(async () => {
		await rabbitmq.init();
	});

	describe('the init function', () => {
		it('should initialize connection and channel', async () => {
			expect(connectionMock).toHaveBeenCalledOnce();
			expect(createConfirmChannelMock).toHaveBeenCalledOnce();
		});
	});

	describe('the publish function', () => {
		it('should assert and publish a message to an exchange', async () => {
			await rabbitmq.publish('settings', 'routingKey', 'message');

			expect(createConfirmChannelMock).toHaveBeenCalledOnce();
			expect(assertExchange).toHaveBeenCalledWith('settings', 'topic', {
				durable: true
			});
			expect(publish).toHaveBeenCalledWith(
				'settings',
				'routingKey',
				Buffer.from(JSON.stringify('message')),
				{
					persistent: true
				}
			);
			expect(waitForConfirms).toHaveBeenCalledOnce();
		});

		it('should throw an error if the message is not published', async () => {
			publish.mockReturnValueOnce(false);

			await expect(rabbitmq.publish('settings', 'routingKey', 'message')).rejects.toThrow(
				'Message not accepted'
			);
		});

		it('should throw an error if something wrong happened when publishing the message', async () => {
			publish.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			await expect(rabbitmq.publish('settings', 'routingKey', 'message')).rejects.toThrow(
				'Something went wrong'
			);
		});
	});

	describe('the subscribe function', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

		it('should assert and bind a queue to an exchange', async () => {
			const callback = vi.fn();
			await rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback);

			expect(assertExchange).toHaveBeenCalledWith('settings', 'topic', {
				durable: true
			});
			expect(assertQueue).toHaveBeenLastCalledWith('test-queue', {
				durable: true,
				deadLetterExchange: 'settings.dlx',
				deadLetterRoutingKey: 'routingKey.dead'
			});
			expect(bindQueue).toHaveBeenCalledWith('test-queue', 'settings', 'routingKey');
			expect(consume).toHaveBeenCalledWith('test-queue', expect.anything(), { noAck: false });
		});

		it('should assert and bind a queue to the DLQ exchange', async () => {
			const callback = vi.fn();
			await rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback);

			expect(assertExchange).toHaveBeenNthCalledWith(1, 'settings.dlx', 'topic', {
				durable: true
			});
			expect(assertQueue).toHaveBeenNthCalledWith(1, 'test-queue.dlq', {
				durable: true
			});
			expect(bindQueue).toHaveBeenNthCalledWith(
				1,
				'test-queue.dlq',
				'settings.dlx',
				'routingKey.dead'
			);
		});

		it('should throw an error if it fails to assert an exchange', async () => {
			assertExchange.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			const callback = vi.fn();
			await expect(
				rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback)
			).rejects.toThrow('Failed to subscribe to queue');
		});

		it('should throw an error if it fails to assert a queue', async () => {
			assertQueue.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			const callback = vi.fn();
			await expect(
				rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback)
			).rejects.toThrow('Failed to subscribe to queue');
		});

		it('should throw an error if it fails bind a queue', async () => {
			bindQueue.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			const callback = vi.fn();
			await expect(
				rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback)
			).rejects.toThrow('Failed to subscribe to queue');
		});

		it('should throw an error if it fails to consume a message', async () => {
			consume.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			const callback = vi.fn();
			await expect(
				rabbitmq.subscribe('settings', 'routingKey', 'test-queue', callback)
			).rejects.toThrow('Failed to subscribe to queue');
		});

		it('should call the handler when consuming a message', async () => {
			const spyHandler = vi.fn().mockImplementationOnce((_message: RabbitMQMessage) => {});

			consume.mockImplementationOnce((_queue, handler) => {
				handler({
					content: Buffer.from(JSON.stringify('message'))
				});
			});

			await rabbitmq.subscribe('settings', 'routingKey', 'test-queue', spyHandler);

			expect(spyHandler).toHaveBeenCalledWith('message');
		});

		it('should attempt to keep calling the handler ( multiple retry times ) if it fails', async () => {
			const spyHandler = vi.fn().mockImplementationOnce((_message: RabbitMQMessage) => {
				throw new Error('Something went wrong');
			});

			consume.mockImplementationOnce(async (_queue, handler) => {
				await handler({
					content: Buffer.from(JSON.stringify('message'))
				});
			});

			await rabbitmq.subscribe('settings', 'routingKey', 'test-queue', spyHandler);
			await new Promise((resolve) => setTimeout(resolve, 1000));

			expect(spyHandler).toHaveBeenCalled();
			expect(spyHandler).not.toHaveBeenCalledOnce();
		});
	});

	describe('the close functin', () => {
		it('should attempt to close the channel and connection', async () => {
			await rabbitmq.close();

			expect(close).toHaveBeenCalledOnce();
			expect(connectionCloseMock).toHaveBeenCalledOnce();
		});

		it('should throw an error if it fails to close the channel', async () => {
			close.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			await expect(rabbitmq.close()).rejects.toThrow('Failed to close connection');
		});

		it('should throw an error if it fails to close the connection', async () => {
			connectionCloseMock.mockImplementationOnce(() => {
				throw new Error('Something went wrong');
			});

			await expect(rabbitmq.close()).rejects.toThrow('Failed to close connection');
		});
	});
});
