<?php

namespace App\Http\Controllers;

use App\Models\Transacao;
use App\Models\ConfiguracaoMes;
use Carbon\Carbon;
use Illuminate\Support\Str;
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
            'cartao' => 'sometimes|boolean',
            'parcelas' => 'required_if:cartao,true|integer|min:1',
        ]);

        // LÓGICA DE CARTÃO DE CRÉDITO
        if (isset($validated['cartao']) && $validated['cartao'] && $validated['tipo'] === 'saida') {
            $dataCompra = Carbon::parse($validated['data']);
            $anoMesCompra = $dataCompra->format('Y-m');
            $diaCompra = $dataCompra->day;

            $config = ConfiguracaoMes::where('ano_mes', $anoMesCompra)->first();
            if (!$config) {
                $config = ConfiguracaoMes::orderBy('ano_mes', 'desc')->first();
            }

            if (!$config || !$config->dia_fechamento_fatura || !$config->dia_pagamento_fatura) {
                return response()->json([
                    'message' => 'Configure os dias de fechamento e pagamento da fatura primeiro na tela de Configurações.'
                ], 400);
            }

            $diaFechamento = $config->dia_fechamento_fatura;
            $diaPagamento = $config->dia_pagamento_fatura;
            $parcelas = $validated['parcelas'];
            $valorParcela = $validated['valor'];

            $mesFaturaTarget = $dataCompra->copy()->startOfMonth();

            if ($diaCompra >= $diaFechamento) {
                $mesFaturaTarget->addMonth();
            }

            $transacoesCriadas = [];
            // Gera um ID único para amarrar todas as parcelas
            $grupoId = Str::uuid()->toString();

            for ($i = 1; $i <= $parcelas; $i++) {
                $diaRealPagamento = min($diaPagamento, $mesFaturaTarget->daysInMonth);
                $dataPagamento = $mesFaturaTarget->copy()->setDay($diaRealPagamento);

                $descricaoFinal = $validated['descricao'] ?? 'Compra Cartão';
                if ($parcelas > 1) {
                    $descricaoFinal .= " ($i/$parcelas)";
                }

                $transacoesCriadas[] = Transacao::create([
                    'grupo_id' => $grupoId,
                    'data' => $dataPagamento->format('Y-m-d'),
                    'tipo' => 'saida',
                    'valor' => $valorParcela,
                    'descricao' => $descricaoFinal
                ]);

                $mesFaturaTarget->addMonth();
            }

            return response()->json([
                'message' => "Registrado com sucesso em $parcelas parcela(s) na fatura.",
                'data' => $transacoesCriadas[0]
            ], 201);
        }

        // FLUXO NORMAL
        unset($validated['cartao'], $validated['parcelas']);
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

        if ($transacao->grupo_id) {
            // Se for do cartão de crédito, atualiza todas as transações do grupo
            $grupo = Transacao::where('grupo_id', $transacao->grupo_id)->orderBy('data')->get();

            // Remove o sufixo " (1/3)" da descrição digitada pelo usuário para reconstruir depois
            $descricaoBase = preg_replace('/\s*\(\d+\/\d+\)$/', '', $validated['descricao'] ?? $transacao->descricao);

            $total = $grupo->count();
            $i = 1;

            foreach ($grupo as $item) {
                $novaDescricao = $total > 1 ? "{$descricaoBase} ({$i}/{$total})" : $descricaoBase;

                $item->update([
                    'valor' => $validated['valor'] ?? $item->valor,
                    'descricao' => $novaDescricao,
                    'tipo' => $validated['tipo'] ?? $item->tipo,
                ]);

                // Só altera a data da transação exata que o usuário clicou (para não encavalar as faturas de outros meses)
                if ($item->id === $transacao->id && isset($validated['data'])) {
                    $item->update(['data' => $validated['data']]);
                }

                $i++;
            }
        } else {
            // Transação normal, apenas atualiza ela
            $transacao->update($validated);
        }

        return response()->json([
            'message' => 'Transação(ões) atualizada(s) com sucesso.',
            'data' => Transacao::find($id)
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $transacao = Transacao::findOrFail($id);

        if ($transacao->grupo_id) {
            // Se for do cartão de crédito, exclui o grupo inteiro
            Transacao::where('grupo_id', $transacao->grupo_id)->delete();
        } else {
            $transacao->delete();
        }

        return response()->json([
            'message' => 'Removido com sucesso.'
        ]);
    }
}