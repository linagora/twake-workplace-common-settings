import { env } from '$env/dynamic/private';
import { db } from '$db';
import loggerService, { type GenericLogger } from '$services/logger';
import rabbitMQService from '$services/rabbitmq';
import { workplaceLocatorTable } from '$db/schema';
import { userCreatedSchema } from '$lib/schemas/user-created';
import type { RabbitMQMessage } from '@linagora/rabbitmq-client';
import {
	DEFAULT_AUTH_EXCHANGE,
	DEFAULT_LOCATOR_QUEUE,
	DEFAULT_USER_CREATED_ROUTING_KEY
} from '$utils/config';

class LocatorService {
	public readonly name = 'locator';
	private logger: GenericLogger;
	private exchange: string;
	private routingKey: string;
	private queue: string;

	constructor() {
		this.logger = loggerService.getSubLogger({ name: this.name });

		this.exchange = env.RABBITMQ_AUTH_EXCHANGE || DEFAULT_AUTH_EXCHANGE;
		this.routingKey = env.RABBITMQ_USER_CREATED_ROUTING_KEY || DEFAULT_USER_CREATED_ROUTING_KEY;
		this.queue = env.RABBITMQ_LOCATOR_QUEUE || DEFAULT_LOCATOR_QUEUE;
	}

	public init = async (): Promise<void> => {
		try {
			await rabbitMQService.subscribe(
				this.exchange,
				this.routingKey,
				this.queue,
				this.handleUserCreatedMessage
			);

			this.logger.info('Locator service initialized');
		} catch (err) {
			this.logger.error('Failed to initialize locator service', err);

			throw new Error('Failed to initialize locator service', { cause: err });
		}
	};

	private handleUserCreatedMessage = async (message: RabbitMQMessage): Promise<void> => {
		const result = userCreatedSchema.safeParse(message);

		// Acked rather than dead-lettered: a retry cannot add the missing fields.
		if (!result.success) {
			this.logger.warn('Skipping user.created without a usable internalEmail or workplaceFqdn', {
				message,
				errors: result.error.errors
			});

			return;
		}

		const email = result.data.internalEmail.toLowerCase();
		const { workplaceFqdn } = result.data;

		try {
			await db
				.insert(workplaceLocatorTable)
				.values({ email, workplaceFqdn })
				.onConflictDoUpdate({ target: workplaceLocatorTable.email, set: { workplaceFqdn } });

			this.logger.info(`Stored workplace address for ${email}`);
		} catch (err) {
			this.logger.error(`Failed to store workplace address for ${email}`, err);

			throw err;
		}
	};
}

export default new LocatorService();
