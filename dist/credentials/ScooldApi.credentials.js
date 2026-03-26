"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScooldApi = void 0;
class ScooldApi {
    constructor() {
        this.name = 'scooldApi';
        this.displayName = 'Scoold API';
        this.icon = { light: 'file:scoold.svg', dark: 'file:scoold.dark.svg' };
        this.documentationUrl = 'https://github.com/Erudika/n8n-nodes-scoold?tab=readme-ov-file#credentials';
        this.properties = [
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
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    Authorization: '=Bearer {{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.baseUrl}}',
                url: '/api/stats',
            },
        };
    }
}
exports.ScooldApi = ScooldApi;
//# sourceMappingURL=ScooldApi.credentials.js.map