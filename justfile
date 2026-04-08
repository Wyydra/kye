# List available commands
default:
    @just --list

# Run the frontend dev server and the rust backend (via Tauri)
dev:
    cargo tauri dev

# Build the frontend and rust backend for production
build:
    cargo tauri build

# Run formatting checks and fixes
fmt:
    cargo fmt -p domain -p infra -p cli -p gui
    cd frontend && bunx eslint . --fix

# Run linter
lint:
    cargo clippy --all-targets --all-features -- -D warnings
    cd frontend && bun run lint

# Run all tests
test:
    cargo test --workspace

# Clean all build artifacts
clean:
    cargo clean
    rm -rf frontend/node_modules
    rm -rf frontend/dist

# Install frontend dependencies
install:
    cd frontend && bun install
