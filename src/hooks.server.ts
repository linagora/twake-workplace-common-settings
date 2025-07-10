import type { Handle, ServerInit } from '@sveltejs/kit';
import bootstrap from '$services/bootstrap';
import { authenticate } from '$lib/server/middleware';
import { logHttpRequest } from '$utils/logs';
import { isIDPProxyEvent } from '$utils/proxy';
import { OidcProxyHandle } from '$lib/server/proxy';

export const init: ServerInit = async () => {
	await bootstrap.init();
};

export const handle: Handle = async ({ event, resolve }) => {
	logHttpRequest(event);

	if (isIDPProxyEvent(event)) {
		return OidcProxyHandle({ event, resolve });
	}

	await authenticate(event);

	return await resolve(event);
};
