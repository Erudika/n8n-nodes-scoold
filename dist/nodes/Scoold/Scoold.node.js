"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scoold = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class Scoold {
    constructor() {
        this.description = {
            displayName: 'Scoold',
            name: 'scoold',
            icon: { light: 'file:scoold.svg', dark: 'file:scoold.dark.svg' },
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Search and extract data from Scoold',
            defaults: {
                name: 'Scoold',
            },
            usableAsTool: true,
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [{ name: 'scooldApi', required: true }],
            properties: [
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Search',
                            value: 'search',
                        },
                    ],
                    default: 'search',
                },
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: { resource: ['search'] },
                    },
                    options: [
                        {
                            name: 'Query',
                            value: 'query',
                            description: 'Search for items by type and query string',
                            action: 'Query scoold',
                        },
                    ],
                    default: 'query',
                },
                {
                    displayName: 'Type',
                    name: 'type',
                    type: 'options',
                    required: true,
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    options: [
                        { name: 'Answer', value: 'answer' },
                        { name: 'Badge', value: 'badge' },
                        { name: 'Comment', value: 'comment' },
                        { name: 'Feedback', value: 'feedback' },
                        { name: 'Profile', value: 'profile' },
                        { name: 'Question', value: 'question' },
                        { name: 'Report', value: 'report' },
                        { name: 'Revision', value: 'revision' },
                        { name: 'User', value: 'user' },
                    ],
                    default: 'question',
                    description: 'The type of Scoold object to search',
                },
                {
                    displayName: 'Query',
                    name: 'query',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    default: '',
                    placeholder: 'e.g. authentication error',
                    description: 'Full-text search query string',
                },
                {
                    displayName: 'Return All',
                    name: 'returnAll',
                    type: 'boolean',
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    default: false,
                    description: 'Whether to return all results or only up to a given limit',
                },
                {
                    displayName: 'Limit',
                    name: 'limit',
                    type: 'number',
                    typeOptions: { minValue: 1 },
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'], returnAll: [false] },
                    },
                    default: 50,
                    description: 'Max number of results to return',
                },
                {
                    displayName: 'Page',
                    name: 'page',
                    type: 'number',
                    typeOptions: { minValue: 1 },
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'], returnAll: [false] },
                    },
                    default: 1,
                    description: 'Page number to fetch (1-based)',
                },
                {
                    displayName: 'Sort By',
                    name: 'sortBy',
                    type: 'string',
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    default: '',
                    placeholder: 'e.g. timestamp',
                    description: 'Field name to sort results by',
                },
                {
                    displayName: 'Descending',
                    name: 'descending',
                    type: 'boolean',
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    default: true,
                    description: 'Whether to sort results in descending order',
                },
                {
                    displayName: 'Split Out Items',
                    name: 'splitOutItems',
                    type: 'boolean',
                    displayOptions: {
                        show: { resource: ['search'], operation: ['query'] },
                    },
                    default: true,
                    description: 'Whether to emit one item per result (true) or one item containing the full search envelope (false)',
                },
            ],
        };
    }
    async execute() {
        var _a, _b, _c, _d;
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('scooldApi');
        const baseUrl = credentials.baseUrl.replace(/\/$/, '');
        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i);
                const operation = this.getNodeParameter('operation', i);
                if (resource === 'search' && operation === 'query') {
                    const type = this.getNodeParameter('type', i);
                    const query = this.getNodeParameter('query', i);
                    const returnAll = this.getNodeParameter('returnAll', i);
                    const sortBy = this.getNodeParameter('sortBy', i);
                    const descending = this.getNodeParameter('descending', i);
                    const splitOutItems = this.getNodeParameter('splitOutItems', i);
                    const encodedQuery = encodeURIComponent(query);
                    const url = `${baseUrl}/api/search/${type}/${encodedQuery}`;
                    let allItems = [];
                    let envelope = null;
                    if (returnAll) {
                        let lastKey;
                        do {
                            const qs = {
                                desc: descending,
                            };
                            if (sortBy)
                                qs.sortby = sortBy;
                            if (lastKey)
                                qs.lastKey = lastKey;
                            const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                                method: 'GET',
                                url,
                                qs,
                                json: true,
                            }));
                            allItems = allItems.concat((_a = response.items) !== null && _a !== void 0 ? _a : []);
                            lastKey = response.lastKey;
                            envelope = response;
                        } while (lastKey);
                    }
                    else {
                        const limit = this.getNodeParameter('limit', i);
                        const page = this.getNodeParameter('page', i);
                        const qs = {
                            page,
                            limit,
                            desc: descending,
                        };
                        if (sortBy)
                            qs.sortby = sortBy;
                        envelope = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                            method: 'GET',
                            url,
                            qs,
                            json: true,
                        }));
                        allItems = (_b = envelope.items) !== null && _b !== void 0 ? _b : [];
                    }
                    if (splitOutItems) {
                        for (const item of allItems) {
                            returnData.push({
                                json: item,
                                pairedItem: { item: i },
                            });
                        }
                    }
                    else {
                        returnData.push({
                            json: {
                                items: allItems,
                                page: (_c = envelope === null || envelope === void 0 ? void 0 : envelope.page) !== null && _c !== void 0 ? _c : 1,
                                totalHits: (_d = envelope === null || envelope === void 0 ? void 0 : envelope.totalHits) !== null && _d !== void 0 ? _d : allItems.length,
                                ...((envelope === null || envelope === void 0 ? void 0 : envelope.lastKey) ? { lastKey: envelope.lastKey } : {}),
                            },
                            pairedItem: { item: i },
                        });
                    }
                }
                else {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unknown resource/operation: ${resource}/${operation}`, {
                        itemIndex: i,
                    });
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                if (error.httpCode) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex: i });
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.Scoold = Scoold;
//# sourceMappingURL=Scoold.node.js.map