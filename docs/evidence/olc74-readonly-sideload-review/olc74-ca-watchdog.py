#!/usr/bin/env python3
"""Start guarded cleanup before the deadline; never kill in-flight cleanup."""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('/tmp/olc74-local-https-review')
ACTUAL = '/home/rajko/.pki/nssdb'
TEST = '/tmp/olc74-local-https-review/nss-dryrun-empty-key'
LEASE = '/tmp/olc74-sideload-review-v2/olc74-ca-lease.py'


def emit(status, **fields):
    print(json.dumps({'status': status, **fields}, sort_keys=True), flush=True)


def state_of(journal):
    try:
        state = json.loads(journal.read_text())
        started = state['lease_started_monotonic']
        if not isinstance(started, (int, float)) or started > time.monotonic():
            raise ValueError('invalid start time')
        return state
    except (FileNotFoundError, ValueError, KeyError, TypeError):
        return None


def outcome(state, deadline_seconds, child_returncode=0):
    if not state or state.get('state') != 'restored' or child_returncode != 0:
        emit('cleanup-failed-or-unconfirmed', exit_code=child_returncode)
        return 1
    restored = state.get('restored_monotonic')
    started = state['lease_started_monotonic']
    if not isinstance(restored, (int, float)) or not started <= restored <= time.monotonic():
        emit('cleanup-failed-or-unconfirmed', reason='missing-or-invalid-confirmation-time')
        return 1
    # Completion is only confirmed once this process has read the restored
    # journal and the guarded cleanup has exited successfully.
    elapsed = max(restored, time.monotonic()) - started
    if elapsed > deadline_seconds:
        emit('restored-after-deadline', confirmed_seconds=elapsed, limit_seconds=deadline_seconds)
        return 1
    emit('restored-within-deadline', confirmed_seconds=elapsed, limit_seconds=deadline_seconds)
    return 0


def watch(journal, command, deadline_seconds, reserve_seconds, journal_wait_seconds=None):
    wait_until = None if journal_wait_seconds is None else time.monotonic() + journal_wait_seconds
    while not journal.exists():
        if wait_until is not None and time.monotonic() >= wait_until:
            emit('no-lease-started')
            return 1
        time.sleep(0.05)
    state = state_of(journal)
    # The writer may briefly expose a partially written journal; do not reset
    # the clock. Fail closed if it cannot be read promptly.
    read_until = time.monotonic() + 1
    while state is None and time.monotonic() < read_until:
        time.sleep(0.05)
        state = state_of(journal)
    if state is None:
        emit('invalid-journal-attempting-guarded-cleanup')
        try:
            # The lease process checks and locks the journal itself. Never
            # kill it, even if the start time is unavailable or invalid.
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            process.communicate()
        except OSError:
            pass
        emit('cleanup-failed-or-unconfirmed', reason='invalid-start-time')
        return 1
    started = state['lease_started_monotonic']
    deadline = started + deadline_seconds
    cleanup_at = started + deadline_seconds - reserve_seconds
    while time.monotonic() < cleanup_at:
        state = state_of(journal)
        if state and state.get('state') == 'restored':
            return outcome(state, deadline_seconds)
        time.sleep(min(0.05, max(0, cleanup_at - time.monotonic())))
    emit('cleanup-started', elapsed_seconds=time.monotonic()-started)
    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            process.communicate(timeout=max(0.001, deadline-time.monotonic()))
        except subprocess.TimeoutExpired:
            emit('deadline-exceeded-cleanup-still-running', limit_seconds=deadline_seconds)
            # communicate() does not terminate the child. Keep waiting until
            # guarded deletion and verification exit; never convert delay to PASS.
            process.communicate()
        return outcome(state_of(journal), deadline_seconds, process.returncode)
    except OSError:
        emit('cleanup-failed-or-unconfirmed', reason='cannot-start-cleanup')
        return 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True, choices=[ACTUAL, TEST])
    parser.add_argument('--seconds', type=int, default=300)
    args = parser.parse_args()
    if (args.db == ACTUAL and args.seconds != 300) or (args.db == TEST and not 2 <= args.seconds <= 300):
        raise SystemExit('STOP: real trust lease is fixed at five minutes')
    journal = ROOT / ('trust-lease-sideload-v2-real.json' if args.db == ACTUAL else 'trust-lease-sideload-v2-test.json')
    reserve = 60 if args.db == ACTUAL else min(60, args.seconds / 2)
    return watch(journal, [sys.executable, LEASE, 'end', '--db', args.db, '--authorized'], args.seconds, reserve)


if __name__ == '__main__':
    sys.exit(main())
