FROM rust:1-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends libudev-dev pkg-config && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release -p rift-cli

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libudev1 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd --system --create-home --groups dialout rift && mkdir /config && chown rift /config
COPY --from=build /src/target/release/rift /usr/local/bin/rift
USER rift
ENV RIFT_CONFIG=/config/rift.toml
ENTRYPOINT ["rift"]
CMD ["run", "--all", "--log", "json"]
