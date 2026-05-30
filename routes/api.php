<?php

use App\Http\Controllers\TransacaoController;
use App\Http\Controllers\MesController;
use Illuminate\Support\Facades\Route;

Route::post('/transacoes', [TransacaoController::class, 'store']);
Route::put('/transacoes/{id}', [TransacaoController::class, 'update']);
Route::delete('/transacoes/{id}', [TransacaoController::class, 'destroy']);
Route::get('/meses/{ano_mes}', [MesController::class, 'show']);
Route::get('/teste', function () {
    return response()->json(['message' => 'API is working']);
});
Route::post('/meses/{ano_mes}/config', [MesController::class, 'updateConfig']);