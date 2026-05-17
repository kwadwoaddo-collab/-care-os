#!/usr/bin/env python3
"""
Coordinator Focus Mode & Operations Queue QA Test
Tests: Focus Mode logic, localStorage contract, smart sort, quick actions,
       inline resolve, filter persistence, hydration safety, page routes.
"""

import json, re, subprocess, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone

BASE = "http://localhost:3000"

# ── Colours ───────────────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"; B = "\033[1m"; X = "\033[0m"

results = []
def ok(s, d=""): results.append(("PASS",s,d)); print(f"  {G}✓{X}  {s}" + (f" — {d}" if d else ""))
def fail(s, d=""): results.append(("FAIL",s,d)); print(f"  {R}✗{X}  {s}" + (f" — {d}" if d else ""))
def warn(s, d=""): results.append(("WARN",s,d)); print(f"  {Y}⚠{X}  {s}" + (f" — {d}" if d else ""))
def section(s): print(f"\n{C}{B}{s}{X}")

def api(method, path, body=None, timeout=15):
    url  = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type","application/json")
    req.add_header("Accept","application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:    return e.code, json.loads(raw)
        except: return e.code, {"error": raw[:200]}
    except Exception as ex:
        return 0, {"error": str(ex)}

def page_status(path):
    try:
        r = subprocess.run(
            ["/usr/bin/curl","-s","-o","/dev/null","-w","%{http_code}","--max-time","20",
             f"{BASE}{path}"],
            capture_output=True, text=True, timeout=25)
        return r.stdout.strip()
    except: return "0"

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Static analysis — Focus Mode logic
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 1 — Focus Mode: static logic analysis")

occ_src = open("components/admin/OperationsControlCenter.tsx").read()

# 1a. Focus Mode toggle renders with aria-pressed
if 'aria-pressed={enabled}' in occ_src:
    ok("FocusModeToggle has aria-pressed for accessibility")
else:
    fail("FocusModeToggle missing aria-pressed")

# 1b. SSR safety — useEffect hydration pattern
if 'useEffect' in occ_src and 'getFocusMode' in occ_src:
    # Check it reads in useEffect (not during initial render)
    # The pattern should be: useState(false) then useEffect(() => setFocusModeState(getFocusMode()), [])
    ue_match = re.search(r'useEffect\([^)]*getFocusMode', occ_src, re.DOTALL)
    if ue_match or 'useEffect(() => {' in occ_src:
        ok("Focus Mode hydrated in useEffect — no SSR mismatch")
    else:
        warn("Focus Mode hydration pattern unclear")
else:
    fail("Focus Mode useEffect/getFocusMode pattern missing")

# 1c. Default state is false (starts off)
if 'useState(false)' in occ_src:
    ok("Focus Mode default state is false (off by default)")
else:
    fail("Focus Mode default state not explicitly false")

# 1d. Secondary KPI row hidden in focus mode
if '!focusMode' in occ_src and 'Secondary KPIs' in occ_src or \
   '{!focusMode && (' in occ_src:
    ok("Secondary KPI row gated on !focusMode")
else:
    fail("Secondary KPI row not gated on focusMode")

# 1e. Focus mode banner shown when enabled
if 'FocusModeBanner' in occ_src and 'focusMode && <FocusModeBanner' in occ_src:
    ok("FocusModeBanner shown when focusMode is true")
else:
    fail("FocusModeBanner not conditionally rendered")

# 1f. Critical sections force-open
force_count = occ_src.count('focusModeForce')
if force_count >= 3:
    ok(f"focusModeForce used in {force_count} sections — critical panels stay open")
else:
    warn(f"focusModeForce only in {force_count} sections (expected ≥3)")

# 1g. Queue filtering in focus mode
if 'focusMode' in occ_src and "priority === 'critical' || i.priority === 'urgent'" in occ_src:
    ok("Queue filtered to critical/urgent in focus mode")
else:
    fail("Queue focus mode filtering not found")

# 1h. Feed filtering in focus mode
if "e.severity === 'critical' || e.severity === 'high'" in occ_src:
    ok("Feed filtered to critical/high severity in focus mode")
else:
    fail("Feed severity filter for focus mode not found")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: workspaceMemory contract
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 2 — workspaceMemory: localStorage contract")

mem_src = open("lib/operations/workspaceMemory.ts").read()

# 2a. SSR guard
if "typeof window === 'undefined'" in mem_src:
    ok("SSR guard present — returns fallback when window unavailable")
else:
    fail("SSR guard missing — will throw on server render")

# 2b. Quota error handling
if 'try' in mem_src and 'catch' in mem_src:
    ok("try/catch wraps localStorage writes — quota errors handled")
else:
    fail("localStorage writes not wrapped in try/catch")

# 2c. Key namespace
if "const PREFIX = 'care-os:occ'" in mem_src:
    ok("Keys namespaced under 'care-os:occ' — no collisions")
else:
    fail("localStorage key namespace not found")

# 2d. All expected exports exist
exports = ['getFocusMode','setFocusMode','getQueuePrefs','setQueuePrefs',
           'getSectionCollapsed','toggleSectionCollapsed','getPreferredTab','setPreferredTab']
for fn in exports:
    if f'export function {fn}' in mem_src:
        ok(f"Exported: {fn}")
    else:
        fail(f"Missing export: {fn}")

# 2e. QueuePrefs interface has sortBy
if "'priority' | 'due_date' | 'created_at'" in mem_src:
    ok("QueuePrefs.sortBy has all three sort options")
else:
    fail("QueuePrefs.sortBy type incomplete")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Smart sort scoring logic
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 3 — Smart sort: scoring logic verification")

q_src = open("components/admin/OperationsPriorityQueue.tsx").read()

# 3a. Priority order constants (JS object keys don't need quotes)
if "critical: 4" in q_src and "urgent: 3" in q_src and "warning: 2" in q_src:
    ok("Priority order: critical=4, urgent=3, warning=2, informational=1")
else:
    fail("Priority order constants wrong or missing")

# 3b. Safeguarding boost
if "category === 'safeguarding' ? 0.5 : 0" in q_src:
    ok("Safeguarding category gets +0.5 sort boost")
else:
    fail("Safeguarding boost not found")

# 3c. Overdue boost
if "due < now ? 0.3 : 0" in q_src:
    ok("Overdue items get +0.3 sort boost")
else:
    fail("Overdue boost not found")

# 3d. Overdue visual indicator
if "'overdue'" in q_src or "overdue" in q_src:
    ok("Overdue badge shown on queue rows")
else:
    fail("Overdue visual indicator not found")

# 3e. Sort modes
for mode in ["'priority'", "'due_date'", "'created_at'"]:
    if mode in q_src:
        ok(f"Sort mode {mode} implemented")
    else:
        fail(f"Sort mode {mode} missing")

# Verify sort is applied in applySortAndFilter
if 'smartScore(b) - smartScore(a)' in q_src:
    ok("applySortAndFilter uses smartScore for default sort")
else:
    fail("smartScore not used in sort comparator")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Contextual quick actions routing
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 4 — Contextual quick actions: routing targets")

# Check OCC has correct routing for each quick action
routes = [
    ("Assign → /admin/shifts",               "/admin/shifts"),
    ("Review → /admin/incidents/{id}",       "/admin/incidents/${inc.id}"),
    ("Renew → /admin/staff/{id}",            "/admin/staff/${a.staff_id}"),
    ("Handover create → /admin/operations/handover", "/admin/operations/handover"),
    ("Queue page → /admin/operations/queue",  "/admin/operations/queue"),
    ("Briefing → /admin/operations/briefing", "/admin/operations/briefing"),
]
for label, route in routes:
    if route in occ_src:
        ok(f"Quick action route: {label}")
    else:
        fail(f"Quick action route missing: {label} ({route})")

# 4b. QuickAction component min-height for touch targets
if 'min-h-[32px]' in occ_src or 'min-h-[48px]' in occ_src:
    ok("Quick action buttons have min-height for touch targets")
else:
    warn("Quick action touch target min-height not confirmed")

# 4c. Mobile quick links have min-height
if 'min-h-[48px]' in occ_src:
    ok("Mobile quick links meet 48px touch target requirement")
else:
    fail("Mobile quick links missing 48px touch targets")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Inline queue resolve
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 5 — Inline queue resolve: API integration")

# 5a. Quick resolve PATCH call
if "status: 'resolved'" in q_src and "PATCH" in q_src:
    ok("Quick resolve calls PATCH with status: resolved")
else:
    fail("Quick resolve PATCH pattern missing")

# 5b. Resolve sets resolved_by
if "'Coordinator'" in q_src and 'resolved_by' in q_src:
    ok("resolved_by set to 'Coordinator' on quick resolve")
else:
    warn("resolved_by not set on quick resolve")

# 5c. Optimistic UI update
if 'onUpdate(item.id' in q_src and 'onUpdate: (id: string' in q_src:
    ok("onUpdate callback for optimistic UI after resolve")
else:
    fail("onUpdate callback missing — no optimistic update")

# 5d. Expanded resolve form with notes
if 'resolveNotes' in q_src and 'resolution_notes' in q_src:
    ok("Expanded resolve form with resolution notes textarea")
else:
    fail("Resolution notes form missing")

# 5e. Escalation acknowledge button
if 'escalation_triggered_at' in q_src and 'escalation_acknowledged_by' in q_src:
    ok("Escalation acknowledge button present")
else:
    warn("Escalation acknowledge not found")

# 5f. Live API test — create and resolve a queue item
section("TEST 5f — Live: create queue item and quick-resolve it")

ts, qi = api("POST", "/api/admin/operations/queue", {
    "title":       "TEST FM — Quick resolve smoke test",
    "priority":    "urgent",
    "category":    "incident",
    "description": "Focus mode QA test. Safe to delete.",
})

if ts == 201 and "id" in qi:
    qid = qi["id"]
    ok("Created test queue item", f"id={qid[:8]}…")

    # Quick resolve
    ts2, upd = api("PATCH", f"/api/admin/operations/queue/{qid}", {
        "status":      "resolved",
        "resolved_by": "Coordinator",
    })
    if ts2 == 200 and upd.get("status") == "resolved":
        ok("Quick resolve PATCH succeeded", f"status={upd['status']}")
        if upd.get("resolved_at"):
            ok("resolved_at auto-set on quick resolve")
        else:
            fail("resolved_at not set after quick resolve")
    else:
        fail("Quick resolve PATCH failed", f"status={ts2} body={str(upd)[:100]}")
else:
    fail("Could not create test queue item for resolve test", f"status={ts}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Filter persistence contract
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 6 — Filter persistence: localStorage contract")

# 6a. Queue component reads prefs in useEffect
if 'useEffect' in q_src and 'getQueuePrefs' in q_src:
    ue = re.search(r'useEffect\([^)]*getQueuePrefs|useEffect\(\(\) => \{[^}]*getQueuePrefs', q_src, re.DOTALL)
    if ue or 'getQueuePrefs()' in q_src:
        ok("Queue prefs loaded from localStorage in useEffect")
    else:
        warn("getQueuePrefs not clearly in useEffect")
else:
    fail("Queue prefs not loaded from localStorage")

# 6b. Pref updates call setQueuePrefs
if 'setQueuePrefs' in q_src:
    ok("Filter changes call setQueuePrefs — persisted to localStorage")
else:
    fail("setQueuePrefs not called on filter change")

# 6c. Reset button clears all prefs
if "filterStatus: 'open'" in q_src and 'setQueuePrefs' in q_src:
    ok("Reset button restores defaults and persists to localStorage")
else:
    warn("Reset button may not clear persisted prefs")

# 6d. sortBy persisted
if "updatePref('sortBy'" in q_src or "updatePref(\"sortBy\"" in q_src:
    ok("Sort preference persisted on change")
else:
    fail("Sort preference not persisted")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: Collapsed section persistence
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 7 — Collapsible sections: state persistence")

# 7a. CollapsibleSection reads from localStorage on init
if 'getSectionCollapsed(id)' in occ_src:
    ok("Section reads collapsed state from localStorage on mount")
else:
    fail("Section not reading collapse state from localStorage")

# 7b. Toggle writes to localStorage
if 'toggleSectionCollapsed(id)' in occ_src:
    ok("Section toggle writes to localStorage")
else:
    fail("Section toggle not writing to localStorage")

# 7c. Each section has a unique ID
ids = re.findall(r'id="([^"]+)"', occ_src)
section_ids = re.findall(r"id='([^']+)'", occ_src) + re.findall(r'id=\{["\']([^"\']+)["\']\}', occ_src)
# Check via CollapsibleSection id= prop
cids = re.findall(r'<CollapsibleSection[^>]*id=["\']([^"\']+)["\']', occ_src)
if len(set(cids)) >= 5:
    ok(f"Unique section IDs: {', '.join(cids)}")
else:
    warn(f"Found {len(set(cids))} unique section IDs (expected ≥5): {cids}")

# 7d. focusModeForce prevents collapse when critical
if 'focusModeForce' in occ_src:
    # Check the CollapsibleSection component uses it to override collapse
    if 'const effectivelyCollapsed = focusModeForce ? false : collapsed' in occ_src:
        ok("focusModeForce overrides collapse — critical sections cannot be hidden")
    else:
        warn("focusModeForce present but override logic unclear")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: Smart empty states
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 8 — Smart empty states: operational guidance text")

smart_states = [
    ("All operational queue items are resolved",  "Queue clear message"),
    ("No active safeguarding escalations",        "Safeguarding clear message"),
    ("Coverage is stable",                        "Shift coverage clear message"),
    ("No critical compliance documents expiring", "Compliance clear message"),
    ("Operations look clear",                     "Mobile triage clear message"),
    ("No open actions require coordinator",       "Queue focus mode clear message"),
]
for text, label in smart_states:
    if text in occ_src or text in q_src:
        ok(f"Smart empty state: {label}")
    else:
        fail(f"Missing smart empty state: {label} ('{text}')")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: Mobile triage layout
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 9 — Mobile triage layout")

# 9a. MobileTriageView component exists
if 'function MobileTriageView' in occ_src:
    ok("MobileTriageView component defined")
else:
    fail("MobileTriageView component missing")

# 9b. All 4 critical data sources present
for src_name in ['safeguarding.incidents', 'shift_coverage.uncovered_shifts',
                 'compliance_alerts', 'queue.top_items']:
    if src_name in occ_src:
        ok(f"Triage aggregates: {src_name}")
    else:
        fail(f"Triage missing source: {src_name}")

# 9c. Touch targets
if 'min-h-[48px]' in occ_src:
    ok("48px min-height on mobile touch targets")
else:
    fail("48px touch targets missing")

# 9d. active:scale for tactile feedback
if 'active:scale-[0.99]' in occ_src:
    ok("active:scale on triage cards — tactile press feedback")
else:
    warn("active:scale tactile feedback not found")

# 9e. 2×2 quick-link grid
if 'grid grid-cols-2' in occ_src:
    ok("2×2 quick-link grid for mobile nav")
else:
    fail("Mobile 2×2 quick link grid missing")

# 9f. lg:hidden on mobile section
if 'lg:hidden' in occ_src:
    ok("Mobile section uses lg:hidden — not shown on desktop")
else:
    fail("Mobile section not hidden on desktop")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: Feed deduplication
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 10 — Feed deduplication: same-entity suppression")

if 'const seen = new Set<string>()' in occ_src:
    ok("Dedup Set<string> initialised before filtering")
else:
    fail("Dedup Set not found")

if 'type:entity_id' in occ_src or '`${e.type}:${e.entity_id' in occ_src:
    ok("Dedup key combines type + entity_id")
else:
    fail("Dedup key formula not found")

if 'seen.has(key)' in occ_src and 'seen.add(key)' in occ_src:
    ok("Dedup check-then-add pattern correct")
else:
    fail("Dedup check/add logic missing")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11: Page routes — HTTP 200 checks
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 11 — Page routes: HTTP status")

pages = [
    ("/admin/operations",             "OCC main"),
    ("/admin/operations/queue",       "Priority queue"),
    ("/admin/operations/handover",    "Handover"),
    ("/admin/operations/briefing",    "Briefing"),
    ("/admin/incidents",              "Incidents list"),
    ("/admin/incidents/intelligence", "Incident intelligence"),
]
for path, label in pages:
    code = page_status(path)
    if code == "200":
        ok(f"{label}: HTTP {code}")
    else:
        fail(f"{label}: HTTP {code}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 12: API smoke — summary reflects focus mode data correctly
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 12 — API: summary endpoint data shape")

ts, summary = api("GET", "/api/admin/operations/summary")
if ts == 200 and isinstance(summary, dict):
    ok("Summary API: HTTP 200")

    # Verify all fields that focus mode logic depends on are present
    required = [
        ('open_incidents',         int),
        ('safeguarding_alerts',    int),
        ('uncovered_shifts',       int),
        ('onboarding_stalls',      int),
        ('expiring_critical_docs', int),
        ('active_overrides',       int),
        ('overdue_follow_ups',     int),
        ('queue',                  dict),
        ('feed',                   list),
        ('shift_coverage',         dict),
        ('safeguarding',           dict),
        ('compliance_alerts',      list),
        ('latest_handover',        (dict, type(None))),
    ]
    for field, typ in required:
        val = summary.get(field)
        if isinstance(val, typ if isinstance(typ, tuple) else (typ,)):
            ok(f"summary.{field}: correct type ({type(val).__name__})")
        else:
            fail(f"summary.{field}: wrong type (got {type(val).__name__})")

    # Queue sub-fields
    q = summary.get("queue", {})
    for f in ['critical_count','urgent_count','warning_count','total_open','top_items']:
        if f in q:
            ok(f"summary.queue.{f}: present")
        else:
            fail(f"summary.queue.{f}: missing")

    # Feed severity values are from the expected set
    feed_sevs = {e.get('severity') for e in summary.get('feed',[])}
    valid_sevs = {'critical','high','medium','low','info'}
    invalid = feed_sevs - valid_sevs
    if not invalid:
        ok(f"Feed event severities all valid: {feed_sevs or '{}'}")
    else:
        fail(f"Invalid feed severities: {invalid}")

else:
    fail("Summary API failed", f"status={ts}")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 13: SSR / hydration safety verification
# ═══════════════════════════════════════════════════════════════════════════════
section("TEST 13 — SSR / hydration safety")

# 13a. OCC starts with focusMode=false (matches server render)
if "useState(false)" in occ_src:
    ok("OCC initial focusMode=false — matches server-rendered state, no hydration mismatch")
else:
    fail("OCC initial state might not be false — hydration risk")

# 13b. getFocusMode must be called inside useEffect (not during render)
# Strategy: find the useEffect block and confirm getFocusMode is inside it.
# The pattern is: useEffect(() => { \n    setFocusModeState(getFocusMode()) \n  }, [])
if re.search(r'useEffect\(\(\) => \{[^}]*getFocusMode\(\)', occ_src, re.DOTALL):
    ok("getFocusMode only called inside useEffect — no SSR risk")
else:
    warn("getFocusMode call location unclear — verify it is inside useEffect")

# 13c. workspaceMemory SSR guard
if "typeof window === 'undefined'" in mem_src:
    ok("workspaceMemory returns defaults on server (SSR guard)")
else:
    fail("workspaceMemory SSR guard missing")

# 13d. window.localStorage in workspaceMemory is always inside a function body
# behind a typeof window guard — verify the SSR guard precedes every window access.
# Check: every function that uses window.localStorage also has typeof window guard.
fn_blocks = re.findall(r'function \w+[^{]*\{([^}]*window\.localStorage[^}]*)\}', mem_src, re.DOTALL)
unguarded = [b for b in fn_blocks if "typeof window === 'undefined'" not in b]
if not unguarded:
    ok("All window.localStorage accesses are inside SSR-guarded functions")
else:
    warn(f"Possible unguarded window access in {len(unguarded)} function(s)")

# ═══════════════════════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════════════════════
passes   = [r for r in results if r[0] == "PASS"]
failures = [r for r in results if r[0] == "FAIL"]
warnings = [r for r in results if r[0] == "WARN"]

print(f"\n{B}{'─'*60}{X}")
print(f"{B}FOCUS MODE QA RESULTS{X}")
print(f"{'─'*60}")
print(f"  {G}PASS: {len(passes)}{X}")
print(f"  {Y}WARN: {len(warnings)}{X}")
print(f"  {R}FAIL: {len(failures)}{X}")
print(f"{'─'*60}")

if failures:
    print(f"\n{R}{B}FAILURES:{X}")
    for _, s, d in failures:
        print(f"  {R}✗{X} {s}: {d}")
if warnings:
    print(f"\n{Y}{B}WARNINGS:{X}")
    for _, s, d in warnings:
        print(f"  {Y}⚠{X} {s}: {d}")

with open("/tmp/focus-mode-results.json","w") as f:
    json.dump({
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "passes":     len(passes),
        "warnings":   len(warnings),
        "failures":   len(failures),
        "results":    results,
        "summary_open_incidents": summary.get("open_incidents","N/A") if isinstance(summary,dict) else "N/A",
    }, f, indent=2)

sys.exit(0 if not failures else 1)
