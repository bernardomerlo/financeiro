<?php

use App\Http\Controllers\TransacaoController;
use App\Http\Controllers\MesController;
use Illuminate\Support\Facades\Route;

Route::post('/transacoes', [TransacaoController::class, 'store']);
Route::get('/meses/{ano_mes}', [MesController::class, 'show']);
Route::post('/meses/{ano_mes}/meta', [MesController::class, 'updateMeta']);