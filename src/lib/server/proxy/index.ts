import { env } from '$env/dynamic/private';
import LoggerService, { type GenericLogger } from '$services/logger';
import { OIDC_USERINFO_PATH } from '$utils';
import { interceptUserInfo } from '$utils/proxy';
import type { Handle } from '@sveltejs/kit';

/**
 * Proxy logger instance
 *
 * @type {GenericLogger}
 */
const logger: GenericLogger = LoggerService.getSubLogger({
	name: 'proxy'
});

/**
 * Porxies events to the ODIC identity provider
 *
 * @param {RequestEvent} event - the event
 * @returns {Promise<Response>} - the response from the identity provider
 * @throws {Error} - if there is an error proxying the request
 */
export const OidcProxyHandle = (async ({ event }) => {
	const { request, url } = event;

	const proxiedUrl = new URL(env.IDENTITY_PROVIDER_URL);
	const requestHeaders = new Headers(request.headers);

	requestHeaders.delete('host');
	requestHeaders.delete('connection');

	if (requestHeaders.get('content-length') === '0') {
		requestHeaders.delete('content-length');
	}

  proxiedUrl.pathname = url.pathname;
	proxiedUrl.search = url.search;

	try {
		logger.info(`Proxying request to ${proxiedUrl.toString()}`);

		const response = await fetch(proxiedUrl.toString(), {
			redirect: 'manual',
			method: request.method,
			headers: requestHeaders,
			body: request.body,
			duplex: 'half'
		} as RequestInit);

		let proxyResponseHeaders = new Headers(response.headers);

		proxyResponseHeaders.delete('content-encoding');

		if (url.pathname.startsWith(OIDC_USERINFO_PATH)) {
			interceptUserInfo(response.clone());
		}

		logger.info(`Sending response back to client from ${proxiedUrl.toString()}`, {
			status: response.status,
			statusText: response.statusText
		});

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: proxyResponseHeaders
		});
	} catch (err) {
		logger.error(`Error proxying request to ${proxiedUrl.toString()}`, err);

		throw err;
	}
}) satisfies Handle;
