# Build from the repository root so the pinned parser submodule is available.
FROM rust:1.86-bookworm AS build
WORKDIR /workspace
COPY services/hdfc-parser/Cargo.toml services/hdfc-parser/Cargo.toml
COPY services/hdfc-parser/src services/hdfc-parser/src
COPY vendor/hdfc-cc-parser-rs vendor/hdfc-cc-parser-rs
WORKDIR /workspace/services/hdfc-parser
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN useradd --system --uid 10001 --create-home --home-dir /nonexistent corleon
COPY --from=build /workspace/services/hdfc-parser/target/release/corleon-hdfc-parser /usr/local/bin/corleon-hdfc-parser
ENV BIND_ADDRESS=0.0.0.0:8080
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/corleon-hdfc-parser"]
