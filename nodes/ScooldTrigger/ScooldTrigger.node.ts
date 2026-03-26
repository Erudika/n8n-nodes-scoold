import { createHmac } from 'crypto';
import {
	NodeConnectionTypes,
	type IHookFunctions,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

const PRIORITY_EVENTS = [
	'question.create',
	'answer.create',
	'comment.create',
	'answer.accept',
	'answer.approve',
	'report.create',
];

export class ScooldTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Scoold Trigger',
		name: 'scooldTrigger',
		icon: { light: 'file:scoold.svg', dark: 'file:scoold.dark.svg' },
		group: ['trigger'],
		version: 1,
		description: 'Starts a workflow when a Scoold event occurs',
		defaults: {
			name: 'Scoold Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'scooldApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event Names or IDs',
				name: 'events',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getEvents',
				},
				default: [],
				required: true,
				description: 'The Scoold events that will trigger this workflow. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Property Filter',
						name: 'propertyFilter',
						type: 'string',
						default: '',
						placeholder: 'e.g. space:general',
						description:
							'Filter events by object property value. Format: <code>propertyName:value1|value2</code>',
					},
				],
			},
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getEvents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('scooldApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

				const events = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
					method: 'GET',
					url: `${baseUrl}/api/events`,
					json: true,
				})) as string[];

				const prioritySet = new Set(PRIORITY_EVENTS);
				const priority = events.filter((e) => prioritySet.has(e));
				const rest = events.filter((e) => !prioritySet.has(e)).sort();
				const ordered = [...priority, ...rest];

				return ordered.map((e) => ({
					name: e
						.split('.')
						.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
						.join(' '),
					value: e,
				}));
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return false;

				const credentials = await this.getCredentials('scooldApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				try {
					const webhook = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'scooldApi',
						{
							method: 'GET',
							url: `${baseUrl}/api/webhooks/${webhookId}`,
							json: true,
						},
					)) as { targetUrl?: string } | null;

					if (!webhook || webhook.targetUrl !== webhookUrl) {
						return false;
					}
					return true;
				} catch {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('scooldApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				const events = this.getNodeParameter('events') as string[];
				const additionalFields = this.getNodeParameter('additionalFields') as {
					propertyFilter?: string;
				};

				const body: Record<string, unknown> = {
					targetUrl: webhookUrl,
					customEvents: events,
					urlEncoded: false,
					active: true,
				};

				if (additionalFields.propertyFilter) {
					body.propertyFilter = additionalFields.propertyFilter;
				}

				const webhook = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'scooldApi',
					{
						method: 'POST',
						url: `${baseUrl}/api/webhooks`,
						body,
						json: true,
					},
				)) as { id: string; secret: string };

				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookId = webhook.id;
				staticData.webhookSecret = webhook.secret;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return true;

				const credentials = await this.getCredentials('scooldApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');

				try {
					await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
						method: 'DELETE',
						url: `${baseUrl}/api/webhooks/${webhookId}`,
						json: true,
					});
				} catch {
					// Webhook may already be gone; treat as success
				}

				delete staticData.webhookId;
				delete staticData.webhookSecret;

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const staticData = this.getWorkflowStaticData('node');
		const storedSecret = staticData.webhookSecret as string | undefined;
		const storedWebhookId = staticData.webhookId as string | undefined;

		// Get raw body for signature validation
		const req = this.getRequestObject();
		const rawBodyBuffer = (req as unknown as { rawBody?: Buffer }).rawBody;
		const rawBody: string = rawBodyBuffer
			? rawBodyBuffer.toString('utf8')
			: JSON.stringify(this.getBodyData());

		// Validate HMAC-SHA256 signature
		const incomingSig = this.getHeaderData()['x-webhook-signature'] as string | undefined;
		if (storedSecret && incomingSig) {
			const expected = createHmac('sha256', storedSecret).update(rawBody, 'utf8').digest('base64');
			if (incomingSig !== expected) {
				return { noWebhookResponse: true };
			}
		} else if (!incomingSig) {
			return { noWebhookResponse: true };
		}

		// Parse inner payload
		type ScooldPayload = {
			timestamp: number;
			appid: string;
			event: string;
			items: unknown[];
		};

		let body: ScooldPayload;
		try {
			body = JSON.parse(rawBody) as ScooldPayload;
		} catch {
			return { noWebhookResponse: true };
		}

		const items = Array.isArray(body.items) ? body.items : [];
		if (items.length === 0) {
			return { noWebhookResponse: true };
		}

		const outputItems = items.map((item) => ({
			json: {
				...(item as Record<string, unknown>),
				_scoold: {
					event: body.event,
					timestamp: body.timestamp,
					appid: body.appid,
					webhookId: storedWebhookId,
				},
			},
		}));

		return {
			workflowData: [outputItems],
		};
	}
}
