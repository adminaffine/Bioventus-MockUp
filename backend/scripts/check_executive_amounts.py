import json
import sqlite3
import urllib.request
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "luminos_demo.db"
conn = sqlite3.connect(DB)
print("CFO six-figure alerts:", conn.execute(
    "SELECT alert_id, order_id, dollar_exposure FROM cfo_alerts WHERE dollar_exposure >= 100000"
).fetchall())
print("CCO six-figure issues:", conn.execute(
    "SELECT issue_id, order_id, penalty_exposure FROM cco_compliance_issues WHERE penalty_exposure >= 100000"
).fetchall())

hdr = {"X-Session-Id": "exec-check"}
for ep in ("cfo", "cco"):
    req = urllib.request.Request(f"http://127.0.0.1:8010/api/{ep}/dashboard", headers=hdr)
    data = json.load(urllib.request.urlopen(req))
    row = (data.get("high_value_approval_queue") or [None])[0]
    if not row:
        print(f"{ep}: no executive approval row")
        continue
    rid = row.get("alert_id") or row.get("issue_id")
    amt = row.get("dollar_exposure") or row.get("penalty_exposure")
    print(f"{ep} executive approval: {rid} ${amt:,.0f}")
