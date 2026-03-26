"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScooldTrigger = void 0;
const crypto_1 = require("crypto");
const n8n_workflow_1 = require("n8n-workflow");
const PRIORITY_EVENTS = [
    'question.create',
    'answer.create',
    'comment.create',
    'answer.accept',
    'answer.approve',
    'report.create',
];
class ScooldTrigger {
    constructor() {
        this.description = {
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
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                            description: 'Filter events by object property value. Format: <code>propertyName:value1|value2</code>',
                        },
                    ],
                },
            ],
            usableAsTool: true,
        };
        this.methods = {
            loadOptions: {
                async getEvents() {
                    const credentials = await this.getCredentials('scooldApi');
                    const baseUrl = credentials.baseUrl.replace(/\/$/, '');
                    const events = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                        method: 'GET',
                        url: `${baseUrl}/api/events`,
                        json: true,
                    }));
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
        this.webhookMethods = {
            default: {
                async checkExists() {
                    const staticData = this.getWorkflowStaticData('node');
                    const webhookId = staticData.webhookId;
                    if (!webhookId)
                        return false;
                    const credentials = await this.getCredentials('scooldApi');
                    const baseUrl = credentials.baseUrl.replace(/\/$/, '');
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    try {
                        const webhook = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                            method: 'GET',
                            url: `${baseUrl}/api/webhooks/${webhookId}`,
                            json: true,
                        }));
                        if (!webhook || webhook.targetUrl !== webhookUrl) {
                            return false;
                        }
                        return true;
                    }
                    catch {
                        return false;
                    }
                },
                async create() {
                    const credentials = await this.getCredentials('scooldApi');
                    const baseUrl = credentials.baseUrl.replace(/\/$/, '');
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const events = this.getNodeParameter('events');
                    const additionalFields = this.getNodeParameter('additionalFields');
                    const body = {
                        targetUrl: webhookUrl,
                        customEvents: events,
                        urlEncoded: false,
                        active: true,
                    };
                    if (additionalFields.propertyFilter) {
                        body.propertyFilter = additionalFields.propertyFilter;
                    }
                    const webhook = (await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/webhooks`,
                        body,
                        json: true,
                    }));
                    const staticData = this.getWorkflowStaticData('node');
                    staticData.webhookId = webhook.id;
                    staticData.webhookSecret = webhook.secret;
                    return true;
                },
                async delete() {
                    const staticData = this.getWorkflowStaticData('node');
                    const webhookId = staticData.webhookId;
                    if (!webhookId)
                        return true;
                    const credentials = await this.getCredentials('scooldApi');
                    const baseUrl = credentials.baseUrl.replace(/\/$/, '');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'scooldApi', {
                            method: 'DELETE',
                            url: `${baseUrl}/api/webhooks/${webhookId}`,
                            json: true,
                        });
                    }
                    catch {
                    }
                    delete staticData.webhookId;
                    delete staticData.webhookSecret;
                    return true;
                },
            },
        };
    }
    async webhook() {
        const staticData = this.getWorkflowStaticData('node');
        const storedSecret = staticData.webhookSecret;
        const storedWebhookId = staticData.webhookId;
        const req = this.getRequestObject();
        const rawBodyBuffer = req.rawBody;
        const rawBody = rawBodyBuffer
            ? rawBodyBuffer.toString('utf8')
            : JSON.stringify(this.getBodyData());
        const incomingSig = this.getHeaderData()['x-webhook-signature'];
        if (storedSecret && incomingSig) {
            const expected = (0, crypto_1.createHmac)('sha256', storedSecret).update(rawBody, 'utf8').digest('base64');
            if (incomingSig !== expected) {
                return { noWebhookResponse: true };
            }
        }
        else if (!incomingSig) {
            return { noWebhookResponse: true };
        }
        let body;
        try {
            body = JSON.parse(rawBody);
        }
        catch {
            return { noWebhookResponse: true };
        }
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            return { noWebhookResponse: true };
        }
        const outputItems = items.map((item) => ({
            json: {
                ...item,
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
exports.ScooldTrigger = ScooldTrigger;
//# sourceMappingURL=ScooldTrigger.node.js.map