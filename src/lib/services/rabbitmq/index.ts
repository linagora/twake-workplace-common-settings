import amqp from 'amqplib';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import LoggerService, { type GenericLogger } from '$services/logger';
import { DEFAULT_RABBITMQ_MAX_RETRIES, DEFAULT_RABBITMQ_URL } from '$utils/config';
import type { RabbitMQMessage, RabbitMQMessageHandler, Subscription } from '$types';

class RabbitMQService {
	public readonly name = 'rabbitmq';
	private logger: GenericLogger;
	private url: string;
	private readonly exchangeType: string = 'topic';
	private readonly MAX_RETRIES: number;
	private readonly RETRY_DELAY: number;
	private readonly CONNECTION_RETRY_DELAY: number;
	private connection!: amqp.ChannelModel;
	private channel!: amqp.ConfirmChannel;
	private connected: boolean = false;
	private reconnecting: boolean = false;
	private subscriptions: Subscription[] = [];

	/**
	 * @constructor
	 *
	 * rabbitmq service constructor
	 */
	constructor() {
		this.logger = LoggerService.getSubLogger({
			name: this.name
		});

		if (!env.RABBITMQ_URL) {
			this.logger.fatal('RABBITMQ_URL is not set');

			if (!building) {
				throw new Error('RABBITMQ_URL is not set');
			}
		}

		this.url = env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL;
		this.MAX_RETRIES = parseInt(env.RABBITMQ_MAX_RETRIES) || DEFAULT_RABBITMQ_MAX_RETRIES;
		this.RETRY_DELAY = parseInt(env.RABBITMQ_RETRY_DELAY) || DEFAULT_RABBITMQ_MAX_RETRIES;
		this.CONNECTION_RETRY_DELAY =
			parseInt(env.RABBITMQ_CONNECTION_RETRY_DELAY) || DEFAULT_RABBITMQ_MAX_RETRIES;
	}

	/**
	 * Initializes the rabbitmq service
	 *
	 * Retries until successful connection is established
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.init();
	 * ```
	 */
	public init = async () => {
		if (this.connected) {
			return;
		}

		let attempts = 0;
		while (!this.connected) {
			try {
				this.connection = await amqp.connect(this.url);
				this.channel = await this.connection.createConfirmChannel();

				this.connection.on('error', (error) => {
					this.connected = false;
					this.logger.error('Connection error', error);
				});

				this.connection.on('close', (error) => {
					this.connected = false;
					this.logger.warn('Connection closed', error);
					this.reconnectWithRetry();
				});

				this.connected = true;
				this.reconnecting = false;
				this.logger.info('Connected to RabbitMQ');
			} catch (error) {
				attempts++;
				this.connected = false;
				this.logger.warn(`Connection attempt ${attempts} failed, retrying...`, error);
				await new Promise((resolve) => setTimeout(resolve, this.CONNECTION_RETRY_DELAY));
			}
		}
	};

	/**
	 * Publishes a message to an exchange
	 *
	 * @param {string} exchange - the exchange.
	 * @param {string} routingKey - the routingKey to publish the message to.
	 * @param {RabbitMQMessage} message - the message to publish.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.publish('exchange', 'key', { message: 'hello' });
	 * ```
	 */
	public publish = async (
		exchange: string,
		routingKey: string,
		message: RabbitMQMessage
	): Promise<void> => {
		let attempts = 0;

		while (true) {
			try {
				if (!this.connected) {
					await this.reconnectWithRetry();
				}

				await this.channel.assertExchange(exchange, this.exchangeType, { durable: true });

				const published = this.channel.publish(
					exchange,
					routingKey,
					Buffer.from(JSON.stringify(message)),
					{ persistent: true }
				);

				await this.channel.waitForConfirms();

				if (!published) {
					throw new Error('Message not accepted');
				}

				return;
			} catch (error) {
				attempts++;
				this.logger.warn(`Publish attempt ${attempts} failed`, error);
				await new Promise((resolve) => setTimeout(resolve, this.CONNECTION_RETRY_DELAY));
			}
		}
	};

	/**
	 * Subscribes to an exchange and routing key
	 *
	 * @param {string} exchange - the exhange to subscribe to.
	 * @param {string} routingKey - the routing key to subscribe to.
	 * @param {string} queue - the queue to subscribe to.
	 * @param {RabbitMQMessageHandler} handler - the handler to call when a message is received.
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.subscribe('exchange', 'key', 'queue', (message) => {
	 *  console.log(message);
	 * });
	 * ```
	 */
	public subscribe = async (
		exchange: string,
		routingKey: string,
		queue: string,
		handler: RabbitMQMessageHandler
	): Promise<void> => {
		const existingIndex = this.subscriptions.findIndex((s) => s.queue === queue);
		if (existingIndex === -1) {
			this.subscriptions.push({ exchange, routingKey, queue, handler });
		}

		if (!this.connected || !this.channel) {
			this.logger.error('Cannot subscribe: RabbitMQ not connected');
			throw new Error('RabbitMQ not connected');
		}

		try {
			const dlxExchange = `${exchange}.dlx`;
			const dlqQueue = `${queue}.dlq`;
			const dlqRoutingKey = `${routingKey}.dead`;

			await this.channel.assertExchange(dlxExchange, this.exchangeType, { durable: true });
			await this.channel.assertQueue(dlqQueue, { durable: true });
			await this.channel.bindQueue(dlqQueue, dlxExchange, dlqRoutingKey);

			await this.channel.assertExchange(exchange, this.exchangeType, { durable: true });
			await this.channel.assertQueue(queue, {
				durable: true,
				deadLetterExchange: dlxExchange,
				deadLetterRoutingKey: dlqRoutingKey
			});
			await this.channel.bindQueue(queue, exchange, routingKey);

			this.channel.consume(
				queue,
				async (message) => {
					if (!message) {
						this.logger.error('Invalid message');

						return;
					}

					await this.handleWithRetry(message, handler);
				},
				{ noAck: false }
			);

			this.logger.info(`Subscribed to queue ${queue}`);
		} catch (error) {
			this.logger.error('Failed to subscribe to queue', error);

			throw new Error('Failed to subscribe to queue', { cause: error });
		}
	};

	/**
	 * Closes the rabbitmq connection
	 *
	 * @example
	 * ```ts
	 * await rabbitmq.close();
	 * ```
	 */
	public close = async (): Promise<void> => {
		try {
			await this.channel?.close();
			await this.connection?.close();

			this.logger.info('RabbitMQ connection closed');
		} catch (error) {
			this.logger.error('Failed to close RabbitMQ connection', error);

			throw new Error('Failed to close connection', { cause: error });
		}
	};

	/**
	 * Reconnects with retry mechanism
	 *
	 * Keeps trying to reconnect until it succeeds
	 *
	 * @returns {Promise<void>}
	 */
	private reconnectWithRetry = async (): Promise<void> => {
		if (this.reconnecting) return;
		this.reconnecting = true;

		await this.init();
		await this.resubscribeAll();
	};

	/**
	 * Re-establishes all subscriptions after reconnection
	 *
	 * @returns {Promise<void>}
	 */
	private resubscribeAll = async (): Promise<void> => {
		if (this.subscriptions.length === 0) {
			return;
		}

		this.logger.info(`Re-establishing ${this.subscriptions.length} subscription(s)`);

		for (const { exchange, routingKey, queue, handler } of this.subscriptions) {
			try {
				const dlxExchange = `${exchange}.dlx`;
				const dlqQueue = `${queue}.dlq`;
				const dlqRoutingKey = `${routingKey}.dead`;

				await this.channel.assertExchange(dlxExchange, this.exchangeType, { durable: true });
				await this.channel.assertQueue(dlqQueue, { durable: true });
				await this.channel.bindQueue(dlqQueue, dlxExchange, dlqRoutingKey);

				await this.channel.assertExchange(exchange, this.exchangeType, { durable: true });
				await this.channel.assertQueue(queue, {
					durable: true,
					deadLetterExchange: dlxExchange,
					deadLetterRoutingKey: dlqRoutingKey
				});
				await this.channel.bindQueue(queue, exchange, routingKey);

				await this.channel.consume(
					queue,
					async (message) => {
						if (!message) {
							this.logger.error('Invalid message');
							return;
						}

						await this.handleWithRetry(message, handler);
					},
					{ noAck: false }
				);

				this.logger.info(`Re-subscribed to queue ${queue}`);
			} catch (error) {
				this.logger.error(`Failed to re-subscribe to queue ${queue}`, error);
			}
		}
	};

	/**
	 * Handles a message with retries
	 *
	 * @param {amqp.ConsumeMessage} message - the message to handle.
	 * @param {RabbitMQMessageHandler} handler - the handler to call when a message is received.
	 */
	private handleWithRetry = async (
		message: amqp.ConsumeMessage,
		handler: RabbitMQMessageHandler
	): Promise<void> => {
		let attempts = 0;
		let content: RabbitMQMessage;

		while (attempts < this.MAX_RETRIES) {
			try {
				content = JSON.parse(message.content.toString());

				await handler(content);
				this.channel.ack(message);

				return;
			} catch (error) {
				attempts++;
				this.logger.warn(`Attempt ${attempts} of ${this.MAX_RETRIES} failed. Retrying...`, {
					error
				});

				if (attempts < this.MAX_RETRIES) {
					await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
				}
			}
		}

		this.logger.error(`Failed to handle message after ${this.MAX_RETRIES} attempts`);
		this.channel.nack(message, false, false);
	};
}

export default new RabbitMQService();
