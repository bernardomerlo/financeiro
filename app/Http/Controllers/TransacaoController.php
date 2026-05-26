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
            'valor' => 'required|numeric|min:0',
            'descricao' => 'nullable|string|max:255',
        ]);

        $transacao = Transacao::create($validated);

        return response()->json([
            'message' => 'Transação registrada com sucesso.',
            'data' => $transacao
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $transacao = Transacao::findOrFail($id);

        $validated = $request->validate([
            'data' => 'sometimes|required|date_format:Y-m-d',
            'tipo' => 'sometimes|required|in:entrada,saida,diario',
            'valor' => 'sometimes|required|numeric|min:0',
            'descricao' => 'nullable|string|max:255',
        ]);

        $transacao->update($validated);

        return response()->json([
            'message' => 'Transação atualizada com sucesso.',
            'data' => $transacao
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $transacao = Transacao::findOrFail($id);
        $transacao->delete();

        return response()->json([
            'message' => 'Transação removida com sucesso.'
        ]);
    }
}