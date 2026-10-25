"""Offline admission of synthetic bytes from actual Word/API gateway tests.

Usage: python3 scripts/verify-engine-word-request.py ENGINE_GIT_REPO REQUEST_DIR
No Engine checkout writes, environment loading, provider imports or HTTP requests.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

PIN = "eef8ed0794046922842258ce587aab722db5fcb4"
MODULES = (
    "__init__", "chat_protocol", "config", "language", "retrieval_policy",
    "structured_output", "tool_calling", "workflow_events",
)
repo, requests = map(Path, sys.argv[1:])
with tempfile.TemporaryDirectory(prefix="olc74-offline-validator-") as tmp:
    package = Path(tmp) / "lexai_engine"
    package.mkdir()
    hashes = {}
    for module in MODULES:
        name = f"src/lexai_engine/{module}.py"
        data = subprocess.check_output(["git", "-C", str(repo), "show", f"{PIN}:{name}"])
        (package / f"{module}.py").write_bytes(data)
        hashes[name] = hashlib.sha256(data).hexdigest()
    sys.path.insert(0, tmp)
    sys.dont_write_bytecode = True

    def offline_only(event, _args):
        if event.startswith("socket.") or event in {"subprocess.Popen", "os.system"}:
            raise RuntimeError("Network/process execution forbidden during validation")

    sys.addaudithook(offline_only)
    from lexai_engine.chat_protocol import parse_json_body, validate_chat_request, ProtocolError

    results = []
    for language in ("sl", "en"):
        wire = (requests / f"{language}.json").read_bytes()
        payload = parse_json_body(wire, "application/json")
        assert payload["messages"][0]["content"][0]["text"].startswith("SYNTHETIC ")
        assert payload["messages"][0]["content"][1]["text"].startswith("SYNTHETIC ")
        admitted = validate_chat_request(payload, expected_model="lexai-engine-local")
        assert admitted.stream and admitted.include_usage
        assert admitted.response_format.document_review
        assert admitted.conversation.response_language == language
        assert len(admitted.conversation.messages) == 1
        assert tuple(p["text"] for p in payload["messages"][0]["content"]) == admitted.conversation.messages[0].text_parts
        rejected = 0
        for field, bad in (
            ("response_language", "xx"),
            ("response_format", {"type": "json_schema", "json_schema": {"name": "wrong"}}),
            ("stream_options", {"include_usage": "true"}),
            ("messages", [{"role": "user", "content": [{"type": "image_url", "image_url": "synthetic"}]}]),
        ):
            try:
                validate_chat_request({**payload, field: bad}, expected_model="lexai-engine-local")
            except ProtocolError:
                rejected += 1
        assert rejected == 4
        results.append({"language": language, "result": "PASS", "synthetic_body_sha256": hashlib.sha256(wire).hexdigest(), "bytes": len(wire), "negative_controls_rejected": rejected})
    print(json.dumps({"engine_pin": PIN, "scope": "synthetic actual-adapter/gateway bytes; historical incident body unavailable", "module_sha256": hashes, "results": results, "network_forbidden": True}, indent=2))
