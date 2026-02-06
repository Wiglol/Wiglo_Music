#!/usr/bin/env python3
import json, os, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "library"
OUT = LIB / "manifest.json"

def parse_txt(raw: str):
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")

    title = ""
    for l in lines:
        if l.strip():
            title = l.strip()
            break

    desc = ""
    tags = None

    try:
        idx_desc = lines.index("Description:")
    except ValueError:
        idx_desc = -1

    if idx_desc >= 0:
        desc_lines = []
        i = idx_desc + 1
        while i < len(lines):
            line = lines[i]
            if line.strip() == "":
                break
            desc_lines.append(line)
            i += 1
        desc = "\n".join(desc_lines).strip()

        # tags: line starting with "Perfect for:"
        for j in range(i+1, len(lines)):
            line = lines[j]
            if line.startswith("Perfect for:"):
                part = line[len("Perfect for:"):].strip()
                tags = [s.strip() for s in part.split("•") if s.strip()] if part else []
                break

    return {"title": title or "", "description": desc or "", "tags": tags if isinstance(tags, list) else []}

def main():
    if not LIB.exists():
        raise SystemExit(f"Missing library folder: {LIB}")

    mp3s = sorted(LIB.glob("*.mp3"), key=lambda p: int(p.stem) if p.stem.isdigit() else p.stem, reverse=True)
    items = []
    for mp3 in mp3s:
        base = mp3.stem
        txt = LIB / f"{base}.txt"
        meta = {"title": base, "description": "No description yet.", "tags": []}
        if txt.exists():
            try:
                meta = parse_txt(txt.read_text(encoding="utf-8", errors="replace"))
                if not meta.get("title"):
                    meta["title"] = base
                if not meta.get("description"):
                    meta["description"] = "No description yet."
                if not isinstance(meta.get("tags"), list):
                    meta["tags"] = []
            except Exception:
                pass

        items.append({
            "id": base,
            "mp3": mp3.name,
            "txt": txt.name if txt.exists() else None,
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
        })

    OUT.write_text(json.dumps({"version": 1, "tracks": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(items)} tracks)")

if __name__ == "__main__":
    main()
