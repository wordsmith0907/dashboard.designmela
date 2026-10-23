# Future n8n integration

The current workflow/run records are fictional. Counters are sample historical totals; recent runs are a short sample, not a complete log. Retry is intentionally disabled and workflow links/IDs are empty. No requests are made to n8n.

Implement a server-only adapter with a configured n8n base URL, API key and webhook signing secret. Keep authentication credentials out of React/browser bundles. Map workflow IDs to authorized internal owner/workspace IDs on the server; never trust an owner ID supplied by an external webhook.

Use a signed webhook endpoint with timestamp tolerance, replay prevention, strict payload validation, rate limits and idempotency by external event ID. Map run states to Queued, Running, Successful, Failed or Cancelled. Redact personal information and secrets from errors/logs. Update aggregate counters and run history transactionally.

Retry should require authorization, deduplication, a clear pending state and a real provider response. A successful enqueue is not a successful run. Display actual run completion only after a verified callback or polling result. Validate any external workflow links as HTTP(S).

Social publishing and Instagram API synchronization are outside this phase. The current dashboard only records manually posted content and stores unknown metrics as NULL.

AI/n8n must never receive database administration or team-access credentials. They may prepare suggestions but cannot apply role/permission changes, suspend members, create Owners or export data independently. Protected operations require an authenticated Owner through reviewed server enforcement and explicit confirmation.
