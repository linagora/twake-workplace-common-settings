import LoggerService, { type GenericLogger } from '$services/logger';
import settingsService from '$services/settings';
import { error, type RequestHandler } from '@sveltejs/kit';

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
 * Force sync a single user settings
 *
 * @type {RequestHandler} - the request handler
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	try {
		const { username } = params;

		if (!locals.user) {
			throw error(401, 'Unauthorized');
		}

		if (!username) {
			throw error(400, 'Missing username');
		}

		await settingsService.sendSettingsUpdateNotification(username);

		return new Response('ok', { status: 200 });
	} catch (error) {
		logger.error('Failed to force sync user settings', error);

		throw error;
	}
};
