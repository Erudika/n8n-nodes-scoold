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

function extractListItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];
	const obj = response as Record<string, unknown>;
	if (response !== null && typeof response === 'object' && Array.isArray(obj.items)) {
		return obj.items as IDataObject[];
	}
	return [];
}

function buildPaginationQs(fields: IDataObject): IDataObject {
	const qs: IDataObject = {};
	if (fields.limit !== undefined) qs.limit = fields.limit;
	if (fields.page !== undefined) qs.page = fields.page;
	if (fields.sortby) qs.sortby = fields.sortby;
	if (fields.desc !== undefined) qs.desc = fields.desc;
	return qs;
}

export class Scoold implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Scoold',
		name: 'scoold',
		icon: { light: 'file:scoold.svg', dark: 'file:scoold.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Scoold — manage posts, comments, tags, and reports',
		defaults: { name: 'Scoold' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'scooldApi', required: true }],
		properties: [
			// ── Resource ──────────────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Comment', value: 'comment' },
					{ name: 'Post', value: 'post' },
					{ name: 'Report', value: 'report' },
					{ name: 'Search', value: 'search' },
					{ name: 'Tag', value: 'tag' },
				],
				default: 'post',
			},

			// ── Operations ────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['search'] } },
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['post'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a new post', action: 'Create a post' },
					{ name: 'Delete', value: 'delete', description: 'Delete a post', action: 'Delete a post' },
					{ name: 'Get', value: 'get', description: 'Get a post by ID', action: 'Get a post' },
					{
						name: 'Get Answers',
						value: 'getAnswers',
						description: "Get answers for a question",
						action: 'Get answers for a post',
					},
					{
						name: 'Get Comments',
						value: 'getComments',
						description: "Get comments for a post",
						action: 'Get comments for a post',
					},
					{
						name: 'Get Revisions',
						value: 'getRevisions',
						description: "Get revision history for a post",
						action: 'Get revisions for a post',
					},
					{ name: 'List', value: 'list', description: 'List questions on the front page', action: 'List posts' },
					{ name: 'Update', value: 'update', description: 'Update a post', action: 'Update a post' },
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['comment'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new comment on a post',
						action: 'Create a comment',
					},
					{ name: 'Delete', value: 'delete', description: 'Delete a comment', action: 'Delete a comment' },
					{ name: 'Get', value: 'get', description: 'Get a comment by ID', action: 'Get a comment' },
					{
						name: 'List',
						value: 'list',
						description: 'List comments for a post',
						action: 'List comments for a post',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['tag'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a new tag', action: 'Create a tag' },
					{ name: 'Delete', value: 'delete', description: 'Delete a tag', action: 'Delete a tag' },
					{ name: 'Get', value: 'get', description: 'Get a tag by ID', action: 'Get a tag' },
					{ name: 'List', value: 'list', description: 'List tags', action: 'List tags' },
					{ name: 'Update', value: 'update', description: 'Rename a tag', action: 'Rename a tag' },
				],
				default: 'list',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['report'] } },
				options: [
					{ name: 'Close', value: 'close', description: 'Close a report', action: 'Close a report' },
					{ name: 'Create', value: 'create', description: 'Create a new report', action: 'Create a report' },
					{ name: 'Delete', value: 'delete', description: 'Delete a report', action: 'Delete a report' },
					{ name: 'Get', value: 'get', description: 'Get a report by ID', action: 'Get a report' },
					{ name: 'List', value: 'list', description: 'List reports', action: 'List reports' },
				],
				default: 'list',
			},

			// ── Search fields ─────────────────────────────────────────────────────
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				required: true,
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				options: [
					{ name: 'Answer', value: 'answer' },
					{ name: 'Any Type', value: '' },
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
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				default: '',
				placeholder: 'e.g. authentication error',
				description: 'Full-text search query string',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['search'], operation: ['query'], returnAll: [false] } },
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['search'], operation: ['query'], returnAll: [false] } },
				default: 1,
				description: 'Page number to fetch (1-based)',
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'string',
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				default: '',
				placeholder: 'e.g. timestamp',
				description: 'Field name to sort results by',
			},
			{
				displayName: 'Descending',
				name: 'descending',
				type: 'boolean',
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				default: true,
				description: 'Whether to sort results in descending order',
			},
			{
				displayName: 'Split Out Items',
				name: 'splitOutItems',
				type: 'boolean',
				displayOptions: { show: { resource: ['search'], operation: ['query'] } },
				default: true,
				description:
					'Whether to emit one item per result (true) or one item containing the full search envelope (false)',
			},

			// ── Post fields ───────────────────────────────────────────────────────

			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['get', 'update', 'delete', 'getAnswers', 'getComments', 'getRevisions'],
					},
				},
				default: '',
				description: 'The ID of the post',
			},
			{
				displayName: 'Post Type',
				name: 'postType',
				type: 'options',
				required: true,
				displayOptions: { show: { resource: ['post'], operation: ['create'] } },
				options: [
					{ name: 'Question', value: 'question' },
					{ name: 'Reply (Answer)', value: 'reply' },
					{ name: 'Sticky', value: 'sticky' },
				],
				default: 'question',
				description: 'The type of post to create',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['post'], operation: ['create'] } },
				default: '',
				description: 'The title of the post',
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				typeOptions: { rows: 4 },
				displayOptions: { show: { resource: ['post'], operation: ['create', 'update'] } },
				default: '',
				description: 'Post body (supports GitHub-flavored Markdown)',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				displayOptions: { show: { resource: ['post'], operation: ['create', 'update'] } },
				default: '',
				placeholder: 'e.g. java, spring, rest',
				description: 'Comma-separated list of tags',
			},
			{
				displayName: 'Parent Post ID',
				name: 'parentId',
				type: 'string',
				displayOptions: { show: { resource: ['post'], operation: ['create'] } },
				default: '',
				description: 'The ID of the parent question (required when Post Type is Reply)',
			},
			// Post create additional fields
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['post'], operation: ['create'] } },
				options: [
					{
						displayName: 'Creator ID',
						name: 'creatorid',
						type: 'string',
						default: '',
						description: 'The ID of the author (an existing user)',
					},
					{
						displayName: 'Disable Notifications',
						name: 'notificationsDisabled',
						type: 'boolean',
						default: false,
						description: 'Whether to suppress notifications (useful for bulk imports)',
					},
					{
						displayName: 'Location',
						name: 'location',
						type: 'string',
						default: '',
						description: 'Location name associated with this post',
					},
					{
						displayName: 'Space',
						name: 'space',
						type: 'string',
						default: '',
						description: 'The space to publish the post in',
					},
					{
						displayName: 'Wiki Mode',
						name: 'wiki',
						type: 'boolean',
						default: false,
						description: 'Whether to create this as a community wiki post',
					},
				],
			},
			// Post update additional fields
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['post'], operation: ['update'] } },
				options: [
					{
						displayName: 'Creator ID',
						name: 'creatorid',
						type: 'string',
						default: '',
						description: 'The ID of the author (an existing user)',
					},
					{
						displayName: 'Last Edited By',
						name: 'lasteditby',
						type: 'string',
						default: '',
						description: 'The ID of the user who edited the post',
					},
					{
						displayName: 'Location',
						name: 'location',
						type: 'string',
						default: '',
						description: 'Location name associated with this post',
					},
					{
						displayName: 'Space',
						name: 'space',
						type: 'string',
						default: '',
						description: 'The space for this post',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'New title for the post',
					},
					{
						displayName: 'Wiki Mode',
						name: 'wiki',
						type: 'boolean',
						default: false,
						description: 'Whether to set this as a community wiki post',
					},
				],
			},
			// Post list options
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['post'], operation: ['list'] } },
				options: [
					{
						displayName: 'Descending',
						name: 'desc',
						type: 'boolean',
						default: true,
						description: 'Whether to sort in descending order',
					},
					{
						displayName: 'Include Replies',
						name: 'includeReplies',
						type: 'boolean',
						default: false,
						description: 'Whether to embed answers inside each question',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'Page number to fetch',
					},
					{
						displayName: 'Query',
						name: 'q',
						type: 'string',
						default: '',
						description: 'Additional query string filter',
					},
					{
						displayName: 'Sort By',
						name: 'sortby',
						type: 'string',
						default: '',
						placeholder: 'e.g. votes, activity, unanswered',
						description: 'Sort by field name or category (activity, unanswered, unapproved)',
					},
					{
						displayName: 'Space',
						name: 'space',
						type: 'string',
						default: '',
						description: 'Filter by space',
					},
				],
			},
			// Post get/getAnswers/getComments/getRevisions pagination
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['get', 'getAnswers', 'getComments', 'getRevisions'] },
				},
				options: [
					{
						displayName: 'Descending',
						name: 'desc',
						type: 'boolean',
						default: true,
						description: 'Whether to sort in descending order',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'Page number to fetch',
					},
					{
						displayName: 'Sort By',
						name: 'sortby',
						type: 'string',
						default: '',
						description: 'Field name to sort results by',
					},
				],
			},

			// ── Comment fields ────────────────────────────────────────────────────

			{
				displayName: 'Comment',
				name: 'commentText',
				type: 'string',
				required: true,
				typeOptions: { rows: 3 },
				displayOptions: { show: { resource: ['comment'], operation: ['create'] } },
				default: '',
				description: 'The text of the comment',
			},
			{
				displayName: 'Parent Post ID',
				name: 'parentId',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['create'] } },
				default: '',
				description: 'The ID of the post to comment on',
			},
			{
				displayName: 'Comment ID',
				name: 'commentId',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'delete'] } },
				default: '',
				description: 'The ID of the comment',
			},
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['list'] } },
				default: '',
				description: 'The ID of the post to list comments for',
			},
			// Comment create additional fields
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['comment'], operation: ['create'] } },
				options: [
					{
						displayName: 'Creator ID',
						name: 'creatorid',
						type: 'string',
						default: '',
						description: 'The ID of the author (an existing user)',
					},
				],
			},
			// Comment list pagination
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['comment'], operation: ['list'] } },
				options: [
					{
						displayName: 'Descending',
						name: 'desc',
						type: 'boolean',
						default: false,
						description: 'Whether to sort in descending order',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'Page number to fetch',
					},
					{
						displayName: 'Sort By',
						name: 'sortby',
						type: 'string',
						default: '',
						description: 'Field name to sort results by',
					},
				],
			},

			// ── Tag fields ────────────────────────────────────────────────────────

			{
				displayName: 'Tag',
				name: 'tagName',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['tag'], operation: ['create'] } },
				default: '',
				placeholder: 'e.g. javascript',
				description: 'The name of the new tag',
			},
			{
				displayName: 'Tag ID',
				name: 'tagId',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['tag'], operation: ['get', 'update', 'delete'] } },
				default: '',
				description: 'The ID of the tag',
			},
			// Tag update fields
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['tag'], operation: ['update'] } },
				options: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'A short description of the tag',
					},
					{
						displayName: 'New Name',
						name: 'tag',
						type: 'string',
						default: '',
						description: 'The new name for the tag',
					},
				],
			},
			// Tag list pagination
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['tag'], operation: ['list'] } },
				options: [
					{
						displayName: 'Descending',
						name: 'desc',
						type: 'boolean',
						default: true,
						description: 'Whether to sort in descending order',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'Page number to fetch',
					},
					{
						displayName: 'Sort By',
						name: 'sortby',
						type: 'string',
						default: '',
						description: 'Field name to sort results by',
					},
				],
			},

			// ── Report fields ─────────────────────────────────────────────────────

			{
				displayName: 'Report ID',
				name: 'reportId',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['report'], operation: ['get', 'delete', 'close'] } },
				default: '',
				description: 'The ID of the report',
			},
			{
				displayName: 'Link',
				name: 'link',
				type: 'string',
				required: true,
				displayOptions: { show: { resource: ['report'], operation: ['create'] } },
				default: '',
				placeholder: 'e.g. https://your-scoold.com/question/123',
				description: 'The URL of the content being reported',
			},
			{
				displayName: 'Report Type',
				name: 'subType',
				type: 'options',
				required: true,
				displayOptions: { show: { resource: ['report'], operation: ['create'] } },
				options: [
					{ name: 'Duplicate', value: 'DUPLICATE' },
					{ name: 'Incorrect', value: 'INCORRECT' },
					{ name: 'Offensive', value: 'OFFENSIVE' },
					{ name: 'Other', value: 'OTHER' },
					{ name: 'Spam', value: 'SPAM' },
				],
				default: 'SPAM',
				description: 'The reason for the report',
			},
			// Report create additional fields
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['report'], operation: ['create'] } },
				options: [
					{
						displayName: 'Creator ID',
						name: 'creatorid',
						type: 'string',
						default: '',
						description: 'The ID of the reporter (an existing user)',
					},
				],
			},
			{
				displayName: 'Solution',
				name: 'solution',
				type: 'string',
				typeOptions: { rows: 3 },
				displayOptions: { show: { resource: ['report'], operation: ['close'] } },
				default: '',
				description: 'Description of the actions taken to resolve this report',
			},
			// Report list pagination
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['report'], operation: ['list'] } },
				options: [
					{
						displayName: 'Descending',
						name: 'desc',
						type: 'boolean',
						default: true,
						description: 'Whether to sort in descending order',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
						description: 'Page number to fetch',
					},
					{
						displayName: 'Sort By',
						name: 'sortby',
						type: 'string',
						default: '',
						description: 'Field name to sort results by',
					},
				],
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

				// ── Search ────────────────────────────────────────────────────────
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
							const qs: Record<string, string | number | boolean> = { desc: descending };
							if (sortBy) qs.sortby = sortBy;
							if (lastKey) qs.lastKey = lastKey;

							const response = (await this.helpers.httpRequestWithAuthentication.call(
								this,
								'scooldApi',
								{ method: 'GET', url, qs, json: true },
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
							{ method: 'GET', url, qs, json: true },
						)) as SearchEnvelope;
						allItems = envelope.items ?? [];
					}

					if (splitOutItems) {
						for (const item of allItems) {
							returnData.push({ json: item as IDataObject, pairedItem: { item: i } });
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
				}

				// ── Post ──────────────────────────────────────────────────────────
				else if (resource === 'post') {
					if (operation === 'create') {
						const postType = this.getNodeParameter('postType', i) as string;
						const title = this.getNodeParameter('title', i) as string;
						const body = this.getNodeParameter('body', i) as string;
						const tags = this.getNodeParameter('tags', i) as string;
						const parentId = this.getNodeParameter('parentId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						if (postType === 'reply' && !parentId) {
							throw new NodeOperationError(
								this.getNode(),
								'Parent Post ID is required when Post Type is Reply',
								{ itemIndex: i },
							);
						}

						const bodyData: IDataObject = { type: postType, title };
						if (body) bodyData.body = body;
						if (tags) bodyData.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
						if (parentId) bodyData.parentid = parentId;
						if (additionalFields.creatorid) bodyData.creatorid = additionalFields.creatorid;
						if (additionalFields.space) bodyData.space = additionalFields.space;
						if (additionalFields.wiki !== undefined) bodyData.wiki = additionalFields.wiki;
						if (additionalFields.location) bodyData.location = additionalFields.location;

						const qs: IDataObject = {};
						if (additionalFields.notificationsDisabled) qs.notificationsDisabled = true;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'POST',
							url: `${baseUrl}/api/posts`,
							body: bodyData,
							qs,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const postId = this.getNodeParameter('postId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts/${postId}`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'update') {
						const postId = this.getNodeParameter('postId', i) as string;
						const body = this.getNodeParameter('body', i) as string;
						const tags = this.getNodeParameter('tags', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const bodyData: IDataObject = {};
						if (body) bodyData.body = body;
						if (tags) bodyData.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
						if (additionalFields.title) bodyData.title = additionalFields.title;
						if (additionalFields.creatorid) bodyData.creatorid = additionalFields.creatorid;
						if (additionalFields.lasteditby) bodyData.lasteditby = additionalFields.lasteditby;
						if (additionalFields.space) bodyData.space = additionalFields.space;
						if (additionalFields.wiki !== undefined) bodyData.wiki = additionalFields.wiki;
						if (additionalFields.location) bodyData.location = additionalFields.location;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'PATCH',
							url: `${baseUrl}/api/posts/${postId}`,
							body: bodyData,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const postId = this.getNodeParameter('postId', i) as string;

						await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/posts/${postId}`,
							json: true,
						});

						returnData.push({ json: { success: true, id: postId }, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const qs: IDataObject = {};
						if (additionalFields.sortby) qs.sortby = additionalFields.sortby;
						if (additionalFields.space) qs.space = additionalFields.space;
						if (additionalFields.q) qs.q = additionalFields.q;
						if (additionalFields.includeReplies) qs.includeReplies = additionalFields.includeReplies;
						if (additionalFields.limit !== undefined) qs.limit = additionalFields.limit;
						if (additionalFields.page !== undefined) qs.page = additionalFields.page;
						if (additionalFields.desc !== undefined) qs.desc = additionalFields.desc;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts`,
							qs,
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else if (operation === 'getAnswers') {
						const postId = this.getNodeParameter('postId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts/${postId}/answers`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else if (operation === 'getComments') {
						const postId = this.getNodeParameter('postId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts/${postId}/comments`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else if (operation === 'getRevisions') {
						const postId = this.getNodeParameter('postId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts/${postId}/revisions`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}
				}

				// ── Comment ───────────────────────────────────────────────────────
				else if (resource === 'comment') {
					if (operation === 'create') {
						const commentText = this.getNodeParameter('commentText', i) as string;
						const parentId = this.getNodeParameter('parentId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const bodyData: IDataObject = { comment: commentText, parentid: parentId };
						if (additionalFields.creatorid) bodyData.creatorid = additionalFields.creatorid;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'POST',
							url: `${baseUrl}/api/comments`,
							body: bodyData,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const commentId = this.getNodeParameter('commentId', i) as string;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/comments/${commentId}`,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const commentId = this.getNodeParameter('commentId', i) as string;

						await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/comments/${commentId}`,
							json: true,
						});

						returnData.push({ json: { success: true, id: commentId }, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const postId = this.getNodeParameter('postId', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/posts/${postId}/comments`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}
				}

				// ── Tag ───────────────────────────────────────────────────────────
				else if (resource === 'tag') {
					if (operation === 'create') {
						const tagName = this.getNodeParameter('tagName', i) as string;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'POST',
							url: `${baseUrl}/api/tags`,
							body: { tag: tagName },
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const tagId = this.getNodeParameter('tagId', i) as string;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/tags/${tagId}`,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'update') {
						const tagId = this.getNodeParameter('tagId', i) as string;
						const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

						const bodyData: IDataObject = {};
						if (updateFields.tag) bodyData.tag = updateFields.tag;
						if (updateFields.description) bodyData.description = updateFields.description;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'PATCH',
							url: `${baseUrl}/api/tags/${tagId}`,
							body: bodyData,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const tagId = this.getNodeParameter('tagId', i) as string;

						await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/tags/${tagId}`,
							json: true,
						});

						returnData.push({ json: { success: true, id: tagId }, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/tags`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}
				}

				// ── Report ────────────────────────────────────────────────────────
				else if (resource === 'report') {
					if (operation === 'create') {
						const link = this.getNodeParameter('link', i) as string;
						const subType = this.getNodeParameter('subType', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const bodyData: IDataObject = { link, subType };
						if (additionalFields.creatorid) bodyData.creatorid = additionalFields.creatorid;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'POST',
							url: `${baseUrl}/api/reports`,
							body: bodyData,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'get') {
						const reportId = this.getNodeParameter('reportId', i) as string;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/reports/${reportId}`,
							json: true,
						})) as IDataObject;

						returnData.push({ json: response, pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const reportId = this.getNodeParameter('reportId', i) as string;

						await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/reports/${reportId}`,
							json: true,
						});

						returnData.push({ json: { success: true, id: reportId }, pairedItem: { item: i } });
					} else if (operation === 'list') {
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

						const response = await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'GET',
							url: `${baseUrl}/api/reports`,
							qs: buildPaginationQs(additionalFields),
							json: true,
						});

						for (const item of extractListItems(response)) {
							returnData.push({ json: item, pairedItem: { item: i } });
						}
					} else if (operation === 'close') {
						const reportId = this.getNodeParameter('reportId', i) as string;
						const solution = this.getNodeParameter('solution', i) as string;

						const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
							method: 'PUT',
							url: `${baseUrl}/api/reports/${reportId}/close`,
							body: { solution },
							json: true,
						})) as IDataObject | null | undefined;

						returnData.push({
							json: response ?? { success: true, id: reportId },
							pairedItem: { item: i },
						});
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
					}
				}

				else {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown resource/operation: ${resource}/${operation}`,
						{ itemIndex: i },
					);
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
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
