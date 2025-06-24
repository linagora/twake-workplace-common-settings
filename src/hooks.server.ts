import type { Handle, ServerInit } from '@sveltejs/kit';
import bootstrap from '$services/bootstrap';
import { authenticate } from '$lib/server/middleware';
import { logHttpRequest } from '$utils/logs';

export const init: ServerInit = async () => {
	await bootstrap.init();
};

export const handle: Handle = async ({ event, resolve }) => {
	logHttpRequest(event);

	await authenticate(event);

	return await resolve(event);
};
