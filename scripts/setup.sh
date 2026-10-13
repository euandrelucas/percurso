#!/usr/bin/env bash
# Prepara o .env com segredos fortes. Uso: ./scripts/setup.sh [dominio]
# Sem domínio: modo local (http://localhost). Com domínio: HTTPS automático via Caddy.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { echo ".env já existe — nada foi alterado."; exit 0; }
rand() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
DOMAIN="${1:-}"
cp .env.example .env
set_kv() { sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak; }
set_kv POSTGRES_PASSWORD "$(rand 24)"
set_kv AUTH_SECRET "$(rand 32)"
set_kv ENCRYPTION_KEY "$(rand 32)"
if [ -n "$DOMAIN" ]; then set_kv SITE_ADDRESS "$DOMAIN"; set_kv APP_URL "https://$DOMAIN"; fi
read -rp "E-mail do admin: " AE; set_kv ADMIN_EMAIL "$AE"
read -rsp "Senha do admin (mín. 10 caracteres): " AP; echo; set_kv ADMIN_PASSWORD "$AP"
read -rp "OPENAI_API_KEY (Enter para pular e usar modo demonstração): " OK
if [ -n "$OK" ]; then set_kv OPENAI_API_KEY "$OK"; else set_kv MOCK_AI 1; fi
chmod 600 .env
echo
echo "✔ .env criado. Guarde uma cópia segura do ENCRYPTION_KEY (sem ela os dados cifrados não abrem)."
echo "  Agora:  docker compose up -d"
