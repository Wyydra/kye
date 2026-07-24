default:
    @just --list

# Launch desktop GUI in dev mode with bun
gui-dev:
    cd crates/gui && bun run tauri dev

# Build desktop GUI production package
gui-build:
    cd crates/gui && bun run tauri build

# Launch kye headless daemon server
serve workspace="./demo" port="7272":
    cargo run -p kye-cli -- serve --workspace {{workspace}} --port {{port}}

# Display local P2P sync network info
info:
    cargo run -p kye-cli -- info

# Build kye headless CLI binary
cli-build:
    cargo build -p kye-cli --release

# Initialize Android project configuration
android-init:
    cd crates/gui && bunx tauri android init

# Run Android app in dev mode (on connected device or emulator)
android-dev:
    cd crates/gui && bunx tauri android dev

# Build and run/install Android app in production mode
android-run:
    cd crates/gui && bunx tauri android run

android-build:
    cd crates/gui && bunx tauri android build

# Watch cargo build
build-watch:
    RUST_LOG=debug cargo watch -x build

# Watch cargo check
check-watch:
    RUST_LOG=debug cargo watch -x check

# Format Rust & Frontend code
fmt:
    cargo fmt --all
    cd crates/gui && bun run build

# Run linters across workspace
lint:
    cargo clippy --all-targets --all-features -- -D warnings
    cd crates/gui && bun run build

# Run all unit tests across workspace
test:
    cargo test --workspace
    cd crates/gui && bunx tsc --noEmit

# Clean build artifacts
clean:
    cargo clean
    rm -rf crates/gui/node_modules
    rm -rf crates/gui/dist

# Install node dependencies with bun
install:
    cd crates/gui && bun install
