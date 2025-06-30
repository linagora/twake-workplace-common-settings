import settingsService from '$services/settings';
import LoggerService, { type GenericLogger } from '$services/logger';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Proxy logger instance
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = LoggerService.getSubLogger({
	name: 'proxy'
});

/**
 * Intercepts user info response
 *
 * @param {Response} response - the response
 * @returns {Promise<void>} - the augmented response
 */
export const interceptUserInfo = async (response: Response): Promise<void> => {
	try {
		const { sub } = await response.json();

		settingsService.sendSettingsUpdateNotification(sub).catch((error) => {
			logger.error(`Failed to send settings update notification`, error);
		});
	} catch (error) {
		logger.error(`Failed to intercept userinfo response`);
	}
};

/**
 * Detects if an event should be proxied to the identity provider
 */
export const isIDPProxyEvent = (event: RequestEvent): boolean => {
	const { url, request } = event;
	const { headers, method } = request;

	if (url.pathname.startsWith('/api/')) {
		return false;
	}

	if (method === 'GET' && url.pathname === '/') {
		const acceptHeader = headers.get('Accept') ?? '';

		return acceptHeader.includes('application/json');
	}

	return true;
};
