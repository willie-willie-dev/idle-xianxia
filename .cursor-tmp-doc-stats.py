#!/usr/bin/env python3
import glob
import os
from datetime import datetime, timezone

paths = sorted(glob.glob("docs/*.md"), key=lambda p: os.path.basename(p))
for path in paths:
    st = os.stat(path)
    name = os.path.basename(path)
    mtime_iso = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
    print(f"{name}|{st.st_size}|{mtime_iso}")
