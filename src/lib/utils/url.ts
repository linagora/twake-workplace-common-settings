import urlJoin from 'url-join';

/**
 * formats a url by adding a trailing slash if it doesn't have one
 *
 * @param {string} url - the url to check
 * @returns {string} - the url with a trailing slash if it doesn't have one
 */
export const getUrl = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

/**
 * Concatenates a URL with a path
 *
 * @param {string} url - The URL to be concatenated.
 * @param {string} path - The base URL to be concatenated.
 * @returns {string} - The concatenated URL.
 */
export const concatUrl = (url: string, path: string): string => urlJoin(url, path);
