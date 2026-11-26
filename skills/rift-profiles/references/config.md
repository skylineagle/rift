# rift.toml reference

One `[[profile]]` table per bridge. Each side is an inline table with a `kind`.

```toml
[[profile]]
name = "primary"
a = { kind = "uart", port = "/dev/ttyUSB0", baud_rate = 115200 }
b = { kind = "tcp-client", address = "ingest.example.com:7000", reconnect_delay_ms = 250 }

[[profile]]
name = "backup"
a = { kind = "tcp-client", address = "backup.example.com:7000", enabled = false }
b = { kind = "udp-server", bind = "0.0.0.0:5001" }
```

| kind | Required | Optional |
| --- | --- | --- |
| `tcp-client` | `address` | `reconnect_delay_ms` (1000), `connect_timeout_ms` (5000), `no_delay` (true) |
| `tcp-server` | `bind` | `max_clients` (unlimited), `no_delay` (true) |
| `udp-client` | `remote` | `bind` (auto) |
| `udp-server` | `bind` | `reply_to` (`all` / `last`), `peer_timeout_secs` |
| `uart` | `port`, `baud_rate` | `data_bits` (8), `parity` (`none`/`odd`/`even`), `stop_bits` (1/2), `flow_control` (`none`/`software`/`hardware`) |
| `websocket-client` | `url` (`ws://` / `wss://`) | `format` (`binary`/`text`/`base64`/`hex`/`json`), `json_field` (`data`), `json_value` (`text`/`base64`/`hex`/`json`), `reconnect_delay_ms` (1000), `connect_timeout_ms` (5000) |
| `websocket-server` | `bind` | `path` (any), `max_clients` (unlimited), `format`, `json_field`, `json_value` |
| `rabbitmq` | `url` (`amqp://` / `amqps://`) | `exchange`, `exchange_type` (`direct`), `declare_exchange` (false), `routing_key`, `queue`, `declare_queue` (true), `queue_type` (`classic`/`quorum`/`stream`), `durable` (true), `exclusive`, `auto_delete`, `binding_key`, `message_ttl_ms`, `expires_ms`, `max_length`, `max_length_bytes`, `max_priority`, `dead_letter_exchange`, `dead_letter_routing_key`, `prefetch` (50), `persistent`, `content_type`, `reconnect_delay_ms`, `connect_timeout_ms` |

Every side also takes `enabled` (default `true`).

## Workflows

Add after the `[[profile]]` table they belong to.

```toml
[[profile.workflows]]
name = "heartbeat"
autostart = true
repeat = 10
steps = [
  { action = "send", target = "Both", format = "text", payload = "PING\\r\\n" },
  { action = "wait", millis = 1000 },
]
```

`autostart` defaults to `false`. Omit `repeat` to loop forever, which needs a `wait` above 0 ms. `target` is `A`, `B` or `Both`; `format` is `text`, `hex`, `binary` or `file`. The `cli-inject` name is used by `rift inject --every`. A control request is capped at 64 KiB, so large `rift inject` payloads should use the `file` format.

## Logging

Every sink is off by default. `run`, `pipe` and `profile add|remove` read this section.

```toml
[logging]
level = "info"              # debug | info | warn | error
stats_interval_secs = 60    # 0 = no stats

[logging.console]
enabled = true
format = "text"             # text | json, written to stderr

[logging.file]
enabled = true
directory = "/var/log/rift" # omit for <OS local data dir>/rift/logs
file_name = "rift.log"      # omit for rift-cli.log (CLI) or rift-desktop.log (desktop)
rotate = "size"             # size | hourly | daily
max_file_bytes = 10485760
max_files = 10              # rotated files kept, 0 = unlimited
max_total_bytes = 104857600 # optional

[logging.http]
enabled = false
url = "http://localhost:8080"
format = "ndjson"           # ndjson | json-array
batch_size = 100
flush_interval_secs = 5
timeout_secs = 10
headers = { Authorization = "ApiKey xyz" }
```

## URIs

URI to TOML mapping: `tcp://` = `tcp-client`, `udp://` = `udp-client`, URI `baud` = `baud_rate`, URI `flow` = `flow_control`.
More samples: https://github.com/skylineagle/rift/tree/main/examples
