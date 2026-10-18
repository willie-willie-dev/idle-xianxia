#!/usr/bin/env python3
"""Build a local Obsidian vault from design-docs without editing the source.

Obsidian's graph only draws real links. These docs mostly mention other files
inside backticks, and several markdown links point at the wrong folder.
The vault is a copy: backtick mentions and markdown links to a known note
become wikilinks. Re-run after design-docs changes.
"""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design-docs"
VAULT = ROOT / "doc-vault"

LINK = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")
TICK = re.compile(r"`([^`\n]+)`")


def basename_of(url: str) -> str:
    path = url.split("#", 1)[0].strip()
    return os.path.basename(path)


def collect_notes() -> dict[str, str]:
    notes: dict[str, str] = {}
    for path in SOURCE.rglob("*.md"):
        notes[path.name] = path.stem
    return notes


def rewrite(text: str, own_name: str, notes: dict[str, str]) -> str:
    def link_sub(match: re.Match[str]) -> str:
        name = basename_of(match.group(2))
        if name == own_name or name not in notes:
            return match.group(0)
        return f"[[{notes[name]}]]"

    def tick_sub(match: re.Match[str]) -> str:
        name = basename_of(match.group(1))
        if name == own_name or name not in notes:
            return match.group(0)
        return f"[[{notes[name]}]]"

    text = LINK.sub(link_sub, text)
    return TICK.sub(tick_sub, text)


def write_obsidian_config() -> None:
    config = VAULT / ".obsidian"
    config.mkdir(parents=True, exist_ok=True)
    (config / "app.json").write_text(
        json.dumps({"alwaysUpdateLinks": False, "newFileLocation": "folder"}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    (config / "core-plugins.json").write_text(
        json.dumps(
            {
                "file-explorer": True,
                "global-search": True,
                "switcher": True,
                "graph": True,
                "backlink": True,
                "outgoing-link": True,
                "tag-pane": False,
                "page-preview": True,
                "note-composer": False,
                "command-palette": True,
                "editor-status": True,
                "bookmarks": False,
                "outline": True,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (config / "graph.json").write_text(
        json.dumps(
            {
                "collapse-filter": True,
                "search": "",
                "showTags": False,
                "showAttachments": False,
                "hideUnresolved": False,
                "showOrphans": True,
                "collapse-color-groups": False,
                "colorGroups": [
                    {
                        "query": "file:03-90 OR file:03-91 OR file:05-90",
                        "color": {"a": 1, "rgb": 0x8A8A8A},
                    },
                    {"query": "path:00-总览", "color": {"a": 1, "rgb": 0x3D6F99}},
                    {"query": "path:01-角色", "color": {"a": 1, "rgb": 0x2F8F6B}},
                    {"query": "path:02-事件", "color": {"a": 1, "rgb": 0x3C8A90}},
                    {"query": "path:03-战斗", "color": {"a": 1, "rgb": 0xB55248}},
                    {"query": "path:04-界面", "color": {"a": 1, "rgb": 0xA07830}},
                    {"query": "path:05-项目", "color": {"a": 1, "rgb": 0x6A5A9A}},
                ],
                "collapse-display": False,
                "showArrow": True,
                "textFadeMultiplier": -0.5,
                "nodeSizeMultiplier": 1.1,
                "lineSizeMultiplier": 1,
                "collapse-forces": True,
                "centerStrength": 0.4,
                "repelStrength": 12,
                "linkStrength": 1,
                "linkDistance": 220,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if VAULT.exists():
        shutil.rmtree(VAULT)
    notes = collect_notes()
    linked = 0
    for src in SOURCE.rglob("*.md"):
        rel = src.relative_to(SOURCE)
        dest = VAULT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        original = src.read_text(encoding="utf-8")
        rewritten = rewrite(original, src.name, notes)
        linked += rewritten.count("[[") - original.count("[[")
        dest.write_text(rewritten, encoding="utf-8")
    write_obsidian_config()
    print(f"vault: {VAULT}")
    print(f"notes: {len(notes)}")
    print(f"wikilinks added: {linked}")


if __name__ == "__main__":
    main()
