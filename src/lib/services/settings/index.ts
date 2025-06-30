import { env } from '$env/dynamic/private';
import { v6 as uuid } from 'uuid';
import { eq, gt } from 'drizzle-orm';
import { db } from '$db';
import loggerService, { type GenericLogger } from '$services/logger';
import rabbitMQService from '$services/rabbitmq';
import { userSettingsTable } from '$db/schema';
import { updateUserSettingsSchema } from '$lib/schemas/user-settings';
import type {
	Nullable,
	SettingsMessage,
	UserSettings,
	UserSettingsEntry,
	UserSettingsResponse
} from '$types';
import {
	DEFAULT_RABBITMQ_EXCHANGE,
	DEFAULT_SETTINGS_INPUT_QUEUE,
	DEFAULT_SETTINGS_INPUT_ROUTING_KEY,
	DEFAULT_SETTINGS_OUTPUT_ROUTING_KEY,
	EDITABLE_USER_SETTINGS,
	SETTINGS_NOTIFICATION_SOURCE,
	SYNC_BATCH_SIZE,
	SYNC_PROCESS_DELAY
} from '$utils/config';
import { error } from '@sveltejs/kit';

class SettingsService {
	public readonly name = 'settings';
	private logger: GenericLogger;
	private inputQueue: string;
	private inKey: string;
	private outKey: string;
	private exchange: string;

	/**
	 * @constructor
	 *
	 * the settings service constructor
	 */
	constructor() {
		this.logger = loggerService.getSubLogger({
			name: this.name
		});

		if (!env.RABBITMQ_EXCHANGE) {
			this.logger.error('RABBITMQ_EXCHANGE is not defined');
		}

		if (!env.RABBITMQ_SETTINGS_INPUT_QUEUE) {
			this.logger.error('RABBITMQ_SETTINGS_INPUT_QUEUE is not defined');
		}

		if (!env.RABBITMQ_SETTINGS_INPUT_ROUTING_KEY) {
			this.logger.error('RABBITMQ_SETTINGS_INPUT_ROUTING_KEY is not defined');
		}

		if (!env.RABBITMQ_SETTINGS_OUTPUT_ROUTING_KEY) {
			this.logger.error('RABBITMQ_SETTINGS_OUTPUT_ROUTING_KEY is not defined');
		}

		this.exchange = env.RABBITMQ_EXCHANGE ?? DEFAULT_RABBITMQ_EXCHANGE;
		this.inputQueue = env.RABBITMQ_SETTINGS_INPUT_QUEUE ?? DEFAULT_SETTINGS_INPUT_QUEUE;
		this.inKey = env.RABBITMQ_SETTINGS_INPUT_ROUTING_KEY ?? DEFAULT_SETTINGS_INPUT_ROUTING_KEY;
		this.outKey = env.RABBITMQ_SETTINGS_OUTPUT_ROUTING_KEY ?? DEFAULT_SETTINGS_OUTPUT_ROUTING_KEY;
	}

	/**
	 * Initializes the settings service
	 *
	 * @returns {Promise<void>} - a promise that resolves when the service is initialized
	 */
	public init = async (): Promise<void> => {
		try {
			await rabbitMQService.subscribe(
				this.exchange,
				this.inKey,
				this.inputQueue,
				this.handleUpdateSettingsMessage.bind(this)
			);

			this.logger.info('Settings service initialized');
		} catch (err) {
			this.logger.error('Failed to initialize settings service', { err });

			throw new Error('Failed to initialize settings service', { cause: err });
		}
	};

	/**
	 * Handles update settings messages
	 *
	 * @param {SettingsMessage} message - the message to handle
	 * @returns {Promise<void>} - a promise that resolves when the message is handled
	 */
	private handleUpdateSettingsMessage = async (message: SettingsMessage): Promise<void> => {
		try {
			const { nickname } = message;

			this.logger.info('handling update settings message', { message });

			const messageValidationResult = await updateUserSettingsSchema.safeParseAsync(message);

			if (!messageValidationResult.success) {
				this.logger.error('Invalid user settings payload', {
					errors: messageValidationResult.error.errors
				});

				throw new Error('Invalid user settings payload');
			}

			await this.updateUserSettings(nickname, message);
			await this.sendSettingsUpdateNotification(nickname);
		} catch (err) {
			this.logger.error('Failed to handle settings update message', err);

			throw err;
		}
	};

	/**
	 * Updates user settings
	 *
	 * @param {String} nickname - the user to update
	 * @param {SettingsMessage} message - the settings to update
	 * @returns {Promise<void>} - a promise that resolves when the settings are updated
	 */
	public updateUserSettings = async (nickname: string, message: SettingsMessage): Promise<void> => {
		this.logger.info(`Updating user ${nickname} settings`);

		const currentSettingsEntry = await this.getUserSettings(nickname);

		if (!currentSettingsEntry) {
			this.logger.error(`Failed to get current settings for user ${nickname}`);

			throw error(404, 'Cannot find user settings');
		}

		const { version } = message;

		if (version <= currentSettingsEntry.version) {
			this.logger.error(`Outdated settings version ${version} for user ${nickname}`, {
				version,
				currentVersion: currentSettingsEntry.version
			});

			throw error(400, 'Outdated settings version');
		}

		const newPartialSettings = this.buildSettingsUpdatePayload(message);
		const {
			nickname: _nickname,
			version: _version,
			...settings
		} = { ...currentSettingsEntry, ...newPartialSettings };

		await db
			.update(userSettingsTable)
			.set({ settings, version })
			.where(eq(userSettingsTable.nickname, nickname));

		this.logger.info(`Updated user ${nickname} settings with version ${version}`);
	};

	/**
	 * Fetches and sends a user settings updated notification
	 *
	 * @param {string} username - the user to notify
	 * @returns {Promise<void>} - a promise that resolves when the notification is sent
	 */
	public sendSettingsUpdateNotification = async (username: string): Promise<void> => {
		try {
			this.logger.info(`Sending settings update notification for user: ${username}`);

			const latestUserSettings = await this.getUserSettings(username);

			if (!latestUserSettings) {
				this.logger.error(`Failed to get latest settings for user ${username}`);

				throw new Error('Failed to get latest user settings');
			}

			await this.broadcastUserSettingsUpdateNotification(username, latestUserSettings);
		} catch (err) {
			this.logger.error(`Failed to send settings update notification for user: ${username}`, err);
		}
	};

	/**
	 * Notifies about user settings update
	 *
	 * @param {string} user - the user to notify
	 * @returns {Promise<void>} - a promise that resolves when the notification is sent
	 */
	public broadcastUserSettingsUpdateNotification = async (
		user: string,
		payload: UserSettingsResponse
	): Promise<void> => {
		this.logger.info(`sending user ${user} settings update notification`);
		const notification = this.buildUserSettingsUpdateNotification(payload);

		await rabbitMQService.publish(this.exchange, this.outKey, notification);

		this.logger.info(`update settings notification for user ${user} sent`);
	};

	/**
	 * fetches the user settings from LDAP
	 *
	 * @param {string} nickname - the username
	 * @returns {Promise<UserSettingsResponse>} - the user settings
	 */
	public async getUserSettings(nickname: string): Promise<UserSettingsResponse | null> {
		try {
			this.logger.info(`Fetching user ${nickname} settings`);

			const userSettings = await db.query.userSettingsTable.findFirst({
				where: eq(userSettingsTable.nickname, nickname)
			});

			if (!userSettings) {
				this.logger.error(`Failed to get user settings for user ${nickname}`);

				throw new Error('Failed to get user settings');
			}

			return {
				nickname: userSettings.nickname,
				version: userSettings.version,
				...userSettings.settings
			};
		} catch (err) {
			this.logger.error('Failed to get user settings', err);

			return null;
		}
	}

	/**
	 * Creates a new user settings entry.
	 * Throws if creation fails.
	 *
	 * @param {string} nickname - The user's nickname (primary key).
	 * @param {Nullable<UserSettings>} settings - The initial user settings.
	 * @param {number} [version=1] - The initial settings version (default 1).
	 * @returns {Promise<void>} Resolves on success.
	 * @throws {Error} Throws if insertion fails.
	 */
	public createUserSettings = async (
		nickname: string,
		settings: Partial<Nullable<UserSettings>>,
		version: number = 1
	): Promise<void> => {
		this.logger.info(`Creating user settings for nickname: ${nickname}`);

		const existingSettings = await this.getUserSettings(nickname);

		if (existingSettings) {
			this.logger.info(`User settings already exist for ${nickname}`);

			throw error(409, 'User already has existing settings');
		}

		await db.insert(userSettingsTable).values({
			nickname,
			settings,
			version
		});

		this.logger.info(`User settings successfully created for ${nickname}`);
	};

	/**
	 * Builds a settings updated notification message
	 *
	 * @param {UserSettingsResponse} payload - the user settings payload
	 * @returns {SettingsMessage} - the notification message
	 */
	private buildUserSettingsUpdateNotification = (
		payload: UserSettingsResponse
	): SettingsMessage => {
		const { version, nickname } = payload;

		return {
			nickname,
			payload,
			source: SETTINGS_NOTIFICATION_SOURCE,
			timestamp: Date.now(),
			request_id: uuid(),
			version
		};
	};

	/**
	 * Builds a settings update payload
	 *
	 * @param {SettingsMessage} message - the settings update message
	 * @returns {Partial<UserSettings>} - the settings update payload
	 */
	private buildSettingsUpdatePayload = (message: SettingsMessage): Partial<UserSettings> => {
		const payload: Partial<UserSettings> = {};

		for (const key of EDITABLE_USER_SETTINGS) {
			if (message.payload[key]) {
				payload[key] = message.payload[key];
			}
		}

		return payload;
	};

	/**
	 * Broadcast settings messages
	 *
	 * @param {UserSettingsEntry[]} userSettings - the messages to broadcast
	 * @returns {Promise<void>} - a promise that resolves when the messages are broadcasted
	 */
	private broadcastUserSettingsMessages = async (
		userSettings: UserSettingsEntry[]
	): Promise<void> => {
		this.logger.info('Broadcasting user settings messages');

		for (const { nickname, settings, version } of userSettings) {
			const message = this.buildUserSettingsUpdateNotification({
				nickname,
				version,
				...settings
			});

			try {
				await rabbitMQService.publish(this.exchange, this.outKey, message);
			} catch (error) {
				this.logger.error(`Failed to broadcast settings for user ${nickname}`, error);
			}
		}
	};

	/**
	 * Synchronizes the settings.
	 *
	 * Publishes the stored settings to the routing key
	 *
	 * @returns {Promise<void>} - a promise that resolves when the settings are synced
	 */
	synchronizeSettings = async (): Promise<void> => {
		this.logger.info('Synchronizing user settings started');

		let lastProcessedUser: string | null = null;
		let batch: UserSettingsEntry[];

		do {
			batch = await db
				.select()
				.from(userSettingsTable)
				.where(lastProcessedUser ? gt(userSettingsTable.nickname, lastProcessedUser) : undefined)
				.orderBy(userSettingsTable.nickname)
				.limit(SYNC_BATCH_SIZE);

			if (batch.length === 0) {
				break;
			}

			await this.broadcastUserSettingsMessages(batch);

			lastProcessedUser = batch[batch.length - 1].nickname;

			if (batch.length === SYNC_BATCH_SIZE) {
				await new Promise((resolve) => setTimeout(resolve, SYNC_PROCESS_DELAY));
			}
		} while (batch.length === SYNC_BATCH_SIZE);
	};
}

export default new SettingsService();
