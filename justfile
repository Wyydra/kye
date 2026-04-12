default:
    @just --list
gui-dev:
    RUST_LOG=debug cargo tauri dev
gui-build:
    cargo tauri build
build-watch:
  RUST_LOG=debug cargo watch -x build
fmt:
    cargo fmt -p domain -p infra -p cli -p gui
    cd frontend && bunx eslint . --fix
lint:
    cargo clippy --all-targets --all-features -- -D warnings
    cd frontend && bun run lint
test:
    cargo test --workspace
clean:
    cargo clean
    rm -rf frontend/node_modules
    rm -rf frontend/dist
install:
    cd frontend && bun install
