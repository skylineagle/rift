# Endpoint options

URI query params, same names as the TOML keys. Omitted means default.

| Endpoint | Option | Default | Meaning |
| --- | --- | --- | --- |
| `tcp` | `reconnect_delay_ms` | `1000` | Initial reconnect delay; backoff doubles up to 10s |
| `tcp` | `connect_timeout_ms` | `5000` | Give up a connection attempt after this long |
| `tcp` | `no_delay` | `true` | Set `TCP_NODELAY` |
| `tcp-server` | `max_clients` | unlimited | Extra connections are accepted, then closed with an error event |
| `tcp-server` | `no_delay` | `true` | Set `TCP_NODELAY` on accepted connections |
| `udp` | `bind` | auto | Local address to bind |
| `udp-server` | `reply_to` | `all` | `all` or `last`: which peers get data written to this side |
| `udp-server` | `peer_timeout_secs` | none | Forget peers silent this long |
| `uart` | `baud` | required | Baud rate |
| `uart` | `data_bits` | `8` | 5, 6, 7 or 8 |
| `uart` | `parity` | `none` | `none`, `odd`, `even` |
| `uart` | `stop_bits` | `1` | 1 or 2 |
| `uart` | `flow` | `none` | `none`, `software`, `hardware` |
| any | `enabled` | `true` | `false` keeps the side closed; data to it is dropped |
