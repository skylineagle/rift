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

Every side also takes `enabled` (default `true`).

URI to TOML mapping: `tcp://` = `tcp-client`, `udp://` = `udp-client`, URI `baud` = `baud_rate`, URI `flow` = `flow_control`.
More samples: https://github.com/skylineagle/rift/tree/main/examples
