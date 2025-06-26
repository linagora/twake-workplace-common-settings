export interface Service {
	init: () => Promise<void>;
	name: string;
}

export type RabbitMQMessageHandler = (message: RabbitMQMessage) => Promise<void>;
export type RabbitMQMessage = any;

export interface SettingsMessage {
	source: string;
	nickname: string;
	request_id: string;
	timestamp: number;
	payload: Partial<Nullable<UserSettings>>;
	version: number;
}

export type Nullable<T> = {
	[P in keyof T]: T[P] | null;
};

export interface UserSettings {
	language: string;
	timezone: string;
	avatar: string;
	last_name: string;
	first_name: string;
	email: string;
	phone: string;
	matrix_id: string;
	display_name: string;
}

export interface UserSettingsResponse extends Partial<Nullable<UserSettings>> {
	version: number;
	nickname: string;
}

export interface UserSettingsEntry {
	nickname: string;
	version: number;
	settings: Partial<Nullable<UserSettings>>;
}
