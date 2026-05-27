<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('configuracoes_mes', function (Blueprint $table) {
            $table->integer('dia_fechamento_fatura')->nullable();
            $table->integer('dia_pagamento_fatura')->nullable();
            $table->string('dia_entrada')->nullable();
            $table->decimal('valor_entrada', 10, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('configuracoes_mes', function (Blueprint $table) {
            $table->dropColumn([
                'dia_fechamento_fatura',
                'dia_pagamento_fatura',
                'dia_entrada',
                'valor_entrada'
            ]);
        });
    }
};