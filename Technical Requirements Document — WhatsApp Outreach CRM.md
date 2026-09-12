# Technical Requirements Document (TRD)
## WhatsApp Outreach CRM — Lead → Reply → Project

**Version:** 1.0  
**Status:** Final  
**Target:** MVP / Production-ready foundation  
**Primary User:** Solo B2B operator  
**Architecture:** Next.js + PostgreSQL + Node.js Worker + BullMQ + Redis + WhatsApp Provider Layer

---

# 1. Product Overview

The WhatsApp Outreach CRM is a single-operator CRM designed to manage the complete B2B outreach lifecycle:

**Lead → Outreach → Reply → Pipeline → Won → Project**

The system allows the user to:

1. Import contacts from Excel/CSV.
2. Clean, normalize and deduplicate contacts.
3. Segment contacts.
4. Create personalized WhatsApp campaigns.
5. Queue and send messages through a WhatsApp provider.
6. Track message delivery and failures.
7. Capture inbound WhatsApp replies.
8. Manage contacts through a Kanban pipeline.
9. Convert won contacts into projects.
10. Manage project tasks, notes, deadlines and deal values.

The original PRD explicitly defines the product as a single-operator WhatsApp-only CRM and excludes email/SMS, team permissions and accounting functionality from v1.

---

# 2. Technical Objectives

The system must be:

- **Reliable** — messages should not silently disappear or duplicate.
- **Idempotent** — worker retries must not result in duplicate sends.
- **Observable** — failures must be visible to the operator.
- **Scalable** — architecture should support significantly more contacts than the initial MVP.
- **Provider-independent** — WhatsApp implementation must be replaceable without rewriting CRM logic.
- **Realtime** — campaign, inbox and pipeline changes should appear without manual refresh.
- **Type-safe** — TypeScript should be used throughout the application and worker.
- **Simple to operate** — infrastructure should remain lightweight for a solo operator.
- **Compliance-aware** — opt-outs and do-not-contact rules must be enforced at the application level.

---

# 3. Recommended Technology Stack

## 3.1 Application

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI components | shadcn/ui |
| Server state | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod |
| Drag & Drop | dnd-kit |

---

## 3.2 Backend

| Layer | Technology |
|---|---|
| Web backend | Next.js Route Handlers / Server Actions |
| Worker | Node.js + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| File storage | Supabase Storage |

---

## 3.3 Background Processing

| Component | Technology |
|---|---|
| Job queue | BullMQ |
| Queue datastore | Redis |
| Redis provider | Upstash Redis |
| Worker runtime | Node.js |
| Worker hosting | Railway / equivalent persistent container host |

---

## 3.4 WhatsApp

The application must use a provider abstraction:

```text
MessagingService
       ↓
WhatsAppProvider
       ↓
 ┌───────────────┐
 │               │
Baileys       Cloud API
```

### Initial provider

Baileys may be used for controlled MVP development where its operational and policy risks are explicitly accepted.

### Production provider

The architecture must support migration to the official WhatsApp Business Platform / Cloud API.

The CRM must never directly depend on Baileys-specific types or events.

---

## 3.5 Supporting Libraries

| Requirement | Library |
|---|---|
| Excel parsing | SheetJS |
| CSV parsing | Papa Parse |
| Phone normalization | libphonenumber-js |
| Logging | Pino |
| Error tracking | Sentry |
| Unit testing | Vitest |
| E2E testing | Playwright |

---

# 4. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Next.js       │
                         │                     │
                         │ Dashboard           │
                         │ Contacts            │
                         │ Campaigns           │
                         │ Inbox               │
                         │ Pipeline             │
                         │ Projects            │
                         └──────────┬──────────┘
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                         ▼                     ▼
                  ┌─────────────┐       ┌─────────────┐
                  │ PostgreSQL  │       │   BullMQ    │
                  │  Supabase   │       │   + Redis   │
                  └──────┬──────┘       └──────┬──────┘
                         │                     │
                         │                     ▼
                         │              ┌─────────────┐
                         │              │ Node Worker │
                         │              └──────┬──────┘
                         │                     │
                         │                     ▼
                         │             ┌────────────────┐
                         │             │ WhatsApp       │
                         │             │ Provider       │
                         │             └───────┬────────┘
                         │                     │
                         │              ┌──────┴──────┐
                         │              ▼             ▼
                         │          Baileys       Cloud API
                         │
                         ▼
                  Supabase Realtime
                         │
                         ▼
                    Live UI Updates
```

---

# 5. Repository Architecture

Use a monorepo-style structure:

```text
whatsapp-crm/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── ...
│   │
│   └── worker/
│       ├── queues/
│       ├── processors/
│       ├── whatsapp/
│       ├── services/
│       └── ...
│
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   └── client/
│   │
│   ├── shared/
│   │   ├── schemas/
│   │   ├── types/
│   │   └── constants/
│   │
│   └── whatsapp/
│       ├── provider.ts
│       ├── baileys.ts
│       └── cloud-api.ts
│
├── package.json
└── ...
```

Recommended package manager:

```text
pnpm
```

---

# 6. Application Layers

The application should maintain a strict separation between:

```text
UI
 ↓
Application Services
 ↓
Domain Logic
 ↓
Data Access
 ↓
Infrastructure
```

The frontend should not directly contain WhatsApp provider logic.

For example:

```text
Campaign UI
    ↓
CampaignService
    ↓
CampaignJob creation
    ↓
BullMQ
    ↓
Worker
    ↓
MessagingService
    ↓
WhatsAppProvider
```

---

# 7. Database Architecture

PostgreSQL is the primary source of truth.

Redis must only be treated as an execution/queue system and must not contain authoritative CRM state.

---

# 8. Core Database Entities

## 8.1 User

Even though v1 is single-user, maintain a user entity to avoid architectural limitations later.

```text
User
- id
- email
- created_at
- updated_at
```

---

## 8.2 Contact

```text
Contact
- id
- name
- phone
- company
- email
- source
- pipeline_stage
- do_not_contact
- created_at
- updated_at
- archived_at
```

### Constraints

```text
phone UNIQUE
```

Phone numbers must be stored in E.164 format.

Example:

```text
+919876543210
```

---

# 9. Contact Tags

Tags should be normalized instead of storing a comma-separated string.

```text
Tag
- id
- name
- created_at
```

```text
ContactTag
- contact_id
- tag_id
```

This enables segmentation by:

- source
- campaign batch
- industry
- geography
- manually assigned categories

---

# 10. Import Batches

Every uploaded file must create an import batch.

```text
ImportBatch
- id
- filename
- status
- total_rows
- valid_rows
- invalid_rows
- duplicate_rows
- created_at
- completed_at
```

Possible states:

```text
UPLOADED
PARSING
VALIDATING
READY
COMMITTED
FAILED
```

---

# 11. Campaign

```text
Campaign
- id
- name
- message_template
- status
- created_at
- started_at
- completed_at
```

Possible campaign states:

```text
DRAFT
QUEUED
RUNNING
PAUSED
COMPLETED
FAILED
```

---

# 12. Campaign Contact

Many-to-many relationship between campaigns and contacts.

```text
CampaignContact
- id
- campaign_id
- contact_id
- send_status
- queued_at
- sent_at
- delivered_at
- failed_at
- error_reason
- provider_message_id
```

Possible states:

```text
QUEUED
SENT
DELIVERED
FAILED
SKIPPED
```

---

# 13. Messages

```text
Message
- id
- contact_id
- campaign_id nullable
- direction
- body
- provider_message_id
- created_at
```

Direction:

```text
INBOUND
OUTBOUND
```

A message should remain immutable after creation except for explicitly controlled metadata.

---

# 14. Message Events

Message status should not rely exclusively on one mutable status field.

```text
MessageEvent
- id
- message_id
- event_type
- metadata
- created_at
```

Events:

```text
QUEUED
SENT
DELIVERED
READ
FAILED
```

This creates an audit trail and makes debugging significantly easier.

---

# 15. Project

```text
Project
- id
- contact_id
- campaign_id nullable
- name
- deal_value
- status
- notes
- created_at
- updated_at
```

Statuses:

```text
IN_PROGRESS
DELIVERED
PAID
```

A project must not require a campaign.

---

# 16. Task

```text
Task
- id
- project_id
- title
- due_date
- is_done
- created_at
- updated_at
```

Tasks must support:

- completion
- editing
- deletion
- due dates
- overdue indication

---

# 17. Pipeline Model

Contact pipeline stage is separate from WhatsApp delivery status.

### Pipeline

```text
NEW_LEAD
CONTACTED
REPLIED
NEGOTIATING
WON
LOST
```

### Messaging status

```text
NOT_CONTACTED
QUEUED
SENT
DELIVERED
REPLIED
FAILED
```

These must never be conflated.

For example:

```text
Messaging status = REPLIED
Pipeline stage = NEGOTIATING
```

is valid.

---

# 18. Contact Lifecycle

```text
New Lead
    ↓
Contacted
    ↓
Replied
    ↓
Negotiating
    ↓
Won
    ↓
Project
```

Alternative:

```text
Any Stage
    ↓
Lost
```

A lost contact can later be reopened.

---

# 19. Import System

## 19.1 Supported formats

```text
.csv
.xlsx
```

---

## 19.2 Import flow

```text
Upload
  ↓
File validation
  ↓
Parse workbook
  ↓
Detect sheets
  ↓
Detect header row
  ↓
Column mapping
  ↓
Preview
  ↓
Phone normalization
  ↓
Validation
  ↓
Deduplication
  ↓
Commit
```

---

# 20. Column Mapping

Never assume the incoming column order.

The UI must allow:

```text
Name     → Name
Mobile   → Phone
Business → Company
Mail     → Email
Source   → Source
Notes    → Notes
```

The system should intelligently suggest mappings but require confirmation.

---

# 21. Phone Normalization

Use `libphonenumber-js`.

Input examples:

```text
9876543210
+91 98765 43210
0919876543210
```

must be normalized into a canonical representation where possible.

Invalid numbers must be flagged rather than silently discarded.

---

# 22. Deduplication

Primary duplicate key:

```text
phone
```

If a contact already exists:

```text
Existing contact
      ↓
Duplicate detected
      ↓
Skip
```

The UI must report:

```text
1,000 rows processed

742 new
231 duplicates
27 invalid
```

Possible duplicates involving different phone numbers should not be automatically merged.

---

# 23. Large Imports

Files containing thousands of rows must not be processed synchronously inside an HTTP request.

Flow:

```text
Browser
 ↓
Supabase Storage
 ↓
ImportBatch
 ↓
BullMQ
 ↓
Worker
 ↓
Parse + validate
 ↓
Database
 ↓
Realtime progress
```

---

# 24. Message Templates

Templates support merge variables:

```text
{{name}}
{{company}}
```

Example:

```text
Hi {{name}}, noticed {{company}} and wanted to reach out...
```

The template engine must safely handle missing values.

Example:

```text
{{company}}
```

should never appear literally in the final message.

---

# 25. Campaign Creation

Flow:

```text
Campaign
 ↓
Select audience
 ↓
Select tags / contacts
 ↓
Write template
 ↓
Render previews
 ↓
Review
 ↓
Create campaign
 ↓
Queue jobs
```

The preview should render actual contact data.

At least 2–3 representative previews should be shown.

---

# 26. Campaign Queue Architecture

Each contact becomes an independent job.

```text
Campaign
    ↓
CampaignContacts
    ↓
BullMQ jobs
    ↓
Redis
    ↓
Worker
```

Recommended queues:

```text
campaign-send
inbound-message
message-status
imports
notifications
```

---

# 27. Worker Requirements

The worker must:

- run independently of Next.js
- maintain persistent provider connections where required
- process BullMQ jobs
- update PostgreSQL
- handle provider errors
- enforce eligibility checks
- support graceful shutdown
- log every significant operation
- report fatal errors to Sentry

---

# 28. Idempotency

This is a critical requirement.

Before sending a message, the worker must verify that the job has not already successfully executed.

Example:

```text
Job received
   ↓
Check CampaignContact
   ↓
Already SENT?
   ├── YES → terminate job
   └── NO
        ↓
Check do_not_contact
        ↓
Send
        ↓
Persist provider ID
        ↓
Mark SENT
```

A worker retry must never blindly resend.

---

# 29. WhatsApp Provider Interface

All WhatsApp-specific implementation must live behind an interface.

Example conceptual interface:

```text
WhatsAppProvider

connect()
disconnect()

sendMessage(phone, body)

getMessageStatus(messageId)

handleInboundEvent()

isConnected()

healthCheck()
```

Provider implementations:

```text
BaileysProvider
CloudApiProvider
```

The rest of the CRM must interact with:

```text
MessagingService
```

rather than directly with either provider.

---

# 30. WhatsApp Session Management

The worker must maintain a persistent WhatsApp connection when using a Web-session-based provider.

Required states:

```text
DISCONNECTED
CONNECTING
CONNECTED
AUTH_REQUIRED
ERROR
```

If the session becomes unavailable:

```text
Provider disconnect
       ↓
Pause campaign queues
       ↓
Notify user
       ↓
Wait for reconnection
       ↓
Resume eligible jobs
```

Do not blindly retry thousands of jobs after a provider/session failure.

---

# 31. Inbound Message Processing

When a WhatsApp message arrives:

```text
WhatsApp
   ↓
Provider event
   ↓
Worker
   ↓
Extract sender phone
   ↓
Find contact
   ↓
Create Message
   ↓
Create MessageEvent
   ↓
Update auto status
   ↓
Supabase Realtime
   ↓
Inbox
```

---

# 32. Reply Handling

Any inbound reply should automatically update:

```text
auto_status = REPLIED
```

It must **not** automatically change:

```text
pipeline_stage
```

For example:

```text
"Who is this?"

auto_status → REPLIED
pipeline_stage → CONTACTED
```

The human decides whether the lead is genuinely interested.

---

# 33. STOP / Opt-Out Handling

The system must recognize explicit requests such as:

```text
STOP
unsubscribe
don't contact me
remove me
```

When a clear opt-out is received:

```text
do_not_contact = true
```

This flag must be checked:

- before campaign creation
- before queueing
- before sending
- before retrying
- during future imports

An opt-out must override all other campaign rules.

---

# 34. Campaign Eligibility Check

Immediately before sending:

```text
Is contact archived?
       ↓
Is do_not_contact true?
       ↓
Is phone invalid?
       ↓
Has this campaign contact already sent?
       ↓
Is campaign paused?
       ↓
Is provider connected?
       ↓
SEND
```

The worker must perform the final eligibility check immediately before transmission.

---

# 35. Rate Limiting

The architecture must support:

- configurable campaign limits
- provider-specific limits
- queue throttling
- pause/resume
- retry policies

The system must not implement mechanisms intended to evade WhatsApp enforcement or disguise prohibited bulk messaging.

For production usage, the official WhatsApp Business Platform should be treated as the target integration.

---

# 36. Campaign Controls

The user must be able to:

```text
Start
Pause
Resume
Cancel
```

Campaign statistics:

```text
Total
Queued
Sent
Delivered
Failed
Replied
```

Example:

```text
Campaign: September Agencies

1,000 contacts

742 Sent
681 Delivered
37 Failed
24 Replied
```

---

# 37. Unified Inbox

The inbox must display conversations grouped by contact.

Each conversation should show:

```text
Contact
Company
Pipeline stage
Last message
Timestamp
Unread state
```

Conversation:

```text
Outbound
Inbound
Outbound
Inbound
...
```

---

# 38. Inbox Actions

The operator should be able to:

- read messages
- reply
- change pipeline stage
- add notes
- mark contact as do-not-contact
- open project
- archive conversation/contact

---

# 39. Kanban

Columns:

```text
New Lead
Contacted
Replied
Negotiating
Won
Lost
```

Cards should display:

```text
Name
Company
Last activity
Pipeline stage
Campaign
```

Drag-and-drop must update the database.

---

# 40. Realtime Synchronization

Realtime updates should be used for:

- campaign progress
- inbound messages
- pipeline changes
- project changes
- task completion
- import progress

Example:

```text
Worker
 ↓
Postgres UPDATE
 ↓
Supabase Realtime
 ↓
TanStack Query cache/UI
```

The database remains authoritative.

---

# 41. Project Creation

When:

```text
pipeline_stage = WON
```

the application automatically creates a project.

```text
Contact
  ↓
Won
  ↓
Create Project
  ↓
Project Dashboard
```

Project should inherit:

```text
contact_id
campaign_id
```

where available.

---

# 42. Project Dashboard

The dashboard should show:

```text
Active projects
Overdue tasks
Upcoming deadlines
Deal values
Project status
```

Project detail:

```text
Client
Deal value
Status
Notes
Tasks
Deadline
```

---

# 43. Frontend Pages

Recommended application routes:

```text
/login

/dashboard

/contacts
/contacts/[id]

/campaigns
/campaigns/new
/campaigns/[id]

/inbox
/inbox/[contactId]

/pipeline

/projects
/projects/[id]

/imports
/settings
```

---

# 44. Dashboard

The dashboard should provide a high-level overview:

```text
Total Contacts
Active Campaigns
Messages Sent
Replies
Negotiations
Won Deals
Active Projects
Overdue Tasks
```

---

# 45. Contact List

Required functionality:

- search
- filtering
- sorting
- pagination
- bulk selection
- tags
- pipeline stage
- messaging status
- archive
- import

---

# 46. API Architecture

Example endpoints:

```text
POST   /api/imports
GET    /api/imports/:id

GET    /api/contacts
POST   /api/contacts
GET    /api/contacts/:id
PATCH  /api/contacts/:id

POST   /api/campaigns
GET    /api/campaigns
GET    /api/campaigns/:id
POST   /api/campaigns/:id/start
POST   /api/campaigns/:id/pause
POST   /api/campaigns/:id/resume

GET    /api/messages
POST   /api/messages

PATCH  /api/contacts/:id/pipeline

POST   /api/projects
GET    /api/projects

POST   /api/tasks
PATCH  /api/tasks/:id
```

Webhook endpoints should be isolated from normal CRUD routes.

---

# 47. Authentication & Authorization

Supabase Auth handles authentication.

For v1:

```text
Single operator
```

No team-based RBAC is required.

However, database records should still contain ownership fields where useful so multi-user architecture can be added later.

---

# 48. Security Requirements

The system must:

- validate all incoming API payloads
- use Zod schemas
- authenticate protected routes
- never expose database credentials to the browser
- keep Redis credentials server-side
- keep WhatsApp session credentials server-side
- sanitize imported data
- protect webhook endpoints
- avoid logging message contents unnecessarily
- encrypt sensitive secrets through deployment secret management

---

# 49. Secrets

Environment variables:

```text
DATABASE_URL
DIRECT_URL

SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

REDIS_URL

SENTRY_DSN

WHATSAPP_PROVIDER
WHATSAPP_SESSION_PATH

META_ACCESS_TOKEN
META_PHONE_NUMBER_ID
META_VERIFY_TOKEN
```

Secrets must never be committed to Git.

---

# 50. Observability

Use:

**Pino**

for structured logs.

Example:

```text
campaign_id
campaign_contact_id
contact_id
job_id
provider_message_id
event_type
timestamp
```

Use **Sentry** for:

- worker crashes
- API exceptions
- provider failures
- unexpected queue failures
- import failures

---

# 51. Error Handling

Errors should be categorized.

```text
VALIDATION_ERROR
AUTH_ERROR
NOT_FOUND
PROVIDER_ERROR
RATE_LIMIT_ERROR
NETWORK_ERROR
DATABASE_ERROR
QUEUE_ERROR
```

Transient errors may be retried.

Permanent errors must be marked failed.

---

# 52. Retry Policy

Example:

```text
Network error
    ↓
Retry with exponential backoff

Invalid number
    ↓
No retry

Opted-out contact
    ↓
No retry

Provider authentication failure
    ↓
Pause campaign

Database transient error
    ↓
Retry
```

Retries must always respect idempotency.

---

# 53. Database Indexes

At minimum:

```text
contacts.phone UNIQUE
contacts.pipeline_stage
contacts.do_not_contact

campaign_contacts.campaign_id
campaign_contacts.contact_id
campaign_contacts.send_status

messages.contact_id
messages.created_at
messages.provider_message_id

projects.contact_id
tasks.project_id
tasks.due_date
```

Composite indexes should be added after observing query patterns.

---

# 54. Pagination

Never load the entire contact/message table into the browser.

Use server-side pagination.

Recommended:

```text
cursor-based pagination
```

for message/inbox history.

Offset pagination may be acceptable for smaller administrative lists.

---

# 55. Data Integrity

Important constraints:

```text
Contact phone → UNIQUE

CampaignContact
(campaign_id, contact_id) → UNIQUE

Project
contact_id → indexed

Message
provider_message_id → indexed
```

Foreign keys must be used.

Deleting a contact with an active project must be blocked.

Archive instead.

---

# 56. Soft Delete / Archiving

Contacts should not be hard-deleted if historical messages or projects exist.

Use:

```text
archived_at
```

instead.

This preserves:

- conversations
- campaign history
- project history
- analytics

---

# 57. File Storage

Uploaded CSV/XLSX files should be stored in Supabase Storage.

Example:

```text
imports/
  user-id/
    batch-id/
      source.xlsx
```

Files should not be permanently loaded into application memory.

---

# 58. Performance Requirements

Target MVP:

```text
10,000+ contacts
100,000+ messages
1,000+ campaign contacts per campaign
```

The architecture should support these volumes without requiring redesign.

Large operations must be asynchronous.

---

# 59. Reliability Requirements

The system should ensure:

### No silent message loss

Every queued message must reach one terminal state:

```text
SENT
FAILED
SKIPPED
```

### No duplicate sends

Retries must be idempotent.

### No orphaned projects

Contacts with projects cannot be hard-deleted.

### No accidental outreach

`do_not_contact` must be checked immediately before sending.

---

# 60. Testing Strategy

## Unit Tests

Test:

```text
Phone normalization
Template rendering
Missing merge fields
Deduplication
Pipeline transitions
Opt-out detection
Campaign eligibility
Idempotency
```

---

## Integration Tests

Test:

```text
Import → Database
Campaign → Queue
Worker → Database
Inbound message → Contact
Won → Project
```

---

## E2E Tests

Use Playwright.

Critical journey:

```text
Login
 ↓
Upload Excel
 ↓
Map columns
 ↓
Import
 ↓
Create campaign
 ↓
Preview
 ↓
Start campaign
 ↓
View progress
 ↓
Receive reply
 ↓
Open inbox
 ↓
Move lead to Negotiating
 ↓
Move to Won
 ↓
Project created
 ↓
Create task
```

---

# 61. Deployment Architecture

## Web

Deploy Next.js to:

**Vercel**

## Worker

Deploy persistent Node.js worker to:

**Railway**

## Database

**Supabase PostgreSQL**

## Redis

**Upstash Redis**

## Monitoring

**Sentry**

---

# 62. Environment Architecture

```text
                 ┌──────────────┐
                 │    Vercel    │
                 │   Next.js    │
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  Supabase    │
                 │ PostgreSQL   │
                 └──────────────┘
                        ▲
                        │
                 ┌──────┴───────┐
                 │   Railway    │
                 │ Node Worker  │
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │   Upstash    │
                 │    Redis     │
                 └──────────────┘
```

---

# 63. Development Environments

Minimum:

```text
Development
Production
```

Local development should use:

```text
Next.js
Node worker
Local/remote PostgreSQL
Local Redis or Upstash development database
```

Docker may be used for local infrastructure if required.

---

# 64. CI/CD

GitHub-based CI should run:

```text
TypeScript check
Lint
Unit tests
Build
E2E tests
```

Production deployment should only occur after successful CI.

---

# 65. Recommended Build Order

## Phase 1 — Foundation

Build:

```text
Repository
Next.js
TypeScript
Tailwind
shadcn
Supabase
Prisma
Auth
Database schema
```

---

## Phase 2 — Contacts

Build:

```text
Contact CRUD
CSV import
Excel import
Column mapping
Phone normalization
Deduplication
Tags
Search/filter
```

---

## Phase 3 — Campaign Engine

Build:

```text
Campaign CRUD
Templates
Merge fields
Preview
CampaignContact
BullMQ
Redis
Worker
```

---

## Phase 4 — WhatsApp Provider

Build:

```text
WhatsAppProvider interface
BaileysProvider
Connection management
Send messages
Message IDs
Send status
Error handling
Idempotency
```

---

## Phase 5 — Inbound Messaging

Build:

```text
Inbound listener
Phone → contact matching
Message persistence
Message events
Realtime inbox
Reply handling
```

---

## Phase 6 — Pipeline

Build:

```text
Kanban
Pipeline transitions
Realtime updates
Contact detail
Manual stage management
```

---

## Phase 7 — Projects

Build:

```text
Won → Project
Project dashboard
Tasks
Notes
Deal value
Deadlines
Overdue tasks
```

---

## Phase 8 — Production Hardening

Build:

```text
Sentry
Pino
Retry policies
Health checks
Queue monitoring
Security review
Load testing
Backup strategy
E2E coverage
```

---

# 66. MVP Definition

The product is MVP-complete when the following journey works reliably:

```text
Excel/CSV
   ↓
Import
   ↓
Clean + Normalize
   ↓
Deduplicate
   ↓
Contacts
   ↓
Select leads
   ↓
Create personalized campaign
   ↓
Queue
   ↓
WhatsApp provider
   ↓
Send
   ↓
Track status
   ↓
Receive reply
   ↓
Unified inbox
   ↓
Move to Negotiating
   ↓
Won
   ↓
Automatic Project
   ↓
Tasks + Notes + Deadline
```

---

# 67. Explicit v1 Non-Goals

Do not build:

```text
Email
SMS
Instagram DM
Facebook Messenger
Multi-user teams
Role-based permissions
Accounting
Invoices
Payment processing
Advanced analytics
AI sales agent
Complex workflow automation
Mobile native app
```

These can be considered later.

---

# 68. Future Architecture

The system should eventually be capable of:

```text
                    CRM
                     │
              MessagingService
                     │
       ┌─────────────┼─────────────┐
       │             │             │
   WhatsApp       Email       Instagram
       │
 ┌─────┴──────┐
 │            │
Cloud API   Other Provider
```

Additional future modules:

```text
AI lead qualification
AI reply suggestions
Automated follow-ups
Email outreach
Team accounts
Roles & permissions
Analytics
Revenue forecasting
CRM integrations
Webhooks
API access
```

None should be implemented in v1 unless they become necessary.

---

# 69. Architectural Principles

The following principles are mandatory:

### 1. PostgreSQL is the source of truth.

Redis is not the CRM database.

### 2. WhatsApp is a provider, not the CRM architecture.

Never couple domain logic directly to Baileys.

### 3. Background work belongs in the worker.

Do not execute persistent jobs inside serverless request handlers.

### 4. Every send must be idempotent.

A retry must not equal another message.

### 5. Delivery status and sales pipeline are different concepts.

Never combine them into one status field.

### 6. Opt-out always wins.

No campaign can override `do_not_contact`.

### 7. Preserve history.

Archive rather than destroy CRM records.

### 8. Realtime is presentation infrastructure.

The database remains authoritative.

### 9. Keep v1 small.

The objective is to make:

**Lead → Reply → Project**

work exceptionally well.

---

# 70. Final Technology Decision

The final production-oriented stack is:

```text
FRONTEND
Next.js
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
dnd-kit

BACKEND
Next.js Route Handlers
Next.js Server Actions
Node.js Worker
TypeScript

DATABASE
PostgreSQL
Supabase
Prisma

AUTH
Supabase Auth

REALTIME
Supabase Realtime

QUEUE
BullMQ
Upstash Redis

IMPORT
SheetJS
Papa Parse
libphonenumber-js

WHATSAPP
WhatsAppProvider abstraction
BaileysProvider — MVP
CloudApiProvider — production target

STORAGE
Supabase Storage

OBSERVABILITY
Pino
Sentry

TESTING
Vitest
Playwright

DEPLOYMENT
Vercel
Railway
Supabase
Upstash
```

---

# 71. Final System Boundary

The most important architectural boundary is:

```text
┌────────────────────────────────────────────┐
│                  CRM CORE                  │
│                                            │
│ Contacts                                   │
│ Campaigns                                  │
│ Messages                                  │
│ Inbox                                     │
│ Pipeline                                  │
│ Projects                                  │
│ Tasks                                     │
│                                            │
└───────────────────┬────────────────────────┘
                    │
             MessagingService
                    │
             WhatsAppProvider
                    │
        ┌───────────┴───────────┐
        │                       │
   BaileysProvider       CloudApiProvider
        │                       │
        ▼                       ▼
   WhatsApp Web          Meta WhatsApp API
```

This boundary is the key architectural decision.

**The CRM should survive even if the WhatsApp implementation changes completely.**

That gives the product a clean MVP path while preserving a credible route to a production-grade WhatsApp integration later.