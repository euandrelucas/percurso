#!/usr/bin/env bash
# Backup do banco (pg_dump comprimido). Guarde também o ENCRYPTION_KEY (.env ou volume appdata) em local separado e seguro.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
F="backups/percurso-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U percurso percurso | gzip > "$F"
chmod 600 "$F"
echo "✔ $F"
