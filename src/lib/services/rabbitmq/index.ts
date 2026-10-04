import { RabbitMQClient } from '@linagora/rabbitmq-client';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import LoggerService from '$services/logger';
import {
	DEFAULT_RABBITMQ_CONNECTION_RETRY_DELAY,
	DEFAULT_RABBITMQ_MAX_RETRIES,
	DEFAULT_RABBITMQ_RETRY_DELAY,
	DEFAULT_RABBITMQ_URL
} from '$utils/config';

if (!env.RABBITMQ_URL) {
	LoggerService.getSubLogger({ name: 'rabbitmq' }).fatal('RABBITMQ_URL is not set');

	if (!building) {
		throw new Error('RABBITMQ_URL is not set');
	}
}

export default new RabbitMQClient({
	url: env.RABBITMQ_URL ?? DEFAULT_RABBITMQ_URL,
	maxRetries: parseInt(env.RABBITMQ_MAX_RETRIES) || DEFAULT_RABBITMQ_MAX_RETRIES,
	retryDelay: parseInt(env.RABBITMQ_RETRY_DELAY) || DEFAULT_RABBITMQ_RETRY_DELAY,
	connectionRetryDelay:
		parseInt(env.RABBITMQ_CONNECTION_RETRY_DELAY) || DEFAULT_RABBITMQ_CONNECTION_RETRY_DELAY
});
