# 1. Base image avec cargo-chef
FROM lukemathwalker/cargo-chef:latest-rust-1-bookworm AS chef
WORKDIR /usr/src/kye

# 2. Planner : analyse les dépendances et génère recipe.json
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo chef prepare --recipe-path recipe.json

# 3. Builder : compile uniquement les dépendances (Layer Docker mis en cache)
FROM chef AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY --from=planner /usr/src/kye/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# 4. Compilé uniquement le code source du projet
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build --release --bin kye-cli && \
    strip /usr/src/kye/target/release/kye-cli

# 5. Image finale d'exécution sécurisée et allégée
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Utilisateur non-root
RUN useradd -m -u 1000 -U kye && \
    mkdir -p /workspace && \
    chown -R kye:kye /workspace

WORKDIR /app
COPY --from=builder /usr/src/kye/target/release/kye-cli /usr/local/bin/kye-cli

USER kye:kye
ENV KYE_WORKSPACE=/workspace
VOLUME ["/workspace"]
EXPOSE 7272

ENTRYPOINT ["kye-cli"]
CMD ["serve", "--workspace", "/workspace", "--port", "7272", "--name", "headless-server"]
