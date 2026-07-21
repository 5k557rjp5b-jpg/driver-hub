#!/usr/bin/env bash
# Concurrent replace_pay_configuration check without dblink.
set -euo pipefail

DB_NAME="${1:-driver_hub_migrate_test}"
USER_ID='11111111-1111-1111-1111-111111111111'

sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users (id) VALUES ('$USER_ID') ON CONFLICT DO NOTHING;
DELETE FROM public.pay_configurations WHERE user_id = '$USER_ID';
INSERT INTO public.pay_configurations (user_id, pay_model, rate_pence, paid_breaks_enabled)
VALUES ('$USER_ID', 'hourly', 1000, false);
SQL

run_one() {
  local rate=$1
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
SELECT set_config('request.jwt.claim.sub', '$USER_ID', false);
SELECT id, rate_pence FROM replace_pay_configuration('$USER_ID'::uuid, 'hourly'::pay_model, $rate, false);
SQL
}

# Fire two concurrent replacements
run_one 1500 >/tmp/rpc_a.out 2>&1 &
pid_a=$!
run_one 1600 >/tmp/rpc_b.out 2>&1 &
pid_b=$!

wait "$pid_a"
status_a=$?
wait "$pid_b"
status_b=$?

echo "=== session A (exit $status_a) ==="
cat /tmp/rpc_a.out
echo "=== session B (exit $status_b) ==="
cat /tmp/rpc_b.out

active=$(sudo -u postgres psql -d "$DB_NAME" -Atc "SELECT count(*) FROM public.pay_configurations WHERE user_id = '$USER_ID' AND superseded_at IS NULL;")
echo "active_count=$active"

if [[ "$active" != "1" ]]; then
  echo "FAIL: expected exactly 1 active configuration"
  exit 1
fi

if [[ "$status_a" -ne 0 && "$status_b" -ne 0 ]]; then
  echo "FAIL: both concurrent RPC calls failed"
  exit 1
fi

echo "PASS: concurrency check — exactly one active pay_configuration"
