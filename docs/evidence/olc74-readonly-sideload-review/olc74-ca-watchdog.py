#!/usr/bin/env python3
"""Independent timed rollback for the OLC-74 NSS lease; start BEFORE begin."""
import argparse,json,subprocess,sys,time
from pathlib import Path
ROOT=Path('/tmp/olc74-local-https-review')
ACTUAL='/home/rajko/.pki/nssdb'
TEST='/tmp/olc74-local-https-review/nss-dryrun-empty-key'
p=argparse.ArgumentParser();p.add_argument('--db',required=True,choices=[ACTUAL,TEST]);p.add_argument('--seconds',type=int,default=300)
a=p.parse_args()
if (a.db==ACTUAL and a.seconds!=300) or (a.db==TEST and not 1<=a.seconds<=300):
    raise SystemExit('STOP: real trust lease is fixed at five minutes')
journal=ROOT/('trust-lease-sideload-real.json' if a.db==ACTUAL else 'trust-lease-sideload-test.json')
wait_until=time.monotonic()+30
while not journal.exists():
    if time.monotonic()>=wait_until:
        print(json.dumps({'status':'no-lease-started'}),flush=True);sys.exit(0)
    time.sleep(0.1)
start=time.monotonic()
while time.monotonic()-start<a.seconds:
    try:
        state=json.loads(journal.read_text())['state']
        if state=='restored': print(json.dumps({'status':'already-restored'}),flush=True);sys.exit(0)
    except (FileNotFoundError,ValueError,KeyError):
        pass
    time.sleep(min(0.5,max(0,a.seconds-(time.monotonic()-start))))
p=subprocess.run([sys.executable,'/tmp/olc74-sideload-review/olc74-ca-lease.py','end','--db',a.db,'--authorized'],capture_output=True,text=True,timeout=30)
print(json.dumps({'status':'watchdog-rollback-completed' if p.returncode==0 else 'watchdog-rollback-failed','exit_code':p.returncode}),flush=True)
sys.exit(p.returncode)
