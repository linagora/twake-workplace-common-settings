export type SettingsMessage = {
	source: string;
	nickname: string;
	request_id: string;
	timestamp: number;
	payload: Partial<Nullable<UserSettings>>;
	version: number;
};

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
	theme: 'light' | 'dark' | 'auto';
}

export interface UserSettingsResponse extends Partial<Nullable<UserSettings>> {
	version: number;
	nickname: string;
}
