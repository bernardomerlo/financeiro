FROM php:8.3-apache

# 1. Instalar dependências do sistema e extensões do PHP
RUN apt-get update && apt-get install -y \
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

# 2. Habilitar o mod_rewrite do Apache
RUN a2enmod rewrite

# 3. Mudar o DocumentRoot do Apache para a pasta public do Laravel (Sintaxe ENV corrigida)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# 4. Configurar o Apache para escutar na porta injetada pelo Railway
RUN sed -s -i -e "s/80/\$\{PORT\}/" /etc/apache2/ports.conf
RUN sed -s -i -e "s/*:80/*:\$\{PORT\}/" /etc/apache2/sites-available/000-default.conf

# 5. Instalar o Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 6. Definir o diretório de trabalho
WORKDIR /var/www/html

# 7. Copiar os arquivos do projeto para o container
COPY . .

# 8. Instalar as dependências do Laravel
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# 9. Ajustar as permissões das pastas que o Laravel precisa escrever
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

# 10. Definir a porta padrão caso o container seja rodado localmente
ENV PORT=8080
EXPOSE ${PORT}

# 11. Iniciar o Apache em primeiro plano
CMD ["apache2-foreground"]