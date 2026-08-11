# ==============================================================================
# DEPRECATED: just recipes are now consolidated in mise.toml
# Run `mise tasks` or `mise run <task>` (short: `mise r <task>`)
# ==============================================================================

default:
    @mise tasks

gui-dev:
    @mise run gui-dev

gui-build:
    @mise run gui-build

serve workspace="./demo" port="7272":
    @mise run serve

info:
    @mise run info

cli-build:
    @mise run cli-build

android-dev:
    @mise run android-dev

android-build:
    @mise run android-build

fmt:
    @mise run fmt

lint:
    @mise run lint

test:
    @mise run test

clean:
    @mise run clean

install:
    @mise run install
