"""Git operations for repo-city-cycle.

All git commands are run via subprocess so we depend only on the local git
binary.  Functions raise GitError on unexpected failures.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from typing import List, Optional, Tuple


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------


class GitError(RuntimeError):
    """Raised when a git command fails unexpectedly."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _run(
    args: List[str],
    cwd: str,
    check: bool = True,
    capture: bool = True,
    env: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    result = subprocess.run(
        args,
        cwd=cwd,
        capture_output=capture,
        text=True,
        env=env,
    )
    if check and result.returncode != 0:
        cmd_str = " ".join(args)
        raise GitError(
            f"git command failed (exit {result.returncode}): {cmd_str}\n"
            f"stdout: {result.stdout.strip()}\n"
            f"stderr: {result.stderr.strip()}"
        )
    return result


# ---------------------------------------------------------------------------
# Read-only queries
# ---------------------------------------------------------------------------


def get_current_branch(cwd: str) -> str:
    """Return the name of the current checked-out branch."""
    result = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd)
    return result.stdout.strip()


def has_uncommitted_changes(cwd: str) -> bool:
    """Return True if there are any staged or unstaged changes in the tree."""
    result = _run(["git", "status", "--porcelain"], cwd=cwd)
    return bool(result.stdout.strip())


def get_changed_files(cwd: str) -> List[str]:
    """Return all changed files (modified, staged, or untracked) relative to cwd."""
    result = _run(["git", "status", "--porcelain"], cwd=cwd)
    files: List[str] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        # Porcelain format: "XY filename" or "XY oldname -> newname"
        raw = line[3:]
        if " -> " in raw:
            # Rename — take the new name
            files.append(raw.split(" -> ", 1)[1].strip())
        else:
            files.append(raw.strip())
    return sorted(set(files))


def get_diff_stat(cwd: str) -> str:
    """Return `git diff --stat HEAD` output."""
    result = _run(["git", "diff", "--stat", "HEAD"], cwd=cwd, check=False)
    return result.stdout.strip()


def is_git_repo(cwd: str) -> bool:
    """Return True if *cwd* is inside a git repository."""
    result = _run(
        ["git", "rev-parse", "--is-inside-work-tree"], cwd=cwd, check=False
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


def get_repo_root(cwd: str) -> str:
    """Return the absolute path of the git repo root."""
    result = _run(["git", "rev-parse", "--show-toplevel"], cwd=cwd)
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# Branch management
# ---------------------------------------------------------------------------


def ensure_on_branch(branch_name: str, cwd: str) -> None:
    """Switch to *branch_name* if not already on it.  Fails if there are
    uncommitted changes that would block the checkout."""
    current = get_current_branch(cwd)
    if current == branch_name:
        return
    # Check for blocking changes
    if has_uncommitted_changes(cwd):
        raise GitError(
            f"Cannot switch to branch '{branch_name}': working tree has "
            "uncommitted changes.  Stash or commit them first."
        )
    _run(["git", "checkout", branch_name], cwd=cwd)


def pull_latest(remote: str, branch: str, cwd: str) -> str:
    """Run `git pull --rebase <remote> <branch>` and return output."""
    result = _run(
        ["git", "pull", "--rebase", remote, branch], cwd=cwd, check=False
    )
    if result.returncode != 0:
        raise GitError(
            f"git pull --rebase {remote} {branch} failed:\n"
            f"{result.stdout}\n{result.stderr}"
        )
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# Stage / commit / push
# ---------------------------------------------------------------------------


def stage_all_changes(cwd: str, paths: Optional[List[str]] = None) -> None:
    """Stage all changes (or specific *paths*)."""
    if paths:
        _run(["git", "add", "--"] + paths, cwd=cwd)
    else:
        _run(["git", "add", "-A"], cwd=cwd)


def commit_changes(message: str, cwd: str) -> str:
    """Create a git commit with *message*.  Returns the commit hash."""
    # Check there's actually something to commit
    result = _run(["git", "diff", "--cached", "--name-only"], cwd=cwd)
    if not result.stdout.strip():
        return ""  # nothing staged — no-op
    _run(["git", "commit", "-m", message], cwd=cwd)
    # Return the new commit hash
    hash_result = _run(["git", "rev-parse", "HEAD"], cwd=cwd)
    return hash_result.stdout.strip()


def push_branch(remote: str, branch: str, cwd: str) -> None:
    """Push *branch* to *remote*."""
    _run(["git", "push", remote, branch], cwd=cwd)


# ---------------------------------------------------------------------------
# Selective revert
# ---------------------------------------------------------------------------


def checkout_file(path: str, cwd: str) -> None:
    """Discard working-tree changes for a single file (git checkout HEAD -- path)."""
    # path may be relative to cwd
    _run(["git", "checkout", "HEAD", "--", path], cwd=cwd)


def hard_reset_if_configured(cwd: str, confirm: bool = False) -> None:
    """Run `git reset --hard HEAD`.  Only runs if *confirm* is True (safety)."""
    if not confirm:
        return
    _run(["git", "reset", "--hard", "HEAD"], cwd=cwd)


# ---------------------------------------------------------------------------
# Repo state checks
# ---------------------------------------------------------------------------


def is_clean_enough_to_start(cwd: str) -> Tuple[bool, str]:
    """Return (ok, message).

    The repo is clean enough to start if either:
    - There are no uncommitted changes, OR
    - The only changes are in docs/REPO_CITY_TRACKER.json (from a previous
      aborted cycle).

    Returns False with a descriptive message if there are unexpected changes.
    """
    result = _run(["git", "status", "--porcelain"], cwd=cwd)
    lines = [l for l in result.stdout.splitlines() if l.strip()]
    if not lines:
        return True, "clean"

    unexpected = [
        l
        for l in lines
        if not l[3:].strip().startswith("docs/REPO_CITY_TRACKER.json")
        and not l[3:].strip().startswith("agent/logs/")
    ]
    if unexpected:
        files = "\n  ".join(l[3:].strip() for l in unexpected)
        return (
            False,
            f"Working tree has uncommitted changes outside expected paths:\n  {files}",
        )
    return True, "only tracker/log changes present"


def sanitize_commit_message(text: str) -> str:
    """Return a safe, single-line commit message from *text*."""
    # Keep only printable ASCII, collapse whitespace
    cleaned = re.sub(r"[^\x20-\x7e]", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Truncate
    if len(cleaned) > 120:
        cleaned = cleaned[:117] + "..."
    return cleaned or "repo-city-cycle: automated commit"
