# Orama MCP

Small internal Model Context Protocol server for Orama brand and theme data.

## Purpose

This MCP exposes:

- font stacks used by the app
- shell theme tokens (`white`, `black`)
- outcome theme palette definitions
- logo asset metadata for the selected concept

## Run locally

```bash
python3 /Users/gabrielzenkner/projects/orama/mcp/server.py
```

## Tools

- `list_fonts`
- `get_font_stack`
- `list_themes`
- `get_theme`
- `get_outcome_themes`
- `get_logo_asset`

## Resources

- `orama://branding/fonts/orama-primary`
- `orama://branding/assets/orama-logo-v5`
- `orama://themes/ui-white`
- `orama://themes/ui-black`
- `orama://themes/outcome-themes`
