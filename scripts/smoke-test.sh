#!/usr/bin/env bash
# ============================================================================
# Real-network integration smoke test for Stellar Payment Gateway SDK.
#
# Deploys the core contracts to a Stellar network (via scripts/deploy.sh) and
# runs one end-to-end flow on the batch-conversion contract:
#
#   1. create two test assets (SMOKE1 / SMOKE2) issued by the admin account
#   2. fund the batch-conversion contract with SMOKE2 liquidity
#   3. set a 9/10 conversion rate (SMOKE1 -> SMOKE2)
#   4. convert AMOUNT_IN SMOKE1, expecting at least MIN_AMOUNT_OUT SMOKE2
#      (slippage-protected)
#   5. verify the resulting balances on-chain
#   6. withdraw the collected SMOKE1 liquidity back to the admin
#
# Requirements:
#   - scripts/.env configured (RPC_URL, NETWORK_PASSPHRASE, SOURCE_ACCOUNT,
#     ADMIN). ADMIN must be the PUBLIC KEY (G...) of the SOURCE_ACCOUNT secret
#     key so admin-required operations can be authorized.
#   - soroban CLI (default) or stellar CLI (set CLI=stellar). Newer stellar
#     CLI versions use `--source` instead of `--source-account`; set
#     SOURCE_FLAG=source if your CLI rejects the default.
#   - The deployer account funded with testnet XLM.
#
# Usage:
#   bash scripts/smoke-test.sh                # deploy batch-conversion if needed, then run
#   bash scripts/smoke-test.sh --skip-deploy  # reuse scripts/.deployed-addresses.env
#   bash scripts/smoke-test.sh --reset        # delete saved addresses/tokens first
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
: "${ADMIN:?Set ADMIN to the deployer public key (G...) — the smoke test uses it as asset issuer and conversion user}"

CLI="${CLI:-soroban}"
SOURCE_FLAG="${SOURCE_FLAG:-source-account}"
# Secret key that signs every invocation; must correspond to ADMIN.
SIGNER="${SMOKE_SIGNER:-$SOURCE_ACCOUNT}"

# Configurable smoke-test parameters.
FROM_CODE="${SMOKE_FROM_CODE:-SMOKE1}"
TO_CODE="${SMOKE_TO_CODE:-SMOKE2}"
AMOUNT_IN="${SMOKE_AMOUNT_IN:-100}"
MIN_AMOUNT_OUT="${SMOKE_MIN_AMOUNT_OUT:-90}"
LIQUIDITY="${SMOKE_LIQUIDITY:-1000}"
RATE_NUM="${SMOKE_RATE_NUMERATOR:-9}"
RATE_DEN="${SMOKE_RATE_DENOMINATOR:-10}"

SKIP_DEPLOY=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

addr() {
  grep -E "^$1=" "$OUT_FILE" | tail -1 | cut -d= -f2 || true
}

cli_invoke() { # <contract-id> <function> [args...]
  "$CLI" contract invoke --id "$1" --"$SOURCE_FLAG" "$SIGNER" \
    --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" "${@:2}"
}

# Deterministic Stellar Asset Contract address for a code:ADMIN asset.
token_address() {
  local code="$1"
  local out
  out="$("$CLI" contract id asset --asset "${code}:${ADMIN}" \
    --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" 2>/dev/null | tail -1)"
  if [[ "$out" != C* ]]; then
    # Deprecated alias kept by some CLI versions.
    out="$("$CLI" contract asset id --asset "${code}:${ADMIN}" \
      --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" 2>/dev/null | tail -1)"
  fi
  if [[ "$out" != C* ]]; then
    echo "!! could not derive the Stellar Asset Contract address for ${code}:${ADMIN}" >&2
    echo "   (tried 'contract id asset' and 'contract asset id'; check your CLI version)" >&2
    return 1
  fi
  echo "$out"
}

ensure_token() { # <code> <marker-key>
  local code="$1" key="$2"
  local address
  address="$(token_address "$code")"

  # Status lines go to stderr so stdout carries only the address.
  if [ -n "$(addr "$key")" ]; then
    echo "==> Reusing $code Stellar Asset Contract: $address" >&2
  else
    echo "==> Deploying $code Stellar Asset Contract: $address" >&2
    # 'contract already exists' (or a printed address) means it is deployed;
    # anything else is a real failure and the marker is NOT written.
    local deploy_out
    deploy_out="$("$CLI" contract asset deploy --asset "${code}:${ADMIN}" --"$SOURCE_FLAG" "$SIGNER" \
      --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" 2>&1 || true)"
    if ! [[ "$deploy_out" =~ already[[:space:]]exists || "$deploy_out" =~ C[A-Z0-9]{50,} ]]; then
      echo "    !! could not deploy the $code Stellar Asset Contract: $deploy_out" >&2
      return 1
    fi
    echo "$key=$address" >> "$OUT_FILE"
  fi
  echo "$address"
}

token_balance() { # <token-id> <owner-address>
  local out val
  out="$(cli_invoke "$1" balance --id "$2" 2>&1)"
  val="$(grep -oE '[0-9]+' <<<"$out" | tail -1)"
  if [ -z "$val" ]; then
    echo "    !! balance call failed: $out" >&2
    echo error
    return 1
  fi
  echo "$val"
}

get_liquidity() { # <contract-id> <asset-address>
  local out val
  out="$(cli_invoke "$1" get_liquidity --asset "$2" 2>&1)"
  val="$(grep -oE '[0-9]+' <<<"$out" | tail -1)"
  if [ -z "$val" ]; then
    echo "    !! liquidity call failed: $out" >&2
    echo error
    return 1
  fi
  echo "$val"
}

mint_token() { # <token-id> <to> <amount>
  cli_invoke "$1" mint --to "$2" --amount "$3" >/dev/null
  echo "    minted $3 to $2"
}

set_rate() { # <contract-id> <from> <to> <num> <den>
  cli_invoke "$1" set_conversion_rate --from_asset "$2" --to_asset "$3" \
    --rate_numerator "$4" --rate_denominator "$5" >/dev/null
}

convert() { # <contract-id> <user> <from> <to> <amount-in> <min-out>
  local req="[{\"user\":\"$2\",\"from_asset\":\"$3\",\"to_asset\":\"$4\",\"amount_in\":$5,\"min_amount_out\":$6}]"
  cli_invoke "$1" batch_convert_currency --conversions "$req" >/dev/null
}

withdraw() { # <contract-id> <asset> <amount>
  cli_invoke "$1" withdraw_liquidity --asset "$2" --amount "$3" >/dev/null
}

expect_eq() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "    OK: $label = $actual"
  else
    echo "    FAIL: $label = $actual (expected $expected)" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
main() {
  # Print a clear failure banner when the smoke test exits non-zero.
  trap 'if [ $? -ne 0 ]; then echo "SMOKE TEST FAILED — see errors above" >&2; fi' EXIT

  for arg in "$@"; do
    case "$arg" in
      --skip-deploy) SKIP_DEPLOY=1 ;;
      --reset) rm -f "$OUT_FILE" ;;
      *) echo "Unknown option: $arg (expected --skip-deploy or --reset)" >&2; exit 2 ;;
    esac
  done

  if [ ! -f "$OUT_FILE" ]; then
    : > "$OUT_FILE"
  fi

  # 1. Deploy batch-conversion (if needed).
  if [ "$SKIP_DEPLOY" -eq 0 ]; then
    echo "==> Deploying batch-conversion via scripts/deploy.sh"
    bash "$SCRIPT_DIR/deploy.sh" batch-conversion
  fi
  local bc
  bc="$(addr batch_conversion)"
  if [ -z "$bc" ]; then
    echo "!! batch_conversion address not found in $OUT_FILE." >&2
    echo "   Run the smoke test without --skip-deploy first, or deploy with:" >&2
    echo "   bash scripts/deploy.sh batch-conversion" >&2
    exit 1
  fi
  echo "batch-conversion: $bc"
  echo

  # 2. Ensure both test asset contracts exist.
  local from_token to_token
  from_token="$(ensure_token "$FROM_CODE" smoke_from_token)"
  to_token="$(ensure_token "$TO_CODE" smoke_to_token)"
  echo

  # 3. Fund the contract liquidity and the user's balance.
  echo "==> Funding liquidity: $LIQUIDITY $TO_CODE -> batch-conversion"
  mint_token "$to_token" "$bc" "$LIQUIDITY"
  echo "==> Funding user: $AMOUNT_IN $FROM_CODE -> $ADMIN"
  mint_token "$from_token" "$ADMIN" "$AMOUNT_IN"
  echo

  # 4. Configure the exchange rate.
  echo "==> Setting conversion rate $FROM_CODE/$TO_CODE = $RATE_NUM/$RATE_DEN"
  set_rate "$bc" "$from_token" "$to_token" "$RATE_NUM" "$RATE_DEN"
  echo

  # 5. Snapshot balances, then run the conversion.
  echo "==> Snapshotting balances before conversion"
  local before_user_from before_user_to before_contract_from before_contract_to
  before_user_from="$(token_balance "$from_token" "$ADMIN")"
  before_user_to="$(token_balance "$to_token" "$ADMIN")"
  before_contract_from="$(get_liquidity "$bc" "$from_token")"
  before_contract_to="$(get_liquidity "$bc" "$to_token")"
  echo "    user $FROM_CODE: $before_user_from | user $TO_CODE: $before_user_to | contract $TO_CODE: $before_contract_to"

  echo "==> Converting $AMOUNT_IN $FROM_CODE (min out $MIN_AMOUNT_OUT $TO_CODE)"
  convert "$bc" "$ADMIN" "$from_token" "$to_token" "$AMOUNT_IN" "$MIN_AMOUNT_OUT"
  echo

  # 6. Verify the resulting balance deltas on-chain.
  echo "==> Verifying balance deltas"
  local expected_out
  expected_out=$((AMOUNT_IN * RATE_NUM / RATE_DEN))

  # User paid `amount_in` of from_asset and received `expected_out` of to_asset;
  # the contract's to_asset liquidity dropped by exactly `expected_out`.
  expect_eq "user $FROM_CODE balance" \
    "$(token_balance "$from_token" "$ADMIN")" "$((before_user_from - AMOUNT_IN))"
  expect_eq "user $TO_CODE balance" \
    "$(token_balance "$to_token" "$ADMIN")" "$((before_user_to + expected_out))"
  expect_eq "contract $TO_CODE balance" \
    "$(token_balance "$to_token" "$bc")" "$((before_contract_to - expected_out))"
  expect_eq "contract get_liquidity" \
    "$(get_liquidity "$bc" "$to_token")" "$((before_contract_to - expected_out))"
  echo

  # 7. Withdraw the collected liquidity back to the admin.
  echo "==> Withdrawing collected $FROM_CODE liquidity back to admin"
  withdraw "$bc" "$from_token" "$AMOUNT_IN"
  # The contract collected exactly `amount_in` during the conversion, so after
  # withdrawing it the contract is back to its pre-conversion balance and the
  # admin is back to theirs.
  expect_eq "contract $FROM_CODE liquidity after withdraw" \
    "$(get_liquidity "$bc" "$from_token")" "$before_contract_from"
  expect_eq "admin $FROM_CODE balance after withdraw" \
    "$(token_balance "$from_token" "$ADMIN")" "$before_user_from"
  echo

  echo "============================================================================"
  echo "SMOKE TEST PASSED — end-to-end conversion flow verified on-chain."
  echo "  batch-conversion : $bc"
  echo "  $FROM_CODE token  : $from_token"
  echo "  $TO_CODE token    : $to_token"
  echo "  addresses saved to $OUT_FILE"
  echo "============================================================================"
}

main "$@"
