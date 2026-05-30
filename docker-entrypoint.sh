#!/bin/bash
set -e

echo ">>> PORT=${PORT}"
echo ">>> APP_ENV=${APP_ENV}"

# ── 1. Corrigir MPMs ──────────────────────────────────────────────
rm -f /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_event.load \
      /etc/apache2/mods-enabled/mpm_worker.conf \
      /etc/apache2/mods-enabled/mpm_worker.load

ln -sf /etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf
ln -sf /etc/apache2/mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load

# ── 2. Porta ──────────────────────────────────────────────────────
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/ports.conf
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/sites-available/000-default.conf
echo "ServerName localhost" >> /etc/apache2/apache2.conf

# ── 3. Gerar .env a partir das variáveis de ambiente do Railway ───
cd /var/www/html

echo ">>> Gerando .env..."
cat > .env <<EOF
APP_NAME=${APP_NAME:-Laravel}
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY:-}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-http://localhost}

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST:-}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-}
DB_USERNAME=${DB_USERNAME:-}
DB_PASSWORD=${DB_PASSWORD:-}
EOF

# ── 4. Gerar APP_KEY se não estiver definida ──────────────────────
if [ -z "$APP_KEY" ]; then
    echo ">>> Gerando APP_KEY..."
    php artisan key:generate --force
fi

# ── 5. Cache de config e rotas ────────────────────────────────────
echo ">>> Cacheando config e rotas..."
php artisan config:cache
php artisan route:cache

# ── 6. Migrations ─────────────────────────────────────────────────
echo ">>> Rodando migrations..."
php artisan migrate --force

# ── 7. Apache ─────────────────────────────────────────────────────
echo ">>> Subindo Apache na porta ${PORT}..."
exec apache2-foreground