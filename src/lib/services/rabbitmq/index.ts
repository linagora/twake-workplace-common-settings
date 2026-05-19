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

	public init = (): Promise<void> => this.client.init();

	public publish = (exchange: string, routingKey: string, message: object): Promise<void> =>
		this.client.publish(exchange, routingKey, message as RabbitMQMessage);

	public subscribe = (
		exchange: string,
		routingKey: string,
		queue: string,
		handler: RabbitMQMessageHandler
	): Promise<void> => this.client.subscribe(exchange, routingKey, queue, handler);

	public close = (): Promise<void> => this.client.close();
}

export default new RabbitMQService();
