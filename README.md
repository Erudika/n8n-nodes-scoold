<div align="center">
  <br>
  <picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://scoold.com/logo-dark.svg"/>
  <source media="(prefers-color-scheme: light)" srcset="https://scoold.com/logo.svg"/>
  <img width="360" alt="Scoold Logo" src="https://scoold.com/logo.svg"/>
  </picture>
  <br><br>
  <h2>
  The most effective way to share knowledge within your team or organization
  </h2>
</div>
<div align="center">

# n8n-nodes-scoold

An n8n community node package that integrates [Scoold](https://scoold.com) — the open-source Q&A platform — with your n8n workflows.

## Nodes

### Scoold Trigger

Starts a workflow whenever a Scoold event occurs (e.g. a new question, answer, or comment).

On activation the node automatically registers a webhook in your Scoold instance pointing at the n8n webhook URL. On deactivation it removes the webhook.

**Supported events** (loaded dynamically from `/api/events`):

| Event | Description |
|-------|-------------|
| `question.create` | A new question was posted |
| `answer.create` | A new answer was posted |
| `comment.create` | A new comment was posted |
| `answer.accept` | An answer was accepted as the solution |
| `answer.approve` | An answer was approved |
| `report.create` | A new report was submitted |
| `question.close` | A question was closed |
| `question.approve` | A question was approved |
| `user.signup` | A user signed up |
| `user.signin` | A user signed in |
| and more… | |

Each event emits one n8n item per object in the payload, enriched with a `_scoold` metadata field:

```json
{
  "_scoold": {
    "event": "question.create",
    "timestamp": 1711234567890,
    "appid": "app:myapp",
    "webhookId": "abc123"
  }
}
```

**Parameters:**
- **Events** — which events to subscribe to (multi-select, defaults to the six most common)
- **Property Filter** *(optional)* — filter events by object property, e.g. `space:general`

### Scoold

Action node for extracting data through Scoold's search API.

**Resource: Search — Operation: Query**

Searches for Scoold objects by type and full-text query string.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| Type | Object type: question, answer, user, profile, comment, report, revision, badge, feedback |
| Query | Full-text search string |
| Return All | Fetch all pages automatically via cursor pagination |
| Limit | Max results per page (when Return All is off) |
| Page | Page number to fetch (when Return All is off) |
| Sort By | Field name to sort by (e.g. `timestamp`, `votes`) |
| Descending | Sort in descending order (default: true) |
| Split Out Items | Emit one item per result (default) or one item with the full search envelope |

**Output when Split Out Items = false:**

```json
{
  "items": [...],
  "page": 1,
  "totalHits": 42,
  "lastKey": "..."
}
```

## Credentials

### Generating a Scoold API key

1. Sign in to your Scoold instance as an administrator.
2. Go to **Admin** and scroll to the **API** section.
3. Generate a new JWT API key and copy it — it is only shown once.

### Setting up the credential in n8n

1. In n8n, go to **Credentials → New → Scoold API**.
2. Enter your **Base URL** (e.g. `https://community.example.com`) — no trailing slash.
3. Paste the **API Key** you generated above.
4. Click **Test** — n8n will call `/api/stats` to confirm the key is valid.

## Installation

### n8n Cloud / self-hosted (GUI)

Go to **Settings → Community Nodes → Install** and enter:

```
n8n-nodes-scoold
```

### Self-hosted (CLI)

```bash
npm install n8n-nodes-scoold
```

Then restart n8n.

## Requirements

- Scoold Pro with webhooks enabled (`scoold.webhooks.enabled=true` in your config).
- n8n must be reachable from the Scoold server for webhook delivery.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Scoold documentation](https://scoold.com/docs)

## Version history

See [CHANGELOG.md](CHANGELOG.md).


## License

[MIT License](LICENSE)