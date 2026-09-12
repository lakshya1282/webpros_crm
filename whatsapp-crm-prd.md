# PRD: WhatsApp Outreach CRM (Lead → Reply → Project)

## 1. Problem Statement
Manually copy-pasting messages to leads on WhatsApp and tracking replies in your head (or a spreadsheet) doesn't scale past ~20 contacts. You need a tool that turns a raw contact list into a trackable outreach pipeline, and turns replies into managed projects — without hiring a team or paying for enterprise WhatsApp tooling.

## 2. Goals
- Import a list of leads (name, phone, company, etc.) from Excel/CSV in one step, cleaned and de-duplicated.
- Send a personalized cold DM to all (or a segment of) leads on WhatsApp with one click.
- Track every contact's outreach status automatically (Sent → Delivered → Replied) and manually (Interested → Negotiating → Won/Lost).
- Give contacts who reply and convert their own lightweight project space (tasks, notes, deadline).

## 3. Non-Goals (v1)
- Not building a full email/SMS omni-channel tool — WhatsApp only.
- Not building multi-user/team permissions — single-operator tool.
- Not replacing a real accounting/invoicing system.

## 4. Primary User
You: a solo operator doing B2B outreach (e.g. pitching web dev services to agencies/businesses) who needs the whole loop — import, send, track, convert — in one dashboard.

## 5. Core Features

### 5.1 Contact Import
- Upload `.xlsx` or `.csv`.
- Auto-detect columns → map to schema (Name, Phone, Company, Email, Source, Notes) via a confirmation screen — never assume column order blindly.
- Normalize every phone number to E.164 (+countrycode...). Reject/flag rows that can't be normalized.
- De-duplicate against existing contacts by phone number; show "X new, Y duplicates skipped, Z invalid" summary before committing.
- Tag each import batch (e.g. "Instagram agencies – Sept batch") so you can segment later.

### 5.2 Bulk WhatsApp Cold Outreach
- Compose a message template with merge fields: `{{name}}`, `{{company}}`.
- Select a segment (by import tag, or manually) → preview 2-3 rendered messages → click **Send Campaign**.
- Messages queue and send with randomized delay + a daily send cap (not instantly, not all at once — see §8).
- Live progress bar: Queued / Sent / Failed / Delivered counts.

### 5.3 Status Tracking
- Auto status: `Not Contacted → Queued → Sent → Delivered → Replied → Failed`.
- Manual pipeline stage (you set this): `New Lead → Contacted → Replied → Negotiating → Won → Lost`.
- Kanban board view of manual pipeline stage, drag-and-drop to update.
- Unified inbox: every inbound WhatsApp reply lands against the right contact automatically.

### 5.4 Project Management Dashboard (for Won/responded contacts)
- Marking a contact "Won" auto-creates a Project linked to that contact + originating campaign.
- Project has: task list (title, due date, done/not done), notes, deal value, status (In Progress/Delivered/Paid).
- Dashboard view: all active projects, overdue tasks highlighted.

## 6. Tech Stack (decided)
Picking one stack so you can start building today instead of evaluating options:

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | You already know this from Prompsy — zero new learning curve |
| Backend | Next.js API routes for CRUD; a **separate long-running Node worker** for WhatsApp | WhatsApp connection must stay alive persistently — can't live in serverless functions |
| Database | PostgreSQL via Supabase | Free tier, built-in auth, realtime subscriptions (great for live status updates on the Kanban board) |
| ORM | Prisma | Type-safe schema, easy migrations |
| Queue | BullMQ + Redis (Upstash free tier) | Needed to throttle/delay sends — see §8 |
| File parsing | `xlsx` (SheetJS) for Excel, `papaparse` for CSV | Standard, battle-tested |
| WhatsApp sending | **Baileys** (open-source WhatsApp Web multi-device library) | Free, no per-message cost, works with your existing number — trade-off explained in §8 |
| Drag-and-drop Kanban | `dnd-kit` | Lightweight, accessible |

## 7. Data Model

```
Contact
  id, name, phone (E.164, unique), company, email, source_tag,
  auto_status, pipeline_stage, do_not_contact (bool), created_at

Campaign
  id, name, message_template, created_at

CampaignContact  (join table)
  campaign_id, contact_id, send_status, sent_at, error_reason

Message  (full conversation log)
  id, contact_id, direction (in/out), body, campaign_id (nullable), timestamp

Project
  id, contact_id, campaign_id, deal_value, status, notes, created_at

Task
  id, project_id, title, due_date, is_done
```

## 8. WhatsApp Integration — the decision that matters most

Two real paths exist. Recommendation: **start with Baileys, graduate to the official Cloud API once volume justifies it.**

**Path A — Baileys (unofficial, automates your real WhatsApp Web session).** Free, sends from your actual number, no message templates to pre-approve. The real cost: WhatsApp's Business Policy prohibits unsolicited bulk messaging to non-opted-in contacts, and this runs on reverse-engineered protocol access rather than an approved API — so a number sending fast, identical, unsolicited messages to strangers can get flagged, rate-limited, or banned, and the library itself can break when WhatsApp changes its protocol. Mitigate, don't ignore:
- Hard daily cap: start at 20-30 new-contact messages/day, not hundreds.
- Randomized delay between sends (30-120 sec), not a tight loop.
- Vary message text slightly per send (synonym swaps) instead of byte-identical templates.
- Only send within business hours in the recipient's timezone.
- Auto-pause the whole queue the moment a send errors out (session logout, number banned) instead of retrying blindly.

**Path B — Meta's WhatsApp Business Cloud API (official).** Requires a verified WhatsApp Business Account, message templates pre-approved by Meta, and per-conversation cost. Reliable and scalable, but cold outreach to people who haven't messaged you first is still restricted to approved template categories — it doesn't remove the opt-in problem, it just makes you compliant on paper.

Build the sending layer behind one interface (`sendMessage(contact, body)`) so swapping Baileys for the Cloud API later is a backend change, not a rewrite.

## 9. Pipeline (end-to-end flow)

```
[Excel/CSV] → Parse & validate → Map columns → Dedupe check
      → [Contacts table]
                  ↓
      Select segment → Write template → Preview
                  ↓
      [Campaign created] → Enqueue one job per contact (BullMQ)
                  ↓
      Worker: wait random delay → send via Baileys → update send_status
                  ↓
      ┌─────────────┴─────────────┐
   Delivered                   Failed/Invalid
      ↓                             ↓
 Inbound listener            Mark contact, stop retry,
 catches reply → matches     surface in "needs attention" list
 phone → Message log
      ↓
 auto_status = Replied → shows in unified inbox
      ↓
 You manually set pipeline_stage (Negotiating → Won)
      ↓
 Won → auto-create Project → Project Dashboard (tasks, notes, deadlines)
```

## 10. Edge Cases

**Import**
- Phone numbers missing country code, stored as text with leading zeros, or as numbers (Excel strips leading `+`/`0`) — normalize and flag unparseable rows for manual fix, don't silently drop them.
- Same person appears with two different numbers across two imports — no auto-merge; surface as a "possible duplicate" for manual review instead of guessing.
- File has merged header cells, multiple sheets, or the header isn't row 1 — always show the column-mapping confirmation screen, never assume layout.
- Very large files (5k+ rows) — process as a background job with a progress indicator, not a blocking request that times out.
- Regional-language names / emojis in cells — ensure UTF-8 handling end to end so these don't get mangled.

**Sending**
- Number isn't on WhatsApp at all — mark "Invalid" permanently, exclude from all future campaigns automatically.
- Session logs out mid-campaign (QR expired) — pause the entire queue and alert you; don't let jobs silently fail one by one.
- A worker crash and job retry causes the same message to send twice — make sends idempotent (check `send_status` before sending, not just before enqueueing).
- Merge field is empty (no company name on file) — template needs a safe fallback string, not `{{company}}` printed literally.
- A contact replies "STOP" or asks not to be contacted — `do_not_contact` flag must be permanent and checked before every future send, including future campaigns and re-imports of the same number.

**Status & Pipeline**
- Reply is ambiguous ("who is this?") — don't auto-advance pipeline_stage on any reply; only auto_status moves automatically, pipeline_stage stays manual/human-judged.
- Contact replies weeks after being marked "Lost" — reopening should be one click, not a re-import.
- Two browser tabs open, both update the same contact's stage — last-write-wins is fine for a single-operator tool, but the UI should reflect the DB state via realtime subscription, not a stale local cache.

**Projects**
- Deleting a contact that has an active Project — block hard delete, offer archive instead, so project history isn't orphaned.
- Project won from a contact who was never in a campaign (e.g. added manually) — Project creation shouldn't hard-require a `campaign_id`, make it nullable.

## 11. Build Order (suggested milestones)
1. **Week 1** — DB schema + Contact import (parse, map, dedupe) + plain contact list UI.
2. **Week 2** — Campaign creation + Baileys worker with throttling + send status tracking.
3. **Week 3** — Inbound reply listener + unified inbox + Kanban pipeline board.
4. **Week 4** — Project auto-creation on "Won" + task list + project dashboard.

Ship after Week 2 if you need to start outreach sooner — everything from Week 3 onward can run manually (checking WhatsApp yourself for replies) while you build it.
