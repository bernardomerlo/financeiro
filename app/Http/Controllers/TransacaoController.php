<?php

namespace App\Http\Controllers;

use App\Models\Transacao;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TransacaoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'data' => 'required|date_format:Y-m-d',
            'tipo' => 'required|in:entrada,saida,diario',
            'valor' => 'required|numeric|gt:0',
            'descricao' => 'nullable|string|max:255',
        ]);

        $transacao = Transacao::create($validated);

        return response()->json([
            'message' => 'Transação registrada com sucesso.',
            'data' => $transacao
        ], 201);
    }
}