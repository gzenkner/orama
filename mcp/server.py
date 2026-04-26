#!/usr/bin/env python3

import json
import mimetypes
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CATALOG_ROOT = ROOT / "catalog"


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(load_text(path))


def json_response(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def json_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def send_message(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(encoded)}\r\n\r\n".encode("utf-8"))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_message() -> dict[str, Any] | None:
    content_length = None

    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        header = line.decode("utf-8").strip()
        if header.lower().startswith("content-length:"):
            content_length = int(header.split(":", 1)[1].strip())

    if content_length is None:
        return None

    body = sys.stdin.buffer.read(content_length)
    if not body:
        return None

    return json.loads(body.decode("utf-8"))


def list_resource_files() -> list[Path]:
    return sorted(path for path in CATALOG_ROOT.rglob("*") if path.is_file())


def path_to_uri(path: Path) -> str:
    relative = path.relative_to(CATALOG_ROOT).with_suffix("")
    return f"orama://{relative.as_posix()}"


def uri_to_path(uri: str) -> Path:
    prefix = "orama://"
    if not uri.startswith(prefix):
        raise FileNotFoundError(f"Unknown resource URI: {uri}")

    relative = uri[len(prefix):]
    candidates = [CATALOG_ROOT / f"{relative}.json", CATALOG_ROOT / f"{relative}.svg"]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Unknown resource URI: {uri}")


def resource_catalog() -> list[dict[str, Any]]:
    resources = []
    for path in list_resource_files():
        mime_type, _ = mimetypes.guess_type(path.name)
        resources.append(
            {
                "uri": path_to_uri(path),
                "name": path.relative_to(CATALOG_ROOT).as_posix(),
                "mimeType": mime_type or "text/plain",
            }
        )
    return resources


def read_resource(uri: str) -> dict[str, Any]:
    path = uri_to_path(uri)
    mime_type, _ = mimetypes.guess_type(path.name)
    return {
        "contents": [
            {
                "uri": uri,
                "mimeType": mime_type or "text/plain",
                "text": load_text(path),
            }
        ]
    }


def tool_catalog() -> list[dict[str, Any]]:
    return [
        {"name": "list_fonts", "description": "List Orama font resources.", "inputSchema": {"type": "object", "properties": {}}},
        {
            "name": "get_font_stack",
            "description": "Return one named Orama font stack resource.",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
        {"name": "list_themes", "description": "List Orama UI themes.", "inputSchema": {"type": "object", "properties": {}}},
        {
            "name": "get_theme",
            "description": "Return one named Orama UI theme.",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
        {
            "name": "get_outcome_themes",
            "description": "Return the full outcome theme palette catalog.",
            "inputSchema": {"type": "object", "properties": {}},
        },
        {
            "name": "get_logo_asset",
            "description": "Return metadata for the selected Orama logo concept.",
            "inputSchema": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
    ]


def tool_result(payload: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


def handle_tool_call(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "list_fonts":
        return tool_result({"fonts": ["orama-primary"]})
    if name == "get_font_stack":
        return tool_result(load_json(CATALOG_ROOT / "branding" / "fonts" / f"{arguments['name']}.json"))
    if name == "list_themes":
        return tool_result({"themes": ["ui-white", "ui-black"]})
    if name == "get_theme":
        return tool_result(load_json(CATALOG_ROOT / "themes" / f"{arguments['name']}.json"))
    if name == "get_outcome_themes":
        return tool_result(load_json(CATALOG_ROOT / "themes" / "outcome-themes.json"))
    if name == "get_logo_asset":
        return tool_result(load_json(CATALOG_ROOT / "branding" / "assets" / f"{arguments['name']}.json"))
    raise FileNotFoundError(f"Unknown tool: {name}")


def handle_request(message: dict[str, Any]) -> dict[str, Any] | None:
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params", {})

    if method == "initialize":
        return json_response(
            request_id,
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {"resources": {}, "tools": {}},
                "serverInfo": {"name": "orama-mcp", "version": "0.1.0"},
            },
        )

    if method == "notifications/initialized":
        return None

    if method == "ping":
        return json_response(request_id, {})

    if method == "resources/list":
        return json_response(request_id, {"resources": resource_catalog()})

    if method == "resources/read":
        return json_response(request_id, read_resource(params["uri"]))

    if method == "tools/list":
        return json_response(request_id, {"tools": tool_catalog()})

    if method == "tools/call":
        return json_response(request_id, handle_tool_call(params["name"], params.get("arguments", {})))

    if request_id is not None:
        return json_error(request_id, -32601, f"Method not found: {method}")
    return None


def main() -> int:
    while True:
        message = read_message()
        if message is None:
            return 0
        try:
            response = handle_request(message)
        except FileNotFoundError as error:
            response = json_error(message.get("id"), -32001, str(error))
        except Exception as error:
            response = json_error(message.get("id"), -32000, str(error))

        if response is not None:
            send_message(response)


if __name__ == "__main__":
    raise SystemExit(main())
