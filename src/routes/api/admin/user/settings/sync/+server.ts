import { error, type RequestHandler } from '@sveltejs/kit';
import LoggerService, { type GenericLogger } from '$services/logger';
import settingsService from '$services/settings';

/**
 * User settings logger
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = LoggerService.getSubLogger({
	name: 'API',
	prefix: ['settings', 'sync']
});

/**
 * Force sync user settings
 *
 * @type {RequestHandler} - the request handler
 */
export const POST: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		settingsService
			.synchronizeSettings()
			.then(() => {
				logger.info('Finished force sync user settings');
			})
			.catch((error) => {
				logger.error('Failed to force sync user settings', error);
			});

		return new Response('ok', { status: 200 });
	} catch (error) {
		logger.error('Failed to force sync user settings', error);

		throw error;
	}
};
