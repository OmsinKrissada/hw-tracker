import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'HW Tracker',
	description: 'API docs for curious developers',
	base: '/api/docs/',
	themeConfig: {
		logo: 'https://images-ext-2.discordapp.net/external/0t7xHbvlC6ezNEJ_kwHbt4VDUd-ga6GZLDW5av7QgfU/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/848986970108723280/09c59fb5dbb5ad3f32769d2488339bcc.png?width=671&height=671',
		nav: [
			{ text: 'Documentation', link: '/guide/', activeMatch: '/guide/*' },
			{ text: 'Troubleshooting', link: '/configs' },
			{ text: 'Visit Website', link: 'https://homework.krissada.com', }
		],
		socialLinks: [
			// { icon: 'discord', link: 'https://hw.krissada.com' },
			{ icon: 'github', link: 'https://github.com/OmsinKrissada/hw-tracker' }
		],
		lastUpdatedText: 'Updated Date',
		footer: {
			message: 'Made with ❤️ and VitePress. Released under the MIT License.',
			copyright: 'Copyright © 2022 Krissada Singhakachain'
		},
		sidebar: [
			{
				text: 'Introduction',
				items: [
					{ text: 'The Ultimate Purpose', link: '/guide/' },
					{ text: 'Making Requests', link: '/guide/making-requests' },
					{ text: 'Error Responses', link: '/guide/error-responses' },
				]
			},
			{
				text: 'Authentication',
				items: [
					{ text: 'Obtaining API Key', link: '/guide/obtain-key' },
				]
			},
			{
				text: 'Resource',
				items: [
					{ text: 'Subject', link: '/guide/subject' },
					{ text: 'Homework', link: '/guide/homework' },
					{ text: 'User', link: '/guide/user' }
				]
			}
		],
	}
});
