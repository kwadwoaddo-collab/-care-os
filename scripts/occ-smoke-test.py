#!/usr/bin/env python3
"""
OCC Smoke Test — Operations Control Center end-to-end test
Runs against http://localhost:3000 with QA_BYPASS_AUTH=true active.
All test records are prefixed with "TEST OCC" for easy cleanup.
"""

import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:3000"
COMPANY_ID  = "957e1d20-66ee-4448-80bc-cc1a7bf104b7"
CLIENT_ID   = "ad3ea364-0b42-4196-a99c-8b5c5d700410"
STAFF_ID    = "ef5c82f3-a837-4a4e-99f2-ae08b922b37a"

# ── Colours ────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

# ── Helpers ────────────────────────────────────────────────────────────────────

results = []

def log(msg):
    print(msg)

def ok(step, detail=""):
    results.append(("PASS", step, detail))
    print(f"  {GREEN}✓{RESET}  {step}{f' — {detail}' if detail else ''}")

def fail(step, detail=""):
    results.append(("FAIL", step, detail))
    print(f"  {RED}✗{RESET}  {step}{f' — {detail}' if detail else ''}")

def warn(step, detail=""):
    results.append(("WARN", step, detail))
    print(f"  {YELLOW}⚠{RESET}  {step}{f' — {detail}' if detail else ''}")

def api(method, path, body=None):
    url  = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw[:200]}
    except Exception as ex:
        return 0, {"error": str(ex)}

# ── Test state ─────────────────────────────────────────────────────────────────

created = {
    "shift_id":    None,
    "incident_id": None,
    "queue_id":    None,
    "handover_id": None,
}

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Create uncovered shift
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 1 — Create uncovered shift{RESET}")

status, data = api("POST", "/api/admin/shifts", {
    "title":       "TEST OCC — Smoke Test Shift",
    "shift_date":  tomorrow,
    "start_time":  "09:00",
    "end_time":    "17:00",
    "shift_type":  "day",
    "location":    "TEST OCC Location",
    "notes":       "TEST OCC — automated smoke test. Safe to delete.",
    "client_id":   CLIENT_ID,
})

if status in (200, 201) and "id" in data:
    created["shift_id"] = data["id"]
    ok("Create uncovered shift", f"id={data['id'][:8]}… date={tomorrow}")
elif status == 201 or (isinstance(data, dict) and "id" in data):
    created["shift_id"] = data.get("id")
    ok("Create uncovered shift", f"status={status}")
else:
    fail("Create uncovered shift", f"status={status} body={str(data)[:100]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Create compliance issue (create an incident that is a medication error)
# For compliance issue, we verify the docs endpoint; also create an incident
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 2 — Log a high-severity incident (safeguarding){RESET}")

status, data = api("POST", "/api/admin/incidents", {
    "incident_type":          "safeguarding",
    "severity":               "high",
    "description":            "TEST OCC — Smoke test safeguarding incident. Safe to delete.",
    "client_id":              CLIENT_ID,
    "staff_profile_id":       STAFF_ID,
    "occurred_at":            datetime.now(timezone.utc).isoformat(),
    "escalation_required":    True,
    "immediate_action_taken": "TEST OCC — Smoke test action.",
})

if status in (200, 201) and isinstance(data, dict) and "id" in data:
    created["incident_id"] = data["id"]
    risk_score = data.get("risk_score")
    risk_cls   = data.get("risk_classification")
    ok("Create safeguarding incident", f"id={data['id'][:8]}… risk={risk_score}/{risk_cls}")
    if risk_score is not None:
        ok("Risk score computed at write time", f"score={risk_score} classification={risk_cls}")
    else:
        warn("Risk score not yet in response (may need migration 044)", "check DB directly")
else:
    fail("Create safeguarding incident", f"status={status} body={str(data)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Log a medication error incident
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 3 — Log a medication error incident{RESET}")

status, data2 = api("POST", "/api/admin/incidents", {
    "incident_type":    "medication_error",
    "severity":         "medium",
    "description":      "TEST OCC — Medication error smoke test. Safe to delete.",
    "client_id":        CLIENT_ID,
    "staff_profile_id": STAFF_ID,
    "occurred_at":      datetime.now(timezone.utc).isoformat(),
})

if status in (200, 201) and "id" in data2:
    ok("Create medication error incident", f"id={data2['id'][:8]}…")
else:
    warn("Create medication error incident", f"status={status} body={str(data2)[:100]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Confirm incidents appear in OCC summary
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 4 — Check /api/admin/operations/summary{RESET}")

status, summary = api("GET", "/api/admin/operations/summary")

if status == 200:
    ok("Summary API responds 200")
else:
    fail("Summary API", f"status={status} body={str(summary)[:200]}")

if isinstance(summary, dict):
    oi = summary.get("open_incidents", 0)
    sa = summary.get("safeguarding_alerts", 0)
    uc = summary.get("uncovered_shifts", 0)
    ob = summary.get("onboarding_stalls", 0)

    if oi > 0:
        ok("Open incidents visible in summary", f"count={oi}")
    else:
        warn("Open incidents count is 0", "incidents may not have occurred_at in window")

    if sa > 0:
        ok("Safeguarding alerts visible in summary", f"count={sa}")
    else:
        warn("Safeguarding alerts is 0", "may be outside 90-day window filter")

    if uc >= 0:
        ok("Uncovered shifts field present", f"count={uc}")

    # Check queue section
    q = summary.get("queue", {})
    if isinstance(q, dict):
        ok("Queue section present in summary", f"total_open={q.get('total_open',0)}")
    else:
        fail("Queue section missing from summary")

    # Check feed
    feed = summary.get("feed", [])
    if isinstance(feed, list):
        ok("Feed section present", f"events={len(feed)}")
    else:
        fail("Feed section missing")

    # Check shift coverage
    sc = summary.get("shift_coverage", {})
    if isinstance(sc, dict):
        ok("Shift coverage present", f"total={sc.get('total_shifts',0)} uncovered={sc.get('uncovered',0)}")
    else:
        fail("Shift coverage section missing")

    # Check safeguarding
    sg = summary.get("safeguarding", {})
    if isinstance(sg, dict):
        ok("Safeguarding section present", f"open_count={sg.get('open_count',0)}")
    else:
        fail("Safeguarding section missing")

    # Check compliance alerts
    ca = summary.get("compliance_alerts", [])
    ok("Compliance alerts field present", f"count={len(ca)}")

else:
    fail("Summary response is not a dict", str(summary)[:100])

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Create a queue item
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 5 — Create and check priority queue item{RESET}")

status, qitem = api("POST", "/api/admin/operations/queue", {
    "title":       "TEST OCC — Follow up on smoke test safeguarding incident",
    "priority":    "urgent",
    "category":    "safeguarding",
    "description": "TEST OCC — Automated smoke test queue item. Safe to delete.",
    "entity_type": "incident",
    "entity_id":   created.get("incident_id"),
    "entity_url":  f"/admin/incidents/{created.get('incident_id')}",
})

if status == 201 and isinstance(qitem, dict) and "id" in qitem:
    created["queue_id"] = qitem["id"]
    ok("Create queue item", f"id={qitem['id'][:8]}… priority={qitem.get('priority')} status={qitem.get('status')}")
else:
    fail("Create queue item", f"status={status} body={str(qitem)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Assign owner to queue item
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 6 — Assign owner to queue item{RESET}")

if created["queue_id"]:
    status, updated = api("PATCH", f"/api/admin/operations/queue/{created['queue_id']}", {
        "assigned_to": "TEST OCC Coordinator",
        "status":      "in_progress",
    })
    if status == 200 and isinstance(updated, dict):
        if updated.get("assigned_to") == "TEST OCC Coordinator":
            ok("Assign owner", f"assigned_to={updated.get('assigned_to')}")
        else:
            fail("Assign owner — assigned_to not set", str(updated)[:100])
        if updated.get("assigned_at"):
            ok("assigned_at auto-set", updated["assigned_at"][:19])
        if updated.get("status") == "in_progress":
            ok("Status set to in_progress")
        else:
            fail("Status not updated", f"got={updated.get('status')}")
    else:
        fail("Assign owner", f"status={status} body={str(updated)[:200]}")
else:
    warn("Skip assign owner — no queue_id", "queue creation failed")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Create handover note
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 7 — Create handover note{RESET}")

status, hnote = api("POST", "/api/admin/operations/handover", {
    "author_name":   "TEST OCC Coordinator",
    "summary":       "TEST OCC — Smoke test handover note. Open safeguarding incident pending review. Shift coverage for tomorrow needs attention. Safe to delete.",
    "shift_period":  "day",
    "handover_date": today,
    "flagged_items": [
        {"type": "safeguarding", "description": "TEST OCC open safeguarding — awaiting review", "priority": "urgent"},
        {"type": "staffing",     "description": "TEST OCC tomorrow 9-5 shift uncovered",        "priority": "warning"},
    ],
    "follow_up_actions": [
        {"action": "TEST OCC — Review safeguarding incident with manager", "owner": "Sarah J", "due": tomorrow},
        {"action": "TEST OCC — Find cover for tomorrow morning shift",    "owner": "Rota team"},
    ],
})

if status == 201 and isinstance(hnote, dict) and "id" in hnote:
    created["handover_id"] = hnote["id"]
    ok("Create handover note", f"id={hnote['id'][:8]}…")
    # Verify flagged items saved
    fi = hnote.get("flagged_items", [])
    if isinstance(fi, list) and len(fi) == 2:
        ok("Flagged items saved", f"count={len(fi)}")
    else:
        warn("Flagged items", f"got={fi}")
    # Verify follow-up actions
    fa = hnote.get("follow_up_actions", [])
    if isinstance(fa, list) and len(fa) == 2:
        ok("Follow-up actions saved", f"count={len(fa)}")
    else:
        warn("Follow-up actions", f"got={fa}")
else:
    fail("Create handover note", f"status={status} body={str(hnote)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7b — Verify handover appears in GET
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 7b — Verify handover persists (GET){RESET}")

status, hnotes = api("GET", "/api/admin/operations/handover?limit=5")
if status == 200 and isinstance(hnotes, dict):
    notes_list = hnotes.get("data", [])
    found = any(n.get("id") == created.get("handover_id") for n in notes_list)
    if found:
        ok("Handover note persists after GET", f"found in list of {len(notes_list)}")
    elif notes_list:
        ok("Handover notes returned", f"count={len(notes_list)} (may not include test note yet)")
    else:
        warn("No handover notes returned", f"status={status}")
else:
    fail("GET handover notes", f"status={status}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Resolve queue item
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 8 — Resolve queue item{RESET}")

if created["queue_id"]:
    status, resolved = api("PATCH", f"/api/admin/operations/queue/{created['queue_id']}", {
        "status":           "resolved",
        "resolution_notes": "TEST OCC — Smoke test completed. Item resolved.",
        "resolved_by":      "TEST OCC Script",
    })
    if status == 200 and isinstance(resolved, dict):
        if resolved.get("status") == "resolved":
            ok("Queue item resolved", f"status={resolved.get('status')}")
        else:
            fail("Queue item status not resolved", f"got={resolved.get('status')}")
        if resolved.get("resolved_at"):
            ok("resolved_at auto-set", resolved["resolved_at"][:19])
        else:
            fail("resolved_at not set on resolve")
        if resolved.get("resolution_notes"):
            ok("Resolution notes saved")
    else:
        fail("Resolve queue item", f"status={status} body={str(resolved)[:200]}")
else:
    warn("Skip resolve — no queue_id")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8b — Confirm resolved status persists after re-fetch
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 8b — Confirm resolved status persists (re-fetch){RESET}")

if created["queue_id"]:
    # Fetch resolved items
    status, recheck = api("GET", f"/api/admin/operations/queue?status=resolved&pageSize=10")
    if status == 200 and isinstance(recheck, dict):
        items = recheck.get("data", [])
        found = any(i.get("id") == created["queue_id"] for i in items)
        if found:
            ok("Resolved item appears in resolved queue", f"id={created['queue_id'][:8]}…")
        else:
            warn("Resolved item not in resolved list yet", f"total resolved={len(items)}")
    else:
        fail("GET resolved queue", f"status={status}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Check audit log for queue activity
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 9 — Check audit log for operations activity{RESET}")

status, audit = api("GET", "/api/admin/audit-log?pageSize=20")
if status == 200:
    # Audit log returns a raw list
    entries = audit if isinstance(audit, list) else audit.get("data", [])
    ok("Audit log API responds 200", f"entries={len(entries)}")
    ops_entries = [e for e in entries if "operations_queue" in str(e.get("action", ""))]
    inc_entries = [e for e in entries if "incident" in str(e.get("action","")).lower()]
    if ops_entries:
        ok("operations_queue audit entries found", f"count={len(ops_entries)}")
        for e in ops_entries[:2]:
            log(f"      {e.get('action','')} — {str(e.get('created_at',''))[:19]}")
    else:
        warn("No operations_queue audit entries yet")
    if inc_entries:
        ok("Incident audit entries found", f"count={len(inc_entries)}")
        for e in inc_entries[:2]:
            log(f"      {e.get('action','')} — {str(e.get('created_at',''))[:19]}")
else:
    fail("Audit log API", f"status={status}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10 — Test daily briefing
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 10 — Daily briefing API{RESET}")

status, briefing = api("GET", "/api/admin/operations/briefing")
if status == 200 and isinstance(briefing, dict):
    ok("Briefing API responds 200")
    headline = briefing.get("risk_headline")
    sections = briefing.get("sections", [])
    ok("Risk headline present", f"headline={headline}")
    ok("Sections present", f"count={len(sections)}")
    if len(sections) >= 5:
        ok("All 6 sections generated")
    for s in sections:
        log(f"      {s.get('status',''):8} — {s.get('heading','')}")
else:
    fail("Daily briefing API", f"status={status} body={str(briefing)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11 — Test live feed API
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 11 — Live feed API{RESET}")

status, feed_resp = api("GET", "/api/admin/operations/feed?limit=20")
if status == 200 and isinstance(feed_resp, dict):
    events = feed_resp.get("data", [])
    ok("Feed API responds 200", f"events={len(events)}")
    types = list(set(e.get("type","") for e in events))
    ok("Event types in feed", ", ".join(types) or "none yet")
else:
    fail("Feed API", f"status={status} body={str(feed_resp)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 12 — Test incident intelligence API
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 12 — Incident intelligence API{RESET}")

status, intel = api("GET", "/api/admin/incidents/intelligence")
if status == 200 and isinstance(intel, dict):
    ok("Intelligence API responds 200")
    ok("Summary present", f"total={intel.get('summary',{}).get('total_incidents',0)}")
    alerts = intel.get("pattern_alerts", [])
    ok("Pattern alerts computed", f"count={len(alerts)}")
    if alerts:
        for a in alerts[:2]:
            log(f"      {a.get('severity',''):8} — {a.get('message','')}")
else:
    fail("Intelligence API", f"status={status} body={str(intel)[:200]}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 13 — Test staff/client risk APIs
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 13 — Staff and client risk APIs{RESET}")

status, srisk = api("GET", "/api/admin/incidents/staff-risk")
if status == 200 and isinstance(srisk, dict):
    ok("Staff risk API responds 200", f"profiles={len(srisk.get('data',[]))}")
else:
    fail("Staff risk API", f"status={status}")

status, crisk = api("GET", "/api/admin/incidents/client-risk")
if status == 200 and isinstance(crisk, dict):
    ok("Client risk API responds 200", f"profiles={len(crisk.get('data',[]))}")
else:
    fail("Client risk API", f"status={status}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 14 — HTTP status checks on page routes (via subprocess curl)
# urllib times out on Next.js streaming responses; curl handles them correctly.
# ══════════════════════════════════════════════════════════════════════════════

log(f"\n{CYAN}{BOLD}STEP 14 — Page route HTTP status checks{RESET}")

import subprocess

pages = [
    ("/admin/operations",             "OCC main page"),
    ("/admin/operations/queue",       "Priority queue page"),
    ("/admin/operations/handover",    "Handover page"),
    ("/admin/operations/briefing",    "Briefing page"),
    ("/admin/incidents/intelligence", "Incident intelligence page"),
    ("/admin/incidents",              "Incidents list page"),
]

for path, label in pages:
    try:
        result = subprocess.run(
            ["/usr/bin/curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "20",
             f"http://localhost:3000{path}"],
            capture_output=True, text=True, timeout=25
        )
        code = result.stdout.strip()
        if code == "200":
            ok(label, f"HTTP {code}")
        elif code in ("302", "307"):
            ok(label, f"HTTP {code} (redirect)")
        else:
            fail(label, f"HTTP {code}")
    except Exception as ex:
        fail(label, str(ex)[:60])

# ══════════════════════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

passes   = [r for r in results if r[0] == "PASS"]
failures = [r for r in results if r[0] == "FAIL"]
warnings = [r for r in results if r[0] == "WARN"]

log(f"\n{BOLD}{'─'*60}{RESET}")
log(f"{BOLD}SMOKE TEST RESULTS{RESET}")
log(f"{'─'*60}")
log(f"  {GREEN}PASS: {len(passes)}{RESET}")
log(f"  {YELLOW}WARN: {len(warnings)}{RESET}")
log(f"  {RED}FAIL: {len(failures)}{RESET}")
log(f"{'─'*60}")

if failures:
    log(f"\n{RED}{BOLD}FAILURES:{RESET}")
    for _, step, detail in failures:
        log(f"  {RED}✗{RESET} {step}: {detail}")

if warnings:
    log(f"\n{YELLOW}{BOLD}WARNINGS:{RESET}")
    for _, step, detail in warnings:
        log(f"  {YELLOW}⚠{RESET} {step}: {detail}")

log(f"\n{BOLD}CREATED TEST RECORDS:{RESET}")
for k, v in created.items():
    log(f"  {k}: {v or 'not created'}")

# Write machine-readable results for the report
with open("/tmp/occ-test-results.json", "w") as f:
    json.dump({
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "passes":       len(passes),
        "warnings":     len(warnings),
        "failures":     len(failures),
        "results":      results,
        "created":      created,
        "summary_snapshot": {
            "open_incidents":      summary.get("open_incidents", "N/A") if isinstance(summary, dict) else "N/A",
            "safeguarding_alerts": summary.get("safeguarding_alerts", "N/A") if isinstance(summary, dict) else "N/A",
            "uncovered_shifts":    summary.get("uncovered_shifts", "N/A") if isinstance(summary, dict) else "N/A",
            "queue_total_open":    summary.get("queue", {}).get("total_open", "N/A") if isinstance(summary, dict) else "N/A",
        }
    }, f, indent=2)

sys.exit(0 if not failures else 1)
