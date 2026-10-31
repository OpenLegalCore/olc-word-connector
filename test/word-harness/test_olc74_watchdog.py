"""Isolated timing regression; fake file marker only, never an NSS database."""
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'docs/evidence/olc74-readonly-sideload-review/olc74-ca-watchdog.py'
spec = importlib.util.spec_from_file_location('olc74_watchdog', SCRIPT)
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)

FAKE_CLEANUP = '''
import json, os, sys, time
from pathlib import Path
journal, marker, delay, fail = Path(sys.argv[1]), Path(sys.argv[2]), float(sys.argv[3]), sys.argv[4] == "fail"
time.sleep(delay)
if fail:
    sys.exit(1)
marker.unlink()
removed = time.monotonic()
state = json.loads(journal.read_text())
state.update(state="restored", removed_monotonic=removed, restored_monotonic=time.monotonic())
tmp = journal.with_suffix(".tmp")
tmp.write_text(json.dumps(state))
os.replace(tmp, journal)
'''


class DelayedCleanupTests(unittest.TestCase):
    def exercise(self, delay, fail=False):
        with tempfile.TemporaryDirectory(prefix='olc74-watchdog-fake-') as directory:
            root = Path(directory)
            journal, marker, child = root/'journal.json', root/'fake-ca-marker', root/'cleanup.py'
            marker.write_text('fake only')
            child.write_text(FAKE_CLEANUP)
            started = time.monotonic()
            journal.write_text(json.dumps({'state':'added','lease_started_monotonic':started}))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = watchdog.watch(journal, [sys.executable, str(child), str(journal), str(marker), str(delay), 'fail' if fail else 'ok'], 1.6, 0.8)
            events = [json.loads(line) for line in out.getvalue().splitlines()]
            state = json.loads(journal.read_text())
            return code, events, state, marker.exists()

    def test_delayed_cleanup_completes_before_deadline(self):
        code, events, state, exists = self.exercise(0.3)
        actual = state['removed_monotonic'] - state['lease_started_monotonic']
        print(f'fake actual removal before deadline: {actual:.3f}s of 1.600s')
        self.assertFalse(exists)
        self.assertEqual(code, 0)
        self.assertLess(actual, 1.6)
        self.assertEqual(events[-1]['status'], 'restored-within-deadline')
        self.assertGreaterEqual(events[0]['elapsed_seconds'], 0.75)
        self.assertLess(events[0]['elapsed_seconds'], 1.6)

    def test_delayed_cleanup_crosses_deadline_but_is_not_killed(self):
        code, events, state, exists = self.exercise(1.1)
        actual = state['removed_monotonic'] - state['lease_started_monotonic']
        print(f'fake actual removal after deadline: {actual:.3f}s of 1.600s')
        self.assertFalse(exists)
        self.assertGreater(actual, 1.6)
        self.assertEqual(code, 1)
        self.assertIn('deadline-exceeded-cleanup-still-running', [event['status'] for event in events])
        self.assertEqual(events[-1]['status'], 'restored-after-deadline')

    def test_cleanup_failure_is_not_pass(self):
        code, events, state, exists = self.exercise(0.05, fail=True)
        self.assertTrue(exists)
        self.assertEqual(state['state'], 'added')
        self.assertEqual(code, 1)
        self.assertEqual(events[-1]['status'], 'cleanup-failed-or-unconfirmed')

    def test_invalid_start_time_attempts_cleanup_but_never_passes(self):
        with tempfile.TemporaryDirectory(prefix='olc74-watchdog-invalid-') as directory:
            root = Path(directory)
            journal, marker = root/'journal.json', root/'fake-ca-marker'
            journal.write_text('{}')
            marker.write_text('fake only')
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = watchdog.watch(journal, [sys.executable, '-c',
                    'import pathlib,sys; pathlib.Path(sys.argv[1]).unlink()', str(marker)], 1.6, 0.8)
            self.assertFalse(marker.exists())
            self.assertEqual(code, 1)
            self.assertEqual(json.loads(out.getvalue().splitlines()[-1])['status'], 'cleanup-failed-or-unconfirmed')


if __name__ == '__main__':
    unittest.main()
