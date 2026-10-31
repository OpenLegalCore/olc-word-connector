#!/usr/bin/env python3
"""OLC-74 reviewed trust lease; only begin/end can mutate the specified NSS DB.
Do not execute begin against the real database without explicit owner approval.
"""
import argparse, hashlib, json, os, re, sqlite3, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path('/tmp/olc74-local-https-review')
CERTUTIL=ROOT/'nss-tools/usr/bin/certutil'
CERTUTIL_SHA='c90d7d22c169eacdea254287c4e973cd57b08b7ac252391ffcb9b903860d975b'
CA=ROOT/'ca.crt'
CA_DER_SHA='620f860685c263a16c2b5608804fb24c53fb274305137e481cfcb251fbe2000f'
ACTUAL=Path('/home/rajko/.pki/nssdb')
TEST=ROOT/'nss-dryrun-empty-key'
NICK='OLC74-temporary-developer-ca-620f8606'
TRUST='C,,'
LEAF_SHA='68ce5b91ee71221d3a6da0c8c12fa70638a7133a0cbfcfb82bf9fa37f5622cc5'
PATTERN=re.compile(r'^\s*(.*?)\s+([A-Za-z]*,[A-Za-z]*,[A-Za-z]*)\s*$')

def digest(data): return hashlib.sha256(data).hexdigest()
def run(args, data=None):
    p=subprocess.run(args,input=data,capture_output=True,timeout=20)
    if p.returncode:
        raise RuntimeError(f'{Path(args[0]).name} exit {p.returncode}; no private stderr emitted')
    return p.stdout

def check_inputs(db):
    db=db.resolve(strict=True)
    if db not in (ACTUAL.resolve(strict=True),TEST.resolve(strict=True)):
        raise RuntimeError('database is not the specified Chrome NSS database or isolated test DB')
    if digest(CERTUTIL.read_bytes())!=CERTUTIL_SHA: raise RuntimeError('certutil executable hash changed')
    der=run(['openssl','x509','-in',str(CA),'-outform','DER'])
    if digest(der)!=CA_DER_SHA: raise RuntimeError('CA fingerprint changed')
    for name in ('cert9.db','key4.db'):
        if not (db/name).is_file(): raise RuntimeError('expected existing NSS files missing')
    return db

def get_entries(db):
    output=run([str(CERTUTIL),'-L','-d','sql:'+str(db)]).decode('utf-8','strict')
    entries={}
    for line in output.splitlines():
        if not line.strip() or line.startswith('Certificate Nickname') or line.strip().startswith('SSL,'):
            continue
        match=PATTERN.fullmatch(line)
        if not match or not match.group(1): raise RuntimeError('unrecognized NSS listing: stop')
        nick,flags=match.groups()
        if nick in entries: raise RuntimeError('duplicate nickname: stop')
        pem=run([str(CERTUTIL),'-L','-d','sql:'+str(db),'-n',nick,'-a'])
        der=run(['openssl','x509','-inform','PEM','-outform','DER'],pem)
        entries[nick]={'trust':flags,'sha256':digest(der)}
    return entries

def trust_rows(db):
    # NSS stores certificate-hash metadata in public trust objects. No key DB
    # or certificate contents are copied into the journal.
    der=run(['openssl','x509','-in',str(CA),'-outform','DER'])
    targets={hashlib.sha1(der).digest(),hashlib.md5(der,usedforsecurity=False).digest()}
    connection=sqlite3.connect('file:'+str(db/'cert9.db')+'?mode=ro',uri=True,timeout=10)
    try:
        rows=connection.execute("SELECT * FROM nssPublic WHERE hex(a0)='CE534353'").fetchall()
        names=[x[1] for x in connection.execute('PRAGMA table_info(nssPublic)')]
    finally:
        connection.close()
    index1,index2=names.index('ace5363b4'),names.index('ace5363b5')
    def encode(value):
        return {'bytes':value.hex()} if isinstance(value,bytes) else value
    out=[]
    for row in rows:
        encoded=json.dumps([encode(v) for v in row],sort_keys=True,separators=(',',':')).encode()
        match=any(isinstance(row[i],bytes) and row[i] in targets for i in (index1,index2))
        out.append({'sha256':digest(encoded),'target':match})
    return sorted(out,key=lambda item:item['sha256'])

def atomic_json(path, content):
    fd,tmp=tempfile.mkstemp(prefix='.journal-',dir=path.parent)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'w') as f:
            json.dump(content,f,indent=2,sort_keys=True);f.write('\n');f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def journal_path(db):
    return ROOT/('trust-lease-sideload-real.json' if db==ACTUAL else 'trust-lease-sideload-test.json')

def verify_live_chrome_and_chain(db):
    if db!=ACTUAL: return
    source=Path('/home/rajko/.office-addin-dev-certs/ca.crt')
    leaf=Path('/home/rajko/.office-addin-dev-certs/localhost.crt')
    if source.read_bytes()!=CA.read_bytes(): raise RuntimeError('original CA differs from reviewed copy')
    leaf_der=run(['openssl','x509','-in',str(leaf),'-outform','DER'])
    if digest(leaf_der)!=LEAF_SHA: raise RuntimeError('localhost certificate changed')
    run(['openssl','verify','-CAfile',str(CA),str(leaf)])
    lock=Path('/home/rajko/.config/google-chrome/SingletonLock')
    target=os.readlink(lock)
    match=re.search(r'-(\d+)$',target)
    if not match: raise RuntimeError('cannot identify current Chrome process')
    proc=Path('/proc')/match.group(1)
    if not os.readlink(proc/'exe').endswith('/chrome'): raise RuntimeError('profile lock is not held by Chrome')
    opened=set()
    for fd in (proc/'fd').iterdir():
        try: opened.add(os.readlink(fd))
        except OSError: pass
    if not {str(db/'cert9.db'),str(db/'key4.db')}.issubset(opened):
        raise RuntimeError('current Chrome process does not expose expected NSS DB; stop')

def begin(db, authorized):
    if not authorized: raise RuntimeError('explicit --authorized required; obtain owner approval before real DB')
    verify_live_chrome_and_chain(db)
    journal=journal_path(db)
    if journal.exists(): raise RuntimeError('journal exists: stop, do not overwrite prior evidence')
    before=get_entries(db)
    trusts_before=trust_rows(db)
    if any(row['target'] for row in trusts_before):
        raise RuntimeError('pre-existing NSS trust record for this CA: no changes made')
    if NICK in before or any(v['sha256']==CA_DER_SHA for v in before.values()):
        raise RuntimeError('CA or nickname already exists: no changes made')
    state={'db':str(db),'ca_sha256':CA_DER_SHA,'nickname':NICK,'trust':TRUST,'before':before,'trusts_before':trusts_before,'state':'adding'}
    fd=os.open(journal,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as f:
        json.dump(state,f,indent=2,sort_keys=True);f.write('\n');f.flush();os.fsync(f.fileno())
    try:
        run([str(CERTUTIL),'-A','-d','sql:'+str(db),'-n',NICK,'-t',TRUST,'-i',str(CA)])
        after=get_entries(db)
        if after.get(NICK)!={'trust':TRUST,'sha256':CA_DER_SHA} or {k:v for k,v in after.items() if k!=NICK}!=before:
            raise RuntimeError('post-import state unexpected; preserve journal and stop')
        trusts_after=trust_rows(db)
        if len([r for r in trusts_after if r['target']])!=1 or [r for r in trusts_after if not r['target']]!=trusts_before:
            raise RuntimeError('post-import NSS trust records unexpected; preserve journal and stop')
        state['state']='added';atomic_json(journal,state)
    except Exception:
        # Preserve the pre-import journal for guarded recovery; do not blindly delete.
        raise
    return {'status':'added','db':str(db),'nickname':NICK,'ca_sha256':CA_DER_SHA,'journal':str(journal)}

def end(db, authorized):
    if not authorized: raise RuntimeError('explicit --authorized required')
    journal=journal_path(db)
    state=json.loads(journal.read_text())
    if state['db']!=str(db) or state['ca_sha256']!=CA_DER_SHA or state['nickname']!=NICK or state['trust']!=TRUST:
        raise RuntimeError('journal does not match requested removal')
    if state['state'] not in ('adding','added'):
        raise RuntimeError('journal state does not permit removal')
    now=get_entries(db)
    target=now.get(NICK)
    trusts_now=trust_rows(db)
    if target is None:
        if trusts_now!=state['trusts_before'] or now!=state['before']: raise RuntimeError('target absent but other records differ; stop')
        state['state']='restored';atomic_json(journal,state)
        return {'status':'already-restored','other_entries_match':True}
    if len([r for r in trusts_now if r['target']])!=1:
        raise RuntimeError('CA trust object count changed; do not delete')
    if target!={'trust':TRUST,'sha256':CA_DER_SHA}:
        raise RuntimeError('target fingerprint or trust flags changed; do not delete')
    if any(k != NICK and v['sha256'] == CA_DER_SHA for k,v in now.items()):
        raise RuntimeError('same certificate appears under another nickname; do not delete')
    # Remove only the unique nickname created by this lease; preserve other changes.
    run([str(CERTUTIL),'-D','-d','sql:'+str(db),'-n',NICK])
    after=get_entries(db)
    if NICK in after or any(v['sha256']==CA_DER_SHA for v in after.values()):
        raise RuntimeError('target persists after removal; keep journal and report')
    other_before={k:v for k,v in now.items() if k!=NICK}
    if after!=other_before: raise RuntimeError('unrelated entries changed during removal; keep journal')
    trusts_after=trust_rows(db)
    if any(r['target'] for r in trusts_after) or trusts_after!=[r for r in trusts_now if not r['target']]:
        raise RuntimeError('NSS trust records differ after removal; keep journal')
    state['state']='restored';atomic_json(journal,state)
    return {'status':'restored','other_entries_unchanged_during_removal':True,
            'unrelated_entries_match_pre_import':after==state['before'] and trusts_after==state['trusts_before']}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('action',choices=['check','begin','end'])
    ap.add_argument('--db',required=True);ap.add_argument('--authorized',action='store_true')
    args=ap.parse_args();db=check_inputs(Path(args.db))
    if args.action=='check':
        entries=get_entries(db)
        result={'status':'read-only','db':str(db),'certificates':len(entries),
                'same_ca_present':any(v['sha256']==CA_DER_SHA for v in entries.values()),
                'nickname_present':NICK in entries,'ca_trust_object_present':any(r['target'] for r in trust_rows(db)),'ca_sha256':CA_DER_SHA,
                'journal_exists':journal_path(db).exists()}
    elif args.action=='begin': result=begin(db,args.authorized)
    else: result=end(db,args.authorized)
    print(json.dumps(result,sort_keys=True))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'status':'stopped','reason':str(e)}),file=sys.stderr);sys.exit(1)
