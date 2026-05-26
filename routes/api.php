<?php

use App\Http\Controllers\TransacaoController;
use Illuminate\Support\Facades\Route;

Route::post('/transacoes', [TransacaoController::class, 'store']);