<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ConfiguracaoMes extends Model
{
    use HasFactory;

    protected $table = 'configuracoes_mes';

    protected $fillable = ['ano_mes', 'meta_diaria'];

    protected $casts = [
        'meta_diaria' => 'decimal:2',
    ];
}