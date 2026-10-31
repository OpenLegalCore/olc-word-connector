# OLC-74: read-only Word sideload diagnostic — review only

**Draft evidence; not a product fix or release.** The candidate takes one new
synthetic Word capture, retains the first exact original/current/target OOXML
and displays JSON as DOM text for local automation. It does not call Apply,
insertText or Engine on this path. A fake runtime cannot establish the cause of
the historical failed Apply. The owner-observed earlier diagnostic reported
`current-ooxml` first; the underlying XML difference is not yet available.

The full actual harness change is in the PR's `test/word-harness/` files.
The locally prepared incremental DOM-display diff is pinned in the hash list.
[PLAN.md](PLAN.md) records the exact locally prepared startup, guarded
five-minute CA lease and rollback, including the necessary new owner approval.
Review it without running against a real browser or trust store. The candidate
has not been sideloaded or exercised in Word; browser private-network policy,
confirmation dialogs and the document URL's suitability are unverified.

[manifest.xml](manifest.xml) is byte-identical to the existing development
manifest. [CANDIDATE.json](CANDIDATE.json) records all 28 packaged-file SHA-256
values, not the packaged bundles themselves. Original local artifact hashes are
in [LOCAL-ARTIFACT-SHA256.json](LOCAL-ARTIFACT-SHA256.json). The static server,
CA lease and watchdog are revised versions of the locally prepared scripts;
the original hashes and files remain preserved. The revised watchdog starts
cleanup 60 seconds before the five-minute deadline, never kills an in-flight
cleanup and reports late or unconfirmed removal as failure. The URL
generator and DOM collector are **explicitly redacted review copies**: a private
OneDrive document URL and original Word tab ID have been replaced by required
inputs. Their bytes therefore differ from the pinned local originals; never run
these review copies as though they were the verified local scripts. The local
candidate and local scripts were not changed for publication. No document URL,
actual XML payload, session data or private key is included here.

The exact candidate [taskpane.html](taskpane.html) is included; its marker and
hash are checked against the candidate metadata and the export entry takes
priority over the normal and proposal harness. The [plan](PLAN.md) gives the
minimal byte-for-byte preparation step. Revised script and HTML hashes are in
[REVIEW-FILES-SHA256.json](REVIEW-FILES-SHA256.json).

Web sideload can leave a **development registration in browser local storage**.
A safe method to prove the prior baseline and selectively remove only that dev
registration is not established. Do not remove the staging add-in or clear
browser/Office caches. Trust rollback is independently guarded and does not
prove registration rollback. No CA trust or sideload is authorized by this PR.

Verification at preparation: 16 targeted fake-runtime tests passed; lint,
typecheck with pre-existing complete dependencies, Word harness build,
production build and bundle isolation passed. The initial typecheck against a
separate incomplete node_modules failed on missing dependencies. Microsoft
manifest validation could not reach its service (`EAI_AGAIN`). The full suite
was interrupted after sandbox loopback failures and worker tests stalled; a
focused pre-existing test confirmed `listen EPERM`. These are not broad-suite,
real Word, OOXML-difference, or Apply/Undo/Redo passes. Engine stays `54552da`;
OLC-74 remains open. No delivery or merge is implied by this review.
