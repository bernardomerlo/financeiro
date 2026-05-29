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

# ── 2. Corrigir porta em runtime ──────────────────────────────────
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/ports.conf
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/sites-available/000-default.conf

echo "ServerName localhost" >> /etc/apache2/apache2.conf

# ── 3. Setup do Laravel ───────────────────────────────────────────
cd /var/www/html

# Gera APP_KEY se não estiver definida
if [ -z "$APP_KEY" ]; then
    echo ">>> Gerando APP_KEY..."
    php artisan key:generate --force
fi

# Cache de config/rotas/views
echo ">>> Cacheando configurações..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Migrations
echo ">>> Rodando migrations..."
php artisan migrate --force

# ── 4. Subir Apache ───────────────────────────────────────────────
echo ">>> Subindo Apache na porta ${PORT}..."
exec apache2-foreground