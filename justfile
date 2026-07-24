default:
    @just --list

open-port:
  nix-shell -p nixos-firewall-tool --command "sudo nixos-firewall-tool open tcp 1420"

# Launch desktop GUI in dev mode
gui-dev:
    cd crates/gui && bun run tauri dev

# Build desktop GUI production package
gui-build:
    cd crates/gui && bun run tauri build

# Run Android app in dev mode (on connected device or emulator)
android-dev:
    cd crates/gui && bunx tauri android dev

# Build Android APK for production
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
