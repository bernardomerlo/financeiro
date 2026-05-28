<?php

namespace App\Http\Controllers;

use App\Models\Transacao;
use App\Models\ConfiguracaoMes;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MesController extends Controller
{
    /**
     * Helper perspicaz para calcular o N-ésimo dia útil do mês
     */
    private function calcularDiaUtil(Carbon $data, int $n)
    {
        $count = 0;
        $temp = $data->copy()->startOfMonth();
        while (true) {
            if ($temp->isWeekday()) {
                $count++;
            }
            if ($count === $n) {
                return $temp->day;
            }
            $temp->addDay();
        }
    }

    public function show(string $ano_mes): JsonResponse
    {
        // Validar formato YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $ano_mes)) {
            return response()->json(['message' => 'Formato de mês inválido. Use YYYY-MM.'], 400);
        }

        // Procura a configuração do mês. Se não existir, herda do último para manter a automação sem precisar intervir.
        $config = ConfiguracaoMes::where('ano_mes', $ano_mes)->first();

        if (!$config) {
            $ultimaConfig = ConfiguracaoMes::orderBy('ano_mes', 'desc')->first();

            if ($ultimaConfig) {
                $config = ConfiguracaoMes::create([
                    'ano_mes' => $ano_mes,
                    'meta_diaria' => $ultimaConfig->meta_diaria,
                    'dia_fechamento_fatura' => $ultimaConfig->dia_fechamento_fatura,
                    'dia_pagamento_fatura' => $ultimaConfig->dia_pagamento_fatura,
                    'dia_entrada' => $ultimaConfig->dia_entrada,
                    'valor_entrada' => $ultimaConfig->valor_entrada,
                ]);
            }
        }

        $metaDiaria = $config ? (float) $config->meta_diaria : 50.00;

        $dataInicio = Carbon::parse($ano_mes . '-01');
        $diasNoMes = $dataInicio->daysInMonth;
        $hoje = Carbon::today();

        // ------------------------------------------------------------------
        // AUTO-SEEDING DA ENTRADA AUTOMÁTICA (Mágica acontece aqui antes de consultar a base)
        // ------------------------------------------------------------------
        if ($config && $config->valor_entrada > 0 && $config->dia_entrada) {

            // Só gera automaticamente se for o mês atual ou um mês futuro.
            $mesAtualOuFuturo = $dataInicio->copy()->endOfMonth()->gte($hoje->copy()->startOfMonth());

            if ($mesAtualOuFuturo) {
                $diaAlvo = null;

                // Trata regra "5_util" vs dia fixo "5"
                if (str_ends_with($config->dia_entrada, '_util')) {
                    $n = (int) str_replace('_util', '', $config->dia_entrada);
                    $diaAlvo = $this->calcularDiaUtil($dataInicio, $n);
                } else {
                    $diaAlvo = (int) $config->dia_entrada;
                }

                if ($diaAlvo) {
                    // Verifica se JÁ existe uma entrada parecida com o salário neste mês para não duplicar
                    // withTrashed() garante que se você deletou, ele não vai recriar feito um zumbi.
                    $jaExiste = Transacao::withTrashed()
                        ->whereYear('data', $dataInicio->year)
                        ->whereMonth('data', $dataInicio->month)
                        ->where('tipo', 'entrada')
                        ->where(function ($q) use ($config) {
                            $q->where('descricao', 'like', '%Automátic%')
                                ->orWhere('valor', '>=', $config->valor_entrada * 0.8);
                        })
                        ->exists();

                    if (!$jaExiste) {
                        $dataTarget = $dataInicio->copy()->addDays($diaAlvo - 1)->format('Y-m-d');
                        Transacao::create([
                            'data' => $dataTarget,
                            'tipo' => 'entrada',
                            'valor' => $config->valor_entrada,
                            'descricao' => 'Salário (Automático)'
                        ]);
                    }
                }
            }
        }
        // ------------------------------------------------------------------

        // LÓGICA DO GASTO DIÁRIO REAL (Média Histórica)
        $gastoDiarioReal = 0.00;

        $primeiraEntrada = Transacao::where('tipo', 'entrada')->orderBy('data', 'asc')->first();
        $marcoZero = $primeiraEntrada ? $primeiraEntrada : Transacao::orderBy('data', 'asc')->first();

        if ($marcoZero) {
            $dataInicioHistorico = Carbon::parse($marcoZero->data);

            if ($dataInicioHistorico->lte($hoje)) {
                $diasCorridos = $dataInicioHistorico->diffInDays($hoje) + 1;

                $totalDiariosHistorico = Transacao::where('tipo', 'diario')
                    ->where('data', '>=', $dataInicioHistorico->format('Y-m-d'))
                    ->where('data', '<=', $hoje->format('Y-m-d'))
                    ->sum('valor');

                $gastoDiarioReal = (float) $totalDiariosHistorico / $diasCorridos;
            }
        }

        // Procura todas as transações do mês agrupadas pelo número do dia (Aqui ele já vai pegar o Salário injetado acima)
        $transacoes = Transacao::whereYear('data', $dataInicio->year)
            ->whereMonth('data', $dataInicio->month)
            ->get()
            ->groupBy(function ($transacao) {
                return Carbon::parse($transacao->data)->day;
            });

        $linhasDoMes = [];
        $ontem = $hoje->copy()->subDay();

        if ($dataInicio->gt($hoje)) {
            $entradasAteOntem = Transacao::where('data', '<=', $ontem)->where('tipo', 'entrada')->sum('valor');
            $saidasAteOntem = Transacao::where('data', '<=', $ontem)->where('tipo', 'saida')->sum('valor');
            $diariosAteOntem = Transacao::where('data', '<=', $ontem)->where('tipo', 'diario')->sum('valor');

            $saldoAcumulado = (float) $entradasAteOntem - (float) $saidasAteOntem - (float) $diariosAteOntem;

            $transacoesSim = Transacao::where('data', '>=', $hoje->format('Y-m-d'))
                ->where('data', '<', $dataInicio->format('Y-m-d'))
                ->get()
                ->groupBy(function ($t) {
                    return Carbon::parse($t->data)->format('Y-m-d');
                });

            $configuracoes = ConfiguracaoMes::all()->keyBy('ano_mes');

            $diaSim = $hoje->copy();
            while ($diaSim->lt($dataInicio)) {
                $anoMesSim = $diaSim->format('Y-m');
                $metaSim = $configuracoes->has($anoMesSim) ? (float) $configuracoes->get($anoMesSim)->meta_diaria : 50.00;

                $tDia = $transacoesSim->get($diaSim->format('Y-m-d'), collect());
                $ent = $tDia->where('tipo', 'entrada')->sum('valor');
                $sai = $tDia->where('tipo', 'saida')->sum('valor');
                $diarioRealLoop = $tDia->where('tipo', 'diario')->sum('valor');

                $diarioAplicado = 0;
                if ($diaSim->equalTo($hoje)) {
                    $diarioAplicado = ($diarioRealLoop > 0) ? $diarioRealLoop : $metaSim;
                } else {
                    $diarioAplicado = $metaSim;
                }

                $saldoAcumulado += $ent - ($sai + $diarioAplicado);
                $diaSim->addDay();
            }
        } else {
            $entradasPassadas = Transacao::where('data', '<', $dataInicio)->where('tipo', 'entrada')->sum('valor');
            $saidasPassadas = Transacao::where('data', '<', $dataInicio)->where('tipo', 'saida')->sum('valor');
            $diariosPassados = Transacao::where('data', '<', $dataInicio)->where('tipo', 'diario')->sum('valor');

            $saldoAcumulado = (float) $entradasPassadas - (float) $saidasPassadas - (float) $diariosPassados;
        }

        for ($dia = 1; $dia <= $diasNoMes; $dia++) {
            $dataLinha = Carbon::parse("$ano_mes-$dia");
            $transacoesDoDia = $transacoes->get($dia, collect());

            $entradas = (float) $transacoesDoDia->where('tipo', 'entrada')->sum('valor');
            $saidas = (float) $transacoesDoDia->where('tipo', 'saida')->sum('valor');
            $diarioRealLinha = (float) $transacoesDoDia->where('tipo', 'diario')->sum('valor');

            $fantasma = false;
            $diario = 0.00;

            if ($dataLinha->lt($hoje)) {
                $diario = $diarioRealLinha;
            } elseif ($dataLinha->equalTo($hoje)) {
                if ($diarioRealLinha > 0) {
                    $diario = $diarioRealLinha;
                } else {
                    $diario = 0;
                    $fantasma = true;
                }
            } else {
                $diario = $metaDiaria;
                $fantasma = true;
            }

            $saldoAcumulado = $saldoAcumulado + $entradas - ($saidas + $diario);

            $linhasDoMes[] = [
                'dia' => $dia,
                'entradas' => $entradas,
                'saidas' => $saidas,
                'diario' => $diario,
                'saldo' => round($saldoAcumulado, 2),
                'fantasma' => $fantasma,
                'transacoes' => $transacoesDoDia->values()->toArray()
            ];
        }

        return response()->json([
            'ano_mes' => $ano_mes,
            'meta_diaria' => $metaDiaria,
            'gasto_diario_real' => round($gastoDiarioReal, 2),
            'dia_fechamento_fatura' => $config ? $config->dia_fechamento_fatura : null,
            'dia_pagamento_fatura' => $config ? $config->dia_pagamento_fatura : null,
            'dia_entrada' => $config ? $config->dia_entrada : null,
            'valor_entrada' => $config ? (float) $config->valor_entrada : null,
            'dados' => $linhasDoMes
        ]);
    }

    public function updateConfig(Request $request, string $ano_mes): JsonResponse
    {
        if (!preg_match('/^\d{4}-\d{2}$/', $ano_mes)) {
            return response()->json(['message' => 'Formato de mês inválido. Use YYYY-MM.'], 400);
        }

        $validated = $request->validate([
            'meta_diaria' => 'sometimes|required|numeric|min:0',
            'dia_fechamento_fatura' => 'nullable|integer|min:1|max:31',
            'dia_pagamento_fatura' => 'nullable|integer|min:1|max:31',
            'dia_entrada' => 'nullable|string|max:20',
            'valor_entrada' => 'nullable|numeric|min:0',
        ]);

        $config = ConfiguracaoMes::updateOrCreate(
            ['ano_mes' => $ano_mes],
            $validated
        );

        return response()->json([
            'message' => 'Configurações atualizadas com sucesso.',
            'data' => $config
        ]);
    }
}