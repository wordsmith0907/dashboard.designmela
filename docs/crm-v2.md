# CRM 2 upgrade

The app remains a fictional, per-tab demo. There is no connected database or authentication. Owner checks in the demo provider are an architectural boundary, not real access control. Never use real client data here.

## Importing leads

CRM → Import Leads → choose/drop CSV, XLSX or XLS → explicitly confirm local processing. Preview the first worksheet, map columns, review validation and duplicates, then confirm import separately. Files are parsed locally in a worker with a 15-second timeout, 5 MB/2,000-row/60-column limits. No file is uploaded or retained. SheetJS 0.20.3 is installed from its official distribution, not the outdated npm release.

Map Full name or First name; Last name is optional. Other fields are optional. Use UTF-8 comma-separated CSV, plain numbers and ISO dates. Excel dates are recognized. Date-only imports use 09:00 UTC. Phone cells should be text to retain leading zeros. Formula cells are rejected. Blank rows are reported as invalid and excluded with “valid rows only”. Download the template and `/lead-import-instructions.txt` for details.

Duplicates use normalized email, phone, then name/company. Skip, update, separate and per-row review are available. Ambiguous updates require an explicit target. Updates apply mapped fields including blanks, retain all original attribution and activities, and append incoming notes. Confirmed operations are atomic in memory. Import history includes per-row results. Undo removes only unchanged creations with no subsequent work or related quotes, proposals, payments, clients, projects, audits, tasks, notes, activities or communications; existing-record updates are never reversed. Exported CSV neutralizes spreadsheet formulas.

## Scoring and attribution

Rule score: service 15, positive budget 15, scheduled follow-up 15, valid email or phone 15, contact logged in the last 30 days 10, positive reply 15, proposal request 15. Manual override is 0–100 with a visible explanation. This is not AI. First-touch source is immutable through edits; intentional source reassignment updates latest touch. Imports default to CSV/Excel Import.

Legacy `source/stage/value/service/followUp` fields remain compatibility projections of the canonical v2 fields, so existing Today/projects/audits keep working. Future SQL mapping must use the canonical fields and preserve IDs and relations. No real database exists to migrate. The consolidated SQL proposal in supabase/proposals is unapplied and requires further field mapping and policy/transaction testing.

## Filters, actions and analytics

Combine the CRM filters, export matching/selected records, and confirm bulk operations. Archive replaces the CRM delete action. Saved views store only allowlisted enums, numeric bounds and dates; free-text search, tags, country and source-details filters are excluded from localStorage. Pagination limits rendered table rows to 25. Demo snapshots still load all records; production needs paginated server queries.

Source analytics uses existing records only. Conversion percentages are current-stage snapshots; they are not historical cohort conversion. Values remain separated by currency. Average conversion time excludes leads without known won dates. All charts say Demo data.

## Sales and tasks

Sales contains editable services, multi-item quotes, explicit discounts/tax, print/PDF-ready quotes, proposal tracking and manual payment records. An accepted proposal can create a project once. Lead conversion creates a client and marks the lead Won. No email, WhatsApp or payment delivery occurs. Follow-ups and legacy agency tasks are accessible from Tasks; full task-model unification remains outstanding.

## Website tracking and backups

`POST /api/website-events` validates an exact payload allowlist and configured origins, caps payload size and rate-limits by origin in process. It rejects unexpected fields and never collects form content. Valid events return 503 until durable storage exists: no success is faked. This is a preparation endpoint, not production analytics. Configure `WEBSITE_ALLOWED_ORIGINS` only after implementing durable ingestion and distributed limits. Do not expose a service-role key or send one from a public website.

Future website code should send only `{event,ctaId,page,sessionId,occurredAt}` after required consent, using a random short-lived session ID, no fingerprint and no personal field values. Restrict page to an allowlisted path without query parameters. Origins are not authentication or anti-bot protection. Public events must not authorize lead conversion or sales status updates. No public website was modified.

No backups have been created. Use CSV exports for review copies, protecting them as sensitive files when real data is eventually allowed. For a future Supabase database, use the official CLI/database export procedure with a restricted server credential, encrypted storage, a documented schedule, retention and a test restore into an isolated database. Never commit dumps or restore over production without explicit approval.

## Still outstanding from the expanded brief

Real SupabaseDataProvider/authentication, server pagination/optimistic rollback, fully unified tasks, richer project/audit detail models, configurable/reorderable columns, complete global quick-add/search coverage, full CTA funnel reporting/durable ingestion, and production-ready relational migrations remain unimplemented. Existing project/audit/content workflows are preserved. No paid API, Instagram synchronization, social publishing, accounting or client portal was added.

Undo reports separately show deleted, preserved, skipped and failed rows. A missing lead is skipped; missing import provenance fails safely without deletion. Existing-record updates are skipped by undo. No separate invoice entity currently exists. The typed relationship registry requires review when new direct lead-linked entities are introduced.
