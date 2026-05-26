<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transacao extends Model
{
    use HasFactory;

    protected $table = 'transacoes';

    protected $fillable = [
        'data',
        'tipo',
        'valor',
        'descricao',
    ];

    protected $casts = [
        'data' => 'date:Y-m-d',
        'valor' => 'decimal:2',
    ];
}