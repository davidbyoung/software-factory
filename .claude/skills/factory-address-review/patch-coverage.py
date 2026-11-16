#!/usr/bin/env python3
"""Lines a branch adds or changes that its tests leave uncovered.

Codecov's PR comment names files and counts, not lines. This reads the same
lcov report CI uploads and keeps only the lines in the diff against the base.

    python3 patch-coverage.py [base] [lcov]

Run the project's coverage command first. Defaults: origin/main and
coverage/lcov.info. MISS is a line never run; PART is a line with a branch
never taken.
"""

import os
import re
import subprocess
import sys

base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
lcov = sys.argv[2] if len(sys.argv) > 2 else "coverage/lcov.info"

coverage = {}
current = None
for line in open(lcov):
    line = line.strip()
    if line.startswith("SF:"):
        current = os.path.relpath(line[3:])
        coverage[current] = {"miss": set(), "part": set()}
    elif line.startswith("DA:"):
        number, hits = line[3:].split(",")[:2]
        if hits == "0":
            coverage[current]["miss"].add(int(number))
    elif line.startswith("BRDA:"):
        number, _, _, taken = line[5:].split(",")
        if taken in ("0", "-"):
            coverage[current]["part"].add(int(number))

diff = subprocess.run(
    ["git", "diff", "-U0", f"{base}...HEAD"],
    capture_output=True,
    text=True,
    check=True,
).stdout
changed = {}
path = None
for line in diff.splitlines():
    if line.startswith("+++ "):
        path = line[6:] if line.startswith("+++ b/") else None
        if path:
            changed[path] = set()
    hunk = re.match(r"@@ .* \+(\d+)(?:,(\d+))? @@", line)
    if hunk and path:
        start, count = int(hunk[1]), int(hunk[2] or 1)
        changed[path].update(range(start, start + count))

for path, lines in sorted(changed.items()):
    report = coverage.get(path)
    if not report:
        continue
    missed = report["miss"] & lines
    partial = (report["part"] & lines) - missed
    if not missed and not partial:
        continue
    source = open(path).read().splitlines()
    print(f"=== {path}")
    for number in sorted(missed | partial):
        kind = "MISS" if number in missed else "PART"
        print(f"{kind} {number}: {source[number - 1].strip()[:110]}")
