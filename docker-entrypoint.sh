#!/bin/bash
set -e

# Garantir que apenas mpm_prefork está ativo em runtime
rm -f /etc/apache2/mods-enabled/mpm_event.conf \
      /etc/apache2/mods-enabled/mpm_event.load \
      /etc/apache2/mods-enabled/mpm_worker.conf \
      /etc/apache2/mods-enabled/mpm_worker.load

ln -sf /etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-enabled/mpm_prefork.conf
ln -sf /etc/apache2/mods-available/mpm_prefork.load /etc/apache2/mods-enabled/mpm_prefork.load

# Substituir ${PORT} pelo valor real da variável de ambiente
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/ports.conf
sed -i "s/\${PORT}/${PORT}/g" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground