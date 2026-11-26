---
name: rift-profiles
description: Manage saved Rift bridge profiles (add, list, remove, edit the rift.toml config) and run them with `rift run`. Use when asked to save, reuse, start several, or configure rift bridges between TCP, UDP and serial endpoints.
---

# Rift profiles

A profile is a named bridge (side `a` + side `b`) stored in a TOML config. The CLI and the Rift desktop app share the same file.

## Config location

Resolved in this order:

1. `--config <path>` / `-c <path>`
2. `RIFT_CONFIG` env var
3. OS config dir: `~/.config/rift/rift.toml` (Linux), `~/Library/Application Support/rift/rift.toml` (macOS), `%APPDATA%\rift\rift.toml` (Windows)

Pass `-c` explicitly when working on a project-local config so you don't touch the user's global profiles.

## Commands

```sh
rift profile list [-c file]                    # name  a  b, one per line
rift profile add <name> <a-uri> <b-uri> [-c file]
rift profile remove <name> [-c file]
rift run <name>... [-c file] [--log text|hex|json] [--quiet]
rift run --all [-c file]
rift workflow list [-c file]                   # profile  workflow  autostart  repeat  steps
rift workflow start <profile> <workflow>       # needs a running instance
rift workflow stop <profile> <workflow>
rift workflow status                           # running instances, profiles and workflows
rift inject <profile> <a|b|both> <text|hex|bin|file> <payload...> [--every 500ms [--count N]]
```

- `add` creates the file if missing and fails if the name already exists. To change a profile: `remove` then `add`, or edit the TOML.
- `remove` and `run` fail on unknown names; run `rift profile list` first.
- Endpoint URIs are the same as `rift pipe` (`tcp://`, `tcp-server://`, `udp://`, `udp-server://`, `uart://`). Quote URIs with `?` or `&`.

## Examples

```sh
rift profile add gps tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=9600"
rift profile add uplink "uart:///dev/ttyUSB1?baud=115200" "tcp://ingest.example.com:7000?reconnect_delay_ms=250"
rift profile list
rift run gps uplink --log json
rift profile remove gps
```

## TOML format

Edit the file directly for many profiles or comments. Format and all keys: [references/config.md](references/config.md).

```toml
[[profile]]
name = "serial-over-tcp"
a = { kind = "tcp-server", bind = "0.0.0.0:9000" }
b = { kind = "uart", port = "/dev/ttyUSB0", baud_rate = 115200 }
```

After editing, validate with `rift profile list -c <file>`; a parse error is printed and the command exits non-zero.

## Running profiles as an agent

`rift run` stays in the foreground until SIGINT/SIGTERM. Start it in the background and kill it when done:

```sh
rift run --all -c ./rift.toml --log json > rift.log 2>&1 &
RIFT_PID=$!
# ... work ...
kill $RIFT_PID
```

Live stdin commands target a profile by name: `gps:a hex de ad`, `backup:a on`, `uplink:b off`, `gps:both text hi\r\n`. Payload kinds: `text`, `hex`, `bin`, `file`.

`rift inject` and `rift workflow start|stop|status` reach any Rift running on the same machine (CLI or desktop app) from another shell, so no stdin plumbing is needed. They exit non-zero when nothing is running the profile. `--every` runs as the workflow `cli-inject`; stop it with `rift workflow stop <profile> cli-inject`. Saved workflows with `autostart = true` start with their profile.

## Workflow

1. `rift ports` to find serial devices.
2. `rift profile list` to see what exists.
3. Add or edit profiles.
4. `rift profile list` to confirm.
5. `rift run <name>` (background) and check the log for connect/error status.

## Docker

The image runs `rift run --all --log json --quiet` on `/config/rift.toml`:

```sh
docker run --rm -v "$PWD:/config:ro" -p 9000:9000 ghcr.io/skylineagle/rift
docker run --rm -v "$PWD:/config:ro" -p 9000:9000 ghcr.io/skylineagle/rift run gps
```
