<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuracoes_mes', function (Blueprint $table) {
            $table->id();
            $table->string('ano_mes')->unique(); // Formato: 'YYYY-MM'
            $table->decimal('meta_diaria', 10, 2)->default(50.00);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('configuracoes_mes');
    }
};