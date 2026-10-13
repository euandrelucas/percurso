#!/bin/sh
# Entrypoint do app. Se AUTH_SECRET / ENCRYPTION_KEY não vierem do ambiente, gera e guarda no volume /data
# (assim `docker compose up -d` funciona de primeira). ATENÇÃO: faça backup do /data — sem a ENCRYPTION_KEY
# os dados clínicos cifrados no banco não podem ser lidos.
set -eu

SECRETS=/data/secrets.env
if [ -z "${AUTH_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
  if [ ! -f "$SECRETS" ]; then
    umask 077
    {
      echo "AUTH_SECRET=$(head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      echo "ENCRYPTION_KEY=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    } > "$SECRETS"
    echo "[entrypoint] Segredos gerados em $SECRETS (faça backup deste volume)."
  fi
  # carrega apenas o que estiver faltando
  while IFS='=' read -r k v; do
    case "$k" in
      AUTH_SECRET) [ -n "${AUTH_SECRET:-}" ] || export AUTH_SECRET="$v" ;;
      ENCRYPTION_KEY) [ -n "${ENCRYPTION_KEY:-}" ] || export ENCRYPTION_KEY="$v" ;;
    esac
  done < "$SECRETS"
fi

exec "$@"
