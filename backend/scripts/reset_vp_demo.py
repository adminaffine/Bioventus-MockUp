"""Reload vp_alerts from CSV and print baseline dashboard counts."""
import csv
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "luminos_demo.db"
CSV = ROOT / "data" / "csv" / "vp_alerts.csv"

if not CSV.is_file():
    print(f"Missing CSV: {CSV}", file=sys.stderr)
    sys.exit(1)

conn = sqlite3.connect(DB)
conn.execute("DELETE FROM vp_alerts")
with CSV.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    cols = reader.fieldnames or []
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT OR REPLACE INTO vp_alerts ({','.join(cols)}) VALUES ({placeholders})"
    for row in reader:
        conn.execute(sql, [row[c] for c in cols])
conn.commit()
total = conn.execute("SELECT COUNT(*) FROM vp_alerts").fetchone()[0]
open_rows = conn.execute("SELECT COUNT(*) FROM vp_alerts WHERE status = 'Open'").fetchone()[0]
conn.close()
print(f"VP demo reset complete: {total} alerts in seed, {open_rows} open in database")
print("Headline KPI baseline: 47 open issues (portfolio-wide), 8 Top Alerts from seed CSV")
