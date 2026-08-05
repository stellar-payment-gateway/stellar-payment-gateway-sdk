#!/usr/bin/env bash
# ============================================================================
# Deploy Stellar Payment Gateway SDK contracts to a Stellar network.
#
# Requires the soroban CLI (default) or the newer stellar CLI (set CLI=stellar).
# Configure scripts/.env first — copy scripts/.env.example and fill it in.
#
# Usage:
#   scripts/deploy.sh                 # deploy the core set (default)
#   scripts/deploy.sh <pkg> [<pkg>]   # deploy specific workspace packages
#
# Contract addresses are appended to scripts/.deployed-addresses.env.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
OUT_FILE="${SCRIPT_DIR}/.deployed-addresses.env"

# Load configuration (RPC_URL, NETWORK_PASSPHRASE, SOURCE_ACCOUNT, ADMIN, ...)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${RPC_URL:?Set RPC_URL in scripts/.env (e.g. https://soroban-testnet.stellar.org)}"
: "${NETWORK_PASSPHRASE:?Set NETWORK_PASSPHRASE (Test SDF Network ; September 2015)}"
: "${SOURCE_ACCOUNT:?Set SOURCE_ACCOUNT to the deployer secret key (S...)}"
: "${ADMIN:?Set ADMIN to the address that should own the contracts}"

CLI="${CLI:-soroban}"
# Newer stellar CLI versions use `--source` instead of `--source-account`.
SOURCE_FLAG="${SOURCE_FLAG:-source-account}"
TARGET_DIR="${TARGET_DIR:-target/wasm32-unknown-unknown/release}"

# Default core deployment set.
CORE_PACKAGES="batch-conversion zk-verifier savings-goals spending-limits multi-currency-wallet"

# ---------------------------------------------------------------------------
# Contract initialization arguments.
#
# Two sources, in priority order:
#   1. An INIT_ARGS_<package> environment variable (package dashes -> underscores),
#      e.g. INIT_ARGS_spending_rules="-- --admin $ADMIN --category_contract C... --zk_verifier_contract C..."
#   2. The built-in cases below.
#
# Contracts without init args are deployed as-is and must be initialized
# manually (see docs/testnet-deployment.md).
# ---------------------------------------------------------------------------
init_args() {
  local pkg="$1"
  local key="INIT_ARGS_${pkg//-/_}"

  if [ -n "${!key:-}" ]; then
    echo "-- ${!key}"
    return
  fi

  case "$pkg" in
    batch-conversion) echo "-- --admin $ADMIN" ;;
    savings-goals) echo "-- --admin $ADMIN" ;;
    spending-limits) echo "-- --admin $ADMIN" ;;
    zk-verifier)
      echo "-- --admin $ADMIN --verifier_pk ${VERIFIER_PK:?Set VERIFIER_PK (ed25519 prover public key) to auto-initialize zk-verifier}"
      ;;
    *) echo "" ;; # deploy-only
  esac
}

build_pkg() {
  local pkg="$1"
  echo "==> Building $pkg"
  (cd "$ROOT_DIR" && cargo build --release --target wasm32-unknown-unknown -p "$pkg")
}

deploy_pkg() {
  local pkg="$1"
  local wasm="$TARGET_DIR/${pkg//-/_}.wasm"
  local args
  args="$(init_args "$pkg")"

  if [ ! -f "$wasm" ]; then
    build_pkg "$pkg"
  fi

  echo "==> Deploying $pkg"
  local output
  output="$("$CLI" contract deploy \
    --wasm "$wasm" \
    --"$SOURCE_FLAG" "$SOURCE_ACCOUNT" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    $args 2>&1 | tail -1)"

  # The CLI prints the contract address (C...) as the last line.
  local address="${output##* }"
  if [[ "$address" != C* ]]; then
    echo "    !! unexpected CLI output: $output" >&2
    return 1
  fi

  echo "    deployed at $address"
  echo "${pkg//-/_}=$address" >> "$OUT_FILE"
}

# ---------------------------------------------------------------------------
main() {
  local packages=()
  if [ "$#" -eq 0 ]; then
    read -r -a packages <<<"$CORE_PACKAGES"
  else
    packages=("$@")
  fi

  # Start a fresh address file for this run.
  : > "$OUT_FILE"
  echo "# Deployed $(date -u +%Y-%m-%dT%H:%M:%SZ) via $CLI" >> "$OUT_FILE"

  for pkg in "${packages[@]}"; do
    deploy_pkg "$pkg"
  done

  echo
  echo "Done. Addresses saved to $OUT_FILE"
}

main "$@"
