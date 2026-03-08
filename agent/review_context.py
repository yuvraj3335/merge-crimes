"""Context builder for the review lane.

Builds structured context (inventory, architecture map, file lists) for
Codex prompts.  All logic is deterministic — no AI calls here.

Excludes node_modules, .git, dist, __pycache__, agent/logs, agent/review_logs
from all walks.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Exclude patterns
# ---------------------------------------------------------------------------

_EXCLUDE_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    ".next", ".nuxt", "coverage", ".cache",
}

_EXCLUDE_LOG_PREFIXES = ("agent/logs", "agent/review_logs", "agent\\logs", "agent\\review_logs")

_SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".py", ".json",
    ".css", ".scss", ".html", ".md", ".yaml", ".yml", ".toml",
}


# ---------------------------------------------------------------------------
# ReviewContext dataclass
# ---------------------------------------------------------------------------


@dataclass
class ReviewContext:
    """Structured context passed to Codex prompts."""
    workstream: str
    scope_description: str
    scope_files: List[str] = field(default_factory=list)
    inventory_excerpt: str = ""
    arch_map_excerpt: str = ""
    prior_findings: str = "(none)"
    open_risks: str = "(none)"
    repo_root: str = ""


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------


def _should_exclude(rel_path: str) -> bool:
    """Return True if a repo-relative path should be excluded from walks."""
    parts = Path(rel_path).parts
    for part in parts:
        if part in _EXCLUDE_DIRS:
            return True
    for prefix in _EXCLUDE_LOG_PREFIXES:
        if rel_path.startswith(prefix):
            return True
    return False


def build_inventory(repo_root: str) -> Dict[str, Any]:
    """Walk repo_root and build a file inventory dict.

    Returns:
    {
        "generated_at": ISO,
        "file_count": N,
        "total_lines": N,
        "total_size_bytes": N,
        "files": [ { "path", "extension", "lines", "size_bytes", "last_modified_iso" } ]
    }
    """
    files = []
    total_lines = 0
    total_bytes = 0

    for dirpath, dirnames, filenames in os.walk(repo_root):
        # Prune excluded dirs in-place
        dirnames[:] = [d for d in dirnames if d not in _EXCLUDE_DIRS]

        for fname in filenames:
            full_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(full_path, repo_root).replace("\\", "/")

            if _should_exclude(rel_path):
                continue

            ext = Path(fname).suffix.lower()
            if ext not in _SOURCE_EXTENSIONS:
                continue

            try:
                stat = os.stat(full_path)
                size_bytes = stat.st_size
                mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                mtime_iso = mtime.strftime("%Y-%m-%dT%H:%M:%SZ")

                with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
                line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)

                files.append({
                    "path": rel_path,
                    "extension": ext,
                    "lines": line_count,
                    "size_bytes": size_bytes,
                    "last_modified_iso": mtime_iso,
                })
                total_lines += line_count
                total_bytes += size_bytes
            except (OSError, PermissionError):
                continue

    files.sort(key=lambda x: x["path"])

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "file_count": len(files),
        "total_lines": total_lines,
        "total_size_bytes": total_bytes,
        "files": files,
    }


def inventory_excerpt(inventory: Dict[str, Any], max_lines: int = 50) -> str:
    """Return the first max_lines file entries as a compact text table."""
    files = inventory.get("files", [])
    lines = [
        f"Files: {inventory.get('file_count', 0)}  "
        f"Lines: {inventory.get('total_lines', 0)}  "
        f"Size: {inventory.get('total_size_bytes', 0) // 1024}KB"
    ]
    for f in files[:max_lines]:
        lines.append(f"  {f['path']:60s}  {f['lines']:5d} lines  {f['size_bytes']:8d} bytes")
    if len(files) > max_lines:
        lines.append(f"  ... [{len(files) - max_lines} more files]")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Architecture map
# ---------------------------------------------------------------------------

_IMPORT_PATTERNS = [
    # TypeScript/JavaScript: import ... from '...'
    re.compile(r"""(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]"""),
    # require('...')
    re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)"""),
    # Python: from .module import / import module
    re.compile(r"""^(?:from\s+(\S+)\s+import|import\s+(\S+))""", re.MULTILINE),
]


def _extract_import_targets(content: str) -> List[str]:
    """Extract all import/require targets from file content."""
    targets = []
    for pattern in _IMPORT_PATTERNS:
        for match in pattern.finditer(content):
            for group in match.groups():
                if group:
                    targets.append(group.strip())
    return targets


def _classify_layer(rel_path: str) -> str:
    """Return a layer name for a file path."""
    p = rel_path.lower()
    if p.startswith("frontend/"):
        return "frontend"
    if p.startswith("worker/"):
        return "worker"
    if p.startswith("shared/"):
        return "shared"
    if p.startswith("agent/"):
        return "agent"
    if p.startswith("docs/"):
        return "docs"
    return "other"


def build_architecture_map(repo_root: str, inventory: Dict[str, Any]) -> Dict[str, Any]:
    """Build a lightweight architecture map from inventory + import scanning.

    Returns:
    {
        "generated_at": ISO,
        "layers": { "frontend": [...], "worker": [...], "shared": [...], ... },
        "import_edges": [ { "from": "a.ts", "to": "b.ts" } ],
        "cycle_candidates": []   # import cycles (best-effort)
    }
    """
    layers: Dict[str, List[str]] = {
        "frontend": [], "worker": [], "shared": [], "agent": [], "docs": [], "other": []
    }
    import_edges = []

    for file_entry in inventory.get("files", []):
        rel_path = file_entry["path"]
        layer = _classify_layer(rel_path)
        layers[layer].append(rel_path)

        # Only scan source files for imports
        ext = file_entry.get("extension", "")
        if ext not in (".ts", ".tsx", ".js", ".jsx", ".py"):
            continue

        full_path = os.path.join(repo_root, rel_path)
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as fh:
                content = fh.read()
        except (OSError, PermissionError):
            continue

        targets = _extract_import_targets(content)
        for target in targets:
            # Only include relative imports (they reference internal files)
            if target.startswith(".") or target.startswith("@/") or target.startswith("~/"):
                import_edges.append({"from": rel_path, "to": target})

    # Deduplicate edges
    seen = set()
    deduped_edges = []
    for edge in import_edges:
        key = (edge["from"], edge["to"])
        if key not in seen:
            seen.add(key)
            deduped_edges.append(edge)

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "layers": layers,
        "import_edges": deduped_edges[:500],  # cap at 500 for readability
        "cycle_candidates": [],
    }


def arch_map_excerpt(arch_map: Dict[str, Any], max_edges: int = 30) -> str:
    """Return a compact text representation of the architecture map."""
    lines = []
    layers = arch_map.get("layers", {})
    for layer, files in layers.items():
        if files:
            lines.append(f"  {layer}: {len(files)} files")

    edges = arch_map.get("import_edges", [])
    lines.append(f"\nImport edges (showing first {min(max_edges, len(edges))} of {len(edges)}):")
    for edge in edges[:max_edges]:
        lines.append(f"  {edge['from']}  →  {edge['to']}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Scope helpers
# ---------------------------------------------------------------------------


_WORKSTREAM_SCOPE = {
    "dead_code":      ["frontend/src", "shared", "worker/src"],
    "duplication":    ["frontend/src", "shared", "worker/src"],
    "complexity":     ["frontend/src", "shared", "worker/src"],
    "unused_exports": ["frontend/src", "shared", "worker/src"],
    "architecture":   ["frontend/src", "shared", "worker/src", "agent"],
    "hardening":      ["frontend/src", "shared", "worker/src", "agent"],
}


def get_scope_files(
    repo_root: str,
    inventory: Dict[str, Any],
    workstream_id: str,
) -> List[str]:
    """Return file paths relevant to a workstream scope."""
    scope_prefixes = _WORKSTREAM_SCOPE.get(workstream_id, ["frontend/src", "shared"])
    result = []
    for file_entry in inventory.get("files", []):
        rel_path = file_entry["path"]
        for prefix in scope_prefixes:
            if rel_path.startswith(prefix + "/") or rel_path.startswith(prefix + "\\"):
                result.append(rel_path)
                break
    return result


# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------


def build_review_context(
    repo_root: str,
    queue_entry: Dict[str, Any],
    tracker_data: Dict[str, Any],
    inventory: Dict[str, Any],
    arch_map: Dict[str, Any],
) -> ReviewContext:
    """Build context for a review_only Codex prompt."""
    ws_id = queue_entry.get("workstream_id", "")
    scope_files = get_scope_files(repo_root, inventory, ws_id)

    # Gather prior findings for this workstream (last 5)
    open_findings = [
        f for f in tracker_data.get("findings", [])
        if f.get("workstream_id") == ws_id and f.get("status") not in ("resolved", "dismissed")
    ]
    prior_str = json.dumps(open_findings[-5:], indent=2) if open_findings else "(none)"

    # Known risks
    risks = tracker_data.get("known_risks", [])
    risks_str = "\n".join(f"  - {r}" for r in risks) if risks else "(none)"

    # Scope description
    scope_prefixes = _WORKSTREAM_SCOPE.get(ws_id, ["frontend/src", "shared"])
    scope_desc = f"Workstream: {ws_id}\nTarget directories: {', '.join(scope_prefixes)}\nFiles in scope: {len(scope_files)}"

    return ReviewContext(
        workstream=ws_id,
        scope_description=scope_desc,
        scope_files=scope_files[:100],  # cap for prompt size
        inventory_excerpt=inventory_excerpt(inventory, max_lines=40),
        arch_map_excerpt=arch_map_excerpt(arch_map, max_edges=20),
        prior_findings=prior_str,
        open_risks=risks_str,
        repo_root=repo_root,
    )


def build_fix_context(
    repo_root: str,
    queue_entry: Dict[str, Any],
    tracker_data: Dict[str, Any],
    inventory: Dict[str, Any],
    arch_map: Dict[str, Any],
) -> ReviewContext:
    """Build context for an apply_fix Codex prompt."""
    from .review_tracker import get_finding_by_id

    finding_id = queue_entry.get("finding_id", "")
    finding = get_finding_by_id(tracker_data, finding_id) or {}

    ws_id = finding.get("workstream_id", queue_entry.get("workstream_id", ""))
    file_path = finding.get("file_path", "")
    scope_files = [file_path] if file_path else []

    # Also include files in the same directory
    if file_path:
        file_dir = os.path.dirname(file_path)
        for f_entry in inventory.get("files", []):
            rel = f_entry["path"]
            if os.path.dirname(rel) == file_dir and rel not in scope_files:
                scope_files.append(rel)

    scope_desc = (
        f"Finding: {finding.get('description', '?')}\n"
        f"File: {file_path}\n"
        f"Symbol: {finding.get('symbol', '')}\n"
        f"Severity: {finding.get('severity', '?')}\n"
        f"Evidence: {finding.get('evidence', '?')}"
    )

    risks_str = tracker_data.get("known_risks", [])
    risks_str = "\n".join(f"  - {r}" for r in risks_str) if risks_str else "(none)"

    return ReviewContext(
        workstream=ws_id,
        scope_description=scope_desc,
        scope_files=scope_files[:20],
        inventory_excerpt=inventory_excerpt(inventory, max_lines=20),
        arch_map_excerpt=arch_map_excerpt(arch_map, max_edges=10),
        prior_findings=json.dumps([finding], indent=2) if finding else "(none)",
        open_risks=risks_str,
        repo_root=repo_root,
    )


# ---------------------------------------------------------------------------
# Artifact persistence
# ---------------------------------------------------------------------------


def save_context_artifacts(
    inventory: Dict[str, Any],
    arch_map: Dict[str, Any],
    artifacts_dir: str,
    dry_run: bool = True,
) -> List[str]:
    """Save inventory.json and architecture_map.json to artifacts_dir.

    In dry_run mode, writes .dryrun shadow files instead.
    Returns list of paths written.
    """
    os.makedirs(artifacts_dir, exist_ok=True)
    written = []

    for filename, data in [
        ("inventory.json", inventory),
        ("architecture_map.json", arch_map),
    ]:
        dest = os.path.join(artifacts_dir, filename + (".dryrun" if dry_run else ""))
        with open(dest, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
        written.append(dest)

    return written
