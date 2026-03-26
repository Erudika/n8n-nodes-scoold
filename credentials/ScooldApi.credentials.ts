import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ScooldApi implements ICredentialType {
	name = 'scooldApi';

	displayName = 'Scoold API';

	icon: ICredentialType['icon'] = { light: 'file:scoold.svg', dark: 'file:scoold.dark.svg' };

	documentationUrl = 'https://github.com/Erudika/n8n-nodes-scoold?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'https://qna.cloud.scoold.com',
			description: 'The base URL of your Scoold instance, without a trailing slash',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'JWT API key generated from the Scoold Admin page',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/stats',
		},
	};
}
