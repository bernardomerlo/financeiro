<?php

namespace App\Http\Controllers;

use App\Models\Transacao;
use App\Models\ConfiguracaoMes;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class MesController extends Controller
{
    public function show(string $ano_mes): JsonResponse
    {
        // Validar formato YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $ano_mes)) {
            return response()->json(['message' => 'Formato de mês inválido. Use YYYY-MM.'], 400);
        }

        // Procura a meta diária do mês ou assume 50.00 como padrão
        $config = ConfiguracaoMes::where('ano_mes', $ano_mes)->first();
        $metaDiaria = $config ? (float) $config->meta_diaria : 50.00;

        $dataInicio = Carbon::parse($ano_mes . '-01');
        $diasNoMes = $dataInicio->daysInMonth;
        $hoje = Carbon::today();

        // Procura todas as transações do mês agrupadas pelo número do dia
        $transacoes = Transacao::whereYear('data', $dataInicio->year)
            ->whereMonth('data', $dataInicio->month)
            ->get()
            ->groupBy(function ($transacao) {
                return Carbon::parse($transacao->data)->day;
            });

        $linhasDoMes = [];

        // Busca todo o histórico financeiro antes do dia 1 deste mês para compor o saldo inicial
        $entradasPassadas = Transacao::where('data', '<', $dataInicio)->where('tipo', 'entrada')->sum('valor');
        $saidasPassadas = Transacao::where('data', '<', $dataInicio)->where('tipo', 'saida')->sum('valor');
        $diariosPassados = Transacao::where('data', '<', $dataInicio)->where('tipo', 'diario')->sum('valor');

        $saldoAcumulado = (float) $entradasPassadas - (float) $saidasPassadas - (float) $diariosPassados;

        for ($dia = 1; $dia <= $diasNoMes; $dia++) {
            $dataLinha = Carbon::parse("$ano_mes-$dia");
            $transacoesDoDia = $transacoes->get($dia, collect());

            $entradas = (float) $transacoesDoDia->where('tipo', 'entrada')->sum('valor');
            $saidas = (float) $transacoesDoDia->where('tipo', 'saida')->sum('valor');
            $diarioReal = (float) $transacoesDoDia->where('tipo', 'diario')->sum('valor');

            $fantasma = false;
            $diario = 0.00;

            if ($dataLinha->lt($hoje)) {
                // Dias passados: usa apenas o que foi inserido manualmente. Se não inseriu, fica 0.
                $diario = $diarioReal;
            } elseif ($dataLinha->equalTo($hoje)) {
                // Dia atual: se já existir um gasto real inserido, usa-o. Caso contrário, mantém o fantasma.
                if ($diarioReal > 0) {
                    $diario = $diarioReal;
                } else {
                    $diario = $metaDiaria;
                    $fantasma = true;
                }
            } else {
                // Dias futuros: aplica sempre o gasto fantasma
                $diario = $metaDiaria;
                $fantasma = true;
            }

            // Fórmula idêntica à da sua folha de cálculo: Saldo anterior + Entradas - (Saídas + Diário)
            $saldoAcumulado = $saldoAcumulado + $entradas - ($saidas + $diario);

            $linhasDoMes[] = [
                'dia' => $dia,
                'entradas' => $entradas,
                'saidas' => $saidas,
                'diario' => $diario,
                'saldo' => round($saldoAcumulado, 2),
                'fantasma' => $fantasma
            ];
        }

        return response()->json([
            'ano_mes' => $ano_mes,
            'meta_diaria' => $metaDiaria,
            'dados' => $linhasDoMes
        ]);
    }
    public function updateMeta(\Illuminate\Http\Request $request, string $ano_mes): JsonResponse
    {
        if (!preg_match('/^\d{4}-\d{2}$/', $ano_mes)) {
            return response()->json(['message' => 'Formato de mês inválido. Use YYYY-MM.'], 400);
        }

        $validated = $request->validate([
            'meta_diaria' => 'required|numeric|min:0'
        ]);

        $config = ConfiguracaoMes::updateOrCreate(
            ['ano_mes' => $ano_mes],
            ['meta_diaria' => $validated['meta_diaria']]
        );

        return response()->json([
            'message' => 'Meta diária atualizada com sucesso.',
            'data' => $config
        ]);
    }
}