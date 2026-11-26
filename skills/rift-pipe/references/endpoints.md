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
| `ws`/`wss` | `format` | `binary` | How bytes travel: `binary` frames, `text` (UTF-8), `base64` or `hex` text, or `json` envelope |
| `ws`/`wss` | `json_field` | `data` | `format=json` only: field holding the data, dot path for nesting (`msg.raw`) |
| `ws`/`wss` | `json_value` | `text` | `format=json` only: `text`, `base64`, `hex` string, or `json` to embed/extract the data as a JSON value |
| `ws`/`wss` | `reconnect_delay_ms` | `1000` | Initial reconnect delay, same backoff as `tcp` |
| `ws`/`wss` | `connect_timeout_ms` | `5000` | Give up a connection attempt after this long |
| `ws-server` | `format`, `json_field`, `json_value` | as `ws` | Same message format options, applied to every client |
| `ws-server` | `max_clients` | unlimited | Data written to this side is broadcast to all clients |
| `amqp`/`amqps` | `exchange` | default exchange | Exchange to publish to (and to bind the queue to) |
| `amqp`/`amqps` | `exchange_type` | `direct` | `direct`, `fanout`, `topic`, `headers` (used when creating it) |
| `amqp`/`amqps` | `declare_exchange` | `false` | Create the exchange if missing |
| `amqp`/`amqps` | `routing_key` | empty | Publish routing key; with no exchange and no key the side only consumes |
| `amqp`/`amqps` | `queue` | none | Queue to consume from; empty value asks the broker for a server-named queue |
| `amqp`/`amqps` | `declare_queue` | `true` | Create the queue; `false` only checks it exists |
| `amqp`/`amqps` | `queue_type` | `classic` | `classic`, `quorum`, `stream` |
| `amqp`/`amqps` | `durable` / `exclusive` / `auto_delete` | `true` / `false` / `false` | Queue (and created exchange) flags |
| `amqp`/`amqps` | `binding_key` | `routing_key` | Key binding the queue to `exchange` |
| `amqp`/`amqps` | `message_ttl_ms`, `expires_ms`, `max_length`, `max_length_bytes`, `max_priority` | none | Queue arguments (`x-message-ttl`, ...) |
| `amqp`/`amqps` | `dead_letter_exchange`, `dead_letter_routing_key` | none | Dead lettering |
| `amqp`/`amqps` | `prefetch` | `50` | Unacked deliveries in flight; each is acked after it is forwarded |
| `amqp`/`amqps` | `persistent` / `content_type` | `false` / none | Published message properties |
| `amqp`/`amqps` | `reconnect_delay_ms`, `connect_timeout_ms` | `1000`, `5000` | Reconnect behaviour |
| any | `enabled` | `true` | `false` keeps the side closed; data to it is dropped |
