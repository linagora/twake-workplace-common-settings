import { RabbitMQClient } from '@linagora/rabbitmq-client';
import type { RabbitMQMessage, RabbitMQMessageHandler } from '@linagora/rabbitmq-client';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import LoggerService, { type GenericLogger } from '$services/logger';
import {
	DEFAULT_RABBITMQ_CONNECTION_RETRY_DELAY,
	DEFAULT_RABBITMQ_MAX_RETRIES,
	DEFAULT_RABBITMQ_RETRY_DELAY,
	DEFAULT_RABBITMQ_URL
} from '$utils/config';

class RabbitMQService {
	public readonly name = 'rabbitmq';
	private logger: GenericLogger;
	private client: RabbitMQClient;

	/**
	 * @constructor
	 *
	 * rabbitmq service constructor
	 */
	constructor() {
		this.logger = LoggerService.getSubLogger({ name: this.name });

		if (!env.RABBITMQ_URL) {
			this.logger.fatal('RABBITMQ_URL is not set');

			if (!building) {
				throw new Error('RABBITMQ_URL is not set');
			}
		}

		this.client = new RabbitMQClient({
			url: env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL,
			maxRetries: parseInt(env.RABBITMQ_MAX_RETRIES) || DEFAULT_RABBITMQ_MAX_RETRIES,
			retryDelay: parseInt(env.RABBITMQ_RETRY_DELAY) || DEFAULT_RABBITMQ_RETRY_DELAY,
			connectionRetryDelay:
				parseInt(env.RABBITMQ_CONNECTION_RETRY_DELAY) || DEFAULT_RABBITMQ_CONNECTION_RETRY_DELAY
		});
	}

	/**
	 * Initializes the rabbitmq service
	 *
	 * @returns {Promise<void>} - resolves once the connection and confirm channel are ready.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.init();
	 * ```
	 */
	public init = (): Promise<void> => this.client.init();

	/**
	 * Publishes a message to an exchange.
	 *
	 * @param {string} exchange - the exchange to publish to.
	 * @param {string} routingKey - the routing key.
	 * @param {object} message - the JSON-serializable message payload.
	 * @returns {Promise<void>} - resolves after the broker confirms the message.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.publish('settings', 'user.settings.updated', { nickname: 'alice' });
	 * ```
	 */
	public publish = (exchange: string, routingKey: string, message: object): Promise<void> =>
		this.client.publish(exchange, routingKey, message as RabbitMQMessage);

	/**
	 * Subscribes to a queue, asserting the DLQ wiring on the way.
	 *
	 * @param {string} exchange - the exchange to bind to.
	 * @param {string} routingKey - the routing key to bind with.
	 * @param {string} queue - the queue to consume from.
	 * @param {RabbitMQMessageHandler} handler - called with each parsed message.
	 * @returns {Promise<void>} - resolves once the consumer is registered.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.subscribe('settings', 'user.settings.update', 'user.settings.input', async (msg) => {
	 *   // ...
	 * });
	 * ```
	 */
	public subscribe = (
		exchange: string,
		routingKey: string,
		queue: string,
		handler: RabbitMQMessageHandler
	): Promise<void> => this.client.subscribe(exchange, routingKey, queue, handler);

	/**
	 * Closes the rabbitmq connection and waits for in-flight handlers to drain.
	 *
	 * @returns {Promise<void>} - resolves once the channel and connection are closed.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.close();
	 * ```
	 */
	public close = (): Promise<void> => this.client.close();
}

export default new RabbitMQService();
