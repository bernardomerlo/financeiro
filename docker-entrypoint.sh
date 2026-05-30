#!/bin/bash
set -e

echo ">>> [entrypoint] Iniciando — PORT=${PORT} APP_ENV=${APP_ENV:-production}"

# ── 1. Corrigir MPMs ──────────────────────────────────────────────
echo ">>> [entrypoint] Configurando MPM Prefork..."
rm -f /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_event.load \
      /etc/apache2/mods-enabled/mpm_worker.conf \
      /etc/apache2/mods-enabled/mpm_worker.load

ln -sf /etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf
ln -sf /etc/apache2/mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load

# ── 2. Porta ──────────────────────────────────────────────────────
echo ">>> [entrypoint] Configurando Apache na porta ${PORT}..."
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/ports.conf
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/sites-available/000-default.conf
echo "ServerName localhost" >> /etc/apache2/apache2.conf

# ── 3. Gerar .env a partir de TODAS as variáveis de ambiente ──────
# Em vez de listar variáveis individualmente, exportamos tudo que
# está no ambiente (Railway injeta SESSION_*, CACHE_*, QUEUE_*, etc.)
cd /var/www/html

echo ">>> [entrypoint] Gerando .env a partir do ambiente..."
# Limpa qualquer .env anterior para evitar valores obsoletos
: > .env

# Itera sobre todas as variáveis de ambiente e as escreve no .env.
# Variáveis com quebras de linha no valor são tratadas com aspas.
# Variáveis internas do shell/sistema que não são relevantes para o
# Laravel são ignoradas (_, PWD, SHLVL, etc.).
printenv | while IFS='=' read -r key value; do
    # Pula variáveis de sistema que não devem ir para o .env
    case "$key" in
        _|SHLVL|PWD|OLDPWD|HOME|TERM|HOSTNAME|BASH*|FUNCNAME*) continue ;;
    esac
    # Escapa aspas duplas no valor e envolve em aspas para preservar
    # espaços, caracteres especiais e valores vazios
    escaped_value=$(printf '%s' "$value" | sed 's/"/\\"/g')
    printf '%s="%s"\n' "$key" "$escaped_value" >> .env
done

echo ">>> [entrypoint] .env gerado com $(wc -l < .env) variáveis."

# ── 4. Gerar APP_KEY se não estiver definida ──────────────────────
if [ -z "${APP_KEY:-}" ]; then
    echo ">>> [entrypoint] APP_KEY ausente — gerando nova chave..."
    php artisan key:generate --force
else
    echo ">>> [entrypoint] APP_KEY já definida."
fi

# ── 5. Cache de config e rotas ────────────────────────────────────
echo ">>> [entrypoint] Cacheando configurações e rotas..."
php artisan config:cache && echo ">>> [entrypoint] config:cache OK" \
    || echo ">>> [entrypoint] AVISO: config:cache falhou — continuando..."
php artisan route:cache && echo ">>> [entrypoint] route:cache OK" \
    || echo ">>> [entrypoint] AVISO: route:cache falhou — continuando..."

# ── 6. Migrations com retry e fallback gracioso ───────────────────
# Se o banco ainda não estiver disponível, registra aviso e continua.
# O Apache sobe de qualquer forma; as migrations podem ser re-tentadas
# manualmente ou na próxima reinicialização do container.
echo ">>> [entrypoint] Tentando executar migrations..."

DB_READY=false
MAX_RETRIES=5
RETRY_DELAY=3

for attempt in $(seq 1 $MAX_RETRIES); do
    echo ">>> [entrypoint] Tentativa de migration ${attempt}/${MAX_RETRIES}..."
    if php artisan migrate --force 2>&1; then
        DB_READY=true
        echo ">>> [entrypoint] Migrations concluídas com sucesso."
        break
    else
        echo ">>> [entrypoint] AVISO: Migration falhou na tentativa ${attempt}. Aguardando ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    fi
done

if [ "$DB_READY" = false ]; then
    echo ">>> [entrypoint] AVISO: Não foi possível executar migrations após ${MAX_RETRIES} tentativas."
    echo ">>> [entrypoint] O Apache será iniciado mesmo assim. Verifique a conectividade com o banco."
fi

# ── 7. Apache ─────────────────────────────────────────────────────
echo ">>> [entrypoint] Subindo Apache na porta ${PORT}..."
exec apache2-foreground