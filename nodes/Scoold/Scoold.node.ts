import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

export class Scoold implements INodeType {
	description: INodeTypeDescription = {
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
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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
				description:
					'Whether to emit one item per result (true) or one item containing the full search envelope (false)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('scooldApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'search' && operation === 'query') {
					const type = this.getNodeParameter('type', i) as string;
					const query = this.getNodeParameter('query', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const sortBy = this.getNodeParameter('sortBy', i) as string;
					const descending = this.getNodeParameter('descending', i) as boolean;
					const splitOutItems = this.getNodeParameter('splitOutItems', i) as boolean;

					const encodedQuery = encodeURIComponent(query);
					const url = `${baseUrl}/api/search/${type}/${encodedQuery}`;

					type SearchEnvelope = {
						items: unknown[];
						page: number;
						totalHits: number;
						lastKey?: string;
					};

					let allItems: unknown[] = [];
					let envelope: SearchEnvelope | null = null;

					if (returnAll) {
						let lastKey: string | undefined;
						do {
							const qs: Record<string, string | number | boolean> = {
								desc: descending,
							};
							if (sortBy) qs.sortby = sortBy;
							if (lastKey) qs.lastKey = lastKey;

							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'scooldApi',
								{
									method: 'GET',
									url,
									qs,
									json: true,
								},
							)) as SearchEnvelope;

							allItems = allItems.concat(response.items ?? []);
							lastKey = response.lastKey;
							envelope = response;
						} while (lastKey);
					} else {
						const limit = this.getNodeParameter('limit', i) as number;
						const page = this.getNodeParameter('page', i) as number;

						const qs: Record<string, string | number | boolean> = {
							page,
							limit,
							desc: descending,
						};
						if (sortBy) qs.sortby = sortBy;

						envelope = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'scooldApi',
							{
								method: 'GET',
								url,
								qs,
								json: true,
							},
						)) as SearchEnvelope;
						allItems = envelope.items ?? [];
					}

					if (splitOutItems) {
						for (const item of allItems) {
							returnData.push({
								json: item as IDataObject,
								pairedItem: { item: i },
							});
						}
					} else {
						returnData.push({
							json: {
								items: allItems,
								page: envelope?.page ?? 1,
								totalHits: envelope?.totalHits ?? allItems.length,
								...(envelope?.lastKey ? { lastKey: envelope.lastKey } : {}),
							},
							pairedItem: { item: i },
						});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource/operation: ${resource}/${operation}`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}

				if ((error as { httpCode?: string }).httpCode) {
					throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
				}
				throw error;
			}
		}

		return [returnData];
	}
}
