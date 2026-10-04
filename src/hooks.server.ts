import type { Handle, ServerInit } from '@sveltejs/kit';
import LoggerService from '$services/logger';
import rabbitmq from '$services/rabbitmq';
import settings from '$services/settings';
import locator from '$services/locator';
import { authenticate } from '$lib/server/middleware';
import { logHttpRequest } from '$utils/logs';

const logger = LoggerService.getSubLogger({ name: 'bootstrap' });

export const init: ServerInit = async () => {
	for (const [name, service] of Object.entries({ rabbitmq, settings, locator })) {
		try {
			logger.info(`Initializing ${name} service`);
			await service.init();
		} catch (error) {
			logger.error(`Failed to initialize ${name} service`, error);
		}
	}
};

export const handle: Handle = async ({ event, resolve }) => {
	logHttpRequest(event);

	await authenticate(event);

	return await resolve(event);
};
