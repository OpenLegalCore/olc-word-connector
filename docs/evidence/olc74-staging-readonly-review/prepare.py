"""Offline-only assembly. Never downloads, deploys, changes trust or calls Word."""
import argparse
import hashlib
import json
import shutil
import tarfile
from pathlib import Path

REVIEW = Path(__file__).resolve().parent
ASSETS = {
    '0dd10039dbdd5d47bba2.css': 'olc74-readonly-style.373d1e42241edc87d655.css',
    'polyfill.js': 'olc74-readonly-polyfill.2976bd75fd5ece7afa55.js',
    'taskpane.js': 'olc74-readonly-taskpane.49fca523dcd5d7b4260a.js',
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def hashes(root):
    return {p.relative_to(root).as_posix(): sha(p.read_bytes())
            for p in sorted(root.rglob('*')) if p.is_file()}

def archive(root, output):
    with tarfile.open(output, 'w', format=tarfile.USTAR_FORMAT) as tar:
        for name in hashes(root):
            info = tar.gettarinfo(str(root / name), arcname='frontend/' + name)
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ''
            info.mode = 0o644
            with (root / name).open('rb') as stream:
                tar.addfile(info, stream)
    return sha(output.read_bytes())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--harness', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    pins = json.loads((REVIEW / 'CURRENT.json').read_text())
    expected = pins['files_sha256']
    assert hashes(args.baseline) == expected, 'baseline byte/inventory mismatch'
    source = json.loads((REVIEW.parent / 'olc74-readonly-sideload-review/CANDIDATE.json').read_text())
    assert sha((args.harness / 'CANDIDATE.json').read_bytes()) == pins['harness_metadata_sha256']
    assert all(sha((args.harness / name).read_bytes()) == digest
               for name, digest in source['files'].items()), 'harness package mismatch'
    entry = (REVIEW / 'taskpane.html').read_bytes()
    assert sha(entry) == pins['candidate_entry_sha256'], 'entry mismatch'
    args.output.mkdir(mode=0o700, parents=False, exist_ok=False)
    rollback = args.output / 'rollback/frontend'
    candidate = args.output / 'candidate/frontend'
    shutil.copytree(args.baseline, rollback)
    shutil.copytree(args.baseline, candidate)
    for source_name, name in ASSETS.items():
        assert not (candidate / name).exists(), 'asset collision'
        shutil.copyfile(args.harness / source_name, candidate / name)
    (candidate / 'taskpane.html').write_bytes(entry)
    actual = hashes(candidate)
    assert all(actual[n] == h for n, h in expected.items() if n != 'taskpane.html')
    assert set(actual) == set(expected) | set(ASSETS.values())
    result = {
        'status': 'PREPARED_NOT_DEPLOYED_NOT_WORD_ACCEPTED',
        'baseline_deployment': pins['deployment'],
        'identity': 'olc74-staging-readonly-v1',
        'changed_existing': ['taskpane.html'],
        'added': sorted(ASSETS.values()),
        'removed': [],
        'rollback_files_sha256': hashes(rollback),
        'candidate_files_sha256': actual,
        'rollback_tar_sha256': archive(rollback, args.output / 'rollback.tar'),
        'candidate_tar_sha256': archive(candidate, args.output / 'candidate.tar'),
    }
    (args.output / 'PACKAGE.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ('status', 'changed_existing', 'added', 'removed', 'rollback_tar_sha256', 'candidate_tar_sha256')}))

if __name__ == '__main__':
    main()
