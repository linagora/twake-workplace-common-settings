import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$types: './src/types',
			$db: './src/lib/server/db',
			$utils: './src/lib/utils',
			$services: './src/lib/services',
			$lib: './src/lib',
			$src: './src'
		}
	}
};

export default config;
