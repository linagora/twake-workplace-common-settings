import LoggerService, { type GenericLogger } from '$services/logger';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Logger instance for request actions
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = LoggerService.getSubLogger({
	name: 'Request'
});

/**
 * Logs the request details.
 *
 * @param {RequestEvent} event - The request event.
 */
export const logHttpRequest = (event: RequestEvent) => {
	try {
		const { request: req } = event;

		logger.debug({
			time: Date.now(),
			url: req.url,
			method: req.method,
			headers: getRequestHeaders(req)
		});
	} catch (error) {
		logger.error('Error logging request', error);
	}
};

/**
 * Extracts the request headers from the event
 *
 * @param {Request} request - The request event
 * @returns {Record<string, string>} - The request headers
 */
export const getRequestHeaders = (request: Request): Record<string, string> => {
	const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie'];

	const headers: Record<string, string> = {};

	request.headers.forEach((value, key) => {
		if (sensitiveHeaders.includes(key.toLowerCase())) {
			headers[key] = value ? 'set' : 'not set';
		} else {
			headers[key] = value;
		}
	});

	return headers;
};
