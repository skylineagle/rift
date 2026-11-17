---
name: rift-pipe
description: Run ad-hoc Rift bridges with `rift pipe` to forward bytes between TCP, UDP and serial (UART) endpoints, watch traffic and inject data live. Use when asked to bridge, forward, relay, expose or sniff a serial port, TCP or UDP connection with the rift CLI.
---

# Rift pipe

`rift pipe <a> <b>` bridges two endpoints and forwards bytes both ways until it gets Ctrl+C / SIGTERM. Nothing is saved; use the `rift-profiles` skill for reusable setups.

## Before you start

1. Check the CLI: `rift --version`. If missing, install it (see Install below).
2. For serial work, list ports first: `rift ports` (prints `name  kind  description`).
3. Check the ports you bind are free (`lsof -i :9000` on macOS/Linux).

## Command

```sh
rift pipe <endpoint-a> <endpoint-b> [--name <label>] [--log text|hex|json] [--quiet]
```

- `--name` labels the bridge in logs and stdin commands (default `adhoc`).
- `--log` sets traffic rendering: `hex` (default), `text`, or `json` (one JSON object per line, best for agents).
- `--quiet` hides traffic.
- Always quote URIs that contain `?` or `&`.

## Endpoints

| URI | Role |
| --- | --- |
| `tcp://host:port` | TCP client, reconnects with backoff |
| `tcp-server://0.0.0.0:9000` | TCP listener, many clients |
| `udp://host:port[?bind=0.0.0.0:7000]` | UDP to a fixed peer |
| `udp-server://0.0.0.0:5000` | UDP listener, replies to known peers |
| `uart:///dev/ttyUSB0?baud=115200` | Serial port (`COM3` style on Windows: `uart://COM3?baud=9600`) |

Options are URI query params. Full list in [references/endpoints.md](references/endpoints.md).

## Recipes

```sh
# Serial device over the network
rift pipe tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=115200"

# UDP in, TCP out
rift pipe udp-server://0.0.0.0:5000 tcp://example.com:7000

# Plain TCP port forward
rift pipe tcp-server://0.0.0.0:8080 tcp://10.0.0.2:80

# Serial 8E1 with hardware flow control
rift pipe tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=9600&parity=even&flow=hardware"

# Single TCP client, faster reconnect on the other side
rift pipe "tcp-server://0.0.0.0:9000?max_clients=1" "tcp://192.168.1.20:4000?reconnect_delay_ms=200"

# Start side b disabled, turn it on later with `b on`
rift pipe tcp-server://0.0.0.0:9000 "tcp://example.com:7000?enabled=false"
```

## Running it as an agent

`rift pipe` never exits on its own. Run it as a background process, capture its output, and stop it when done.

```sh
rift pipe tcp-server://127.0.0.1:9000 udp-server://127.0.0.1:5000 --log json > rift.log 2>&1 &
RIFT_PID=$!
# ... test, e.g. printf 'hello' | nc -w1 127.0.0.1 9000
kill $RIFT_PID
```

- Prefer `--log json` and parse with `jq` when you need to read traffic or status.
- Bind to `127.0.0.1` for local tests, `0.0.0.0` only when other hosts or containers must reach it.
- Always kill the processes you started before finishing.

## Live commands (stdin)

While running, each stdin line is a command. Prefix with `<name>:` to target a bridge (`--name`, default `adhoc`).

| Line | Effect |
| --- | --- |
| `a text hello\r\n` | Send text out of side a (escapes like `\r\n` work) |
| `b hex de ad be ef` | Send raw bytes out of side b |
| `both bin 01010101` | Send binary digits to both sides |
| `a file ./frame.bin` | Send a file's bytes |
| `b off` / `b on` | Disable / enable a side at runtime |

To inject from a script, feed stdin through a FIFO or a pipe:

```sh
mkfifo rift.in
rift pipe tcp-server://127.0.0.1:9000 tcp://127.0.0.1:7000 --log json < rift.in > rift.log 2>&1 &
exec 3> rift.in
echo 'b hex 01 02 03' >&3
```

## Docker

```sh
docker run --rm -p 9000:9000 -p 5000:5000/udp ghcr.io/skylineagle/rift \
  pipe tcp-server://0.0.0.0:9000 udp-server://0.0.0.0:5000
docker run --rm --device /dev/ttyUSB0 -p 9000:9000 ghcr.io/skylineagle/rift \
  pipe tcp-server://0.0.0.0:9000 "uart:///dev/ttyUSB0?baud=115200"
```

Serial passthrough works only on Linux hosts.

## Install

- Release archives and desktop installers: https://github.com/skylineagle/rift/releases/latest (the desktop app puts `rift` on PATH).
- From source: `cargo install --git https://github.com/skylineagle/rift rift-cli`.
