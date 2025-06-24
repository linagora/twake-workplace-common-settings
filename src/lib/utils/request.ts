import type { RequestEvent } from '@sveltejs/kit';

/**
 * Extracts the access token from the request headers
 *
 * @param {RequestEvent} event - the HTTP request event
 * @returns {string | null} - the access token or null if not found
 */
export const GetRequestAccessToken = (event: RequestEvent): string | null => {
	const authHeader = event.request.headers.get('Authorization');

	if (!authHeader) {
		return null;
	}

	const [type, token] = authHeader.split(' ');

	if (type !== 'Bearer') {
		return null;
	}

	return token;
};
