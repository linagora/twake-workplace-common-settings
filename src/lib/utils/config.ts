import type { UserSettings } from '$types';

export const DEFAULT_RABBITMQ_URL = 'amqp://localhost';
export const DEFAULT_RABBITMQ_EXCHANGE = 'settings';
export const DEFAULT_RABBITMQ_MAX_RETRIES = 3;
export const DEFAULT_RABBITMQ_RETRY_DELAY = 1000;
export const DEFAULT_SETTINGS_INPUT_QUEUE = 'user.settings.input';
export const DEFAULT_SETTINGS_INPUT_ROUTING_KEY = 'user.settings.update';
export const DEFAULT_SETTINGS_OUTPUT_ROUTING_KEY = 'user.settings.updated';
export const SETTINGS_NOTIFICATION_SOURCE = 'registration';

export const EDITABLE_USER_SETTINGS: Array<keyof UserSettings> = [
	'language',
	'timezone',
	'avatar',
	'display_name'
];

export const OIDC_USERINFO_PATH = '/oauth2/userinfo';

export const PROTECTED_APIS = ['/api/admin/'];
export const OIDC_PROTECTED_APIS = ['/api/user/settings'];
