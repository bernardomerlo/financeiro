FROM php:8.3-apache

# 1. Instalar dependências do sistema e extensões do PHP
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    git \
    curl \
    libpq-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql mbstring exif pcntl bcmath gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Corrigir o erro de múltiplos MPMs (desativa event/worker e garante o prefork) e habilitar mod_rewrite
RUN a2dismod mpm_event mpm_worker || true \
    && a2enmod mpm_prefork \
    && a2enmod rewrite

# 3. Mudar o DocumentRoot do Apache para a pasta public do Laravel
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# 4. Configurar a porta injetada pelo Railway (usando aspas simples para injetar a string literal ${PORT})
RUN sed -i 's/80/${PORT}/g' /etc/apache2/ports.conf
RUN sed -i 's/*:80/*:${PORT}/g' /etc/apache2/sites-available/000-default.conf

# 5. Instalar o Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 6. Definir o diretório de trabalho
WORKDIR /var/www/html

# 7. Copiar os arquivos do projeto para o container
COPY . .

# 8. Permitir o Composer como root e instalar dependências do Laravel
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# 9. Ajustar as permissões das pastas que o Laravel precisa escrever
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

# 10. Definir a porta padrão para fallback
ENV PORT=8080
EXPOSE ${PORT}

# 11. Iniciar o Apache
CMD ["apache2-foreground"]