import adapter from '@sveltejs/adapter-auto';

const config = {
	compilerOptions: {
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter(),
		alias: {
			$stores: 'src/store',
			$components: 'src/components'
		}
	}
};

export default config;
