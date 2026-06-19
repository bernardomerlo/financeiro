<?php

namespace App\Http\Controllers;

use App\Models\ConfiguracaoMes;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class ResumoController extends Controller
{
    public function index(): JsonResponse
    {
        // Descobre quais meses têm pelo menos uma transação
        $mesesComTransacao = Transacao::selectRaw("TO_CHAR(data, 'YYYY-MM') as ano_mes")
            ->groupBy('ano_mes')
            ->orderBy('ano_mes')
            ->pluck('ano_mes');

        if ($mesesComTransacao->isEmpty()) {
            return response()->json([
                'meses' => [],
                'kpis' => [
                    'total_entradas'  => 0,
                    'total_saidas'    => 0,
                    'total_diario'    => 0,
                    'saldo_liquido'   => 0,
                    'media_mensal_saida' => 0,
                    'media_mensal_diario' => 0,
                    'melhor_mes'      => null,
                    'pior_mes'        => null,
                ],
                'tags' => [],
            ]);
        }

        // Carrega todas as transações de uma vez (evita N queries).
        // Usa intervalo de datas (agnóstico de banco) em vez de DATE_FORMAT/TO_CHAR no WHERE.
        $primeiroMes = $mesesComTransacao->first();
        $ultimoMes   = $mesesComTransacao->last();
        $dataMin = Carbon::parse($primeiroMes . '-01')->startOfMonth();
        $dataMax = Carbon::parse($ultimoMes . '-01')->endOfMonth();

        $todasTransacoes = Transacao::whereBetween('data', [
            $dataMin->format('Y-m-d'),
            $dataMax->format('Y-m-d'),
        ])->get();

        // Carrega configs de todos os meses relevantes
        $configs = ConfiguracaoMes::whereIn('ano_mes', $mesesComTransacao)
            ->get()
            ->keyBy('ano_mes');

        $hoje = Carbon::today();

        // ── Agrega por mês ────────────────────────────────────────────────
        $meses = [];

        foreach ($mesesComTransacao as $anoMes) {
            $txDoMes = $todasTransacoes->filter(function ($t) use ($anoMes) {
                return Carbon::parse($t->data)->format('Y-m') === $anoMes;
            });

            $entradas = (float) $txDoMes->where('tipo', 'entrada')->sum('valor');
            $saidas   = (float) $txDoMes->where('tipo', 'saida')->sum('valor');
            $diario   = (float) $txDoMes->where('tipo', 'diario')->sum('valor');

            // Saldo líquido do mês (sem projeção fantasma — só real)
            $saldoLiquidoMes = $entradas - $saidas - $diario;

            // Número de transações
            $qtdTransacoes = $txDoMes->count();

            // Maior entrada e maior saída do mês
            $maiorEntrada = (float) $txDoMes->where('tipo', 'entrada')->max('valor') ?? 0;
            $maiorSaida   = (float) $txDoMes->where('tipo', 'saida')->max('valor') ?? 0;

            // Meta configurada para o mês
            $metaDiaria = $configs->has($anoMes)
                ? (float) $configs->get($anoMes)->meta_diaria
                : 50.00;

            // Dias no mês que já passaram (para calcular % da meta atingida)
            $dataInicio  = Carbon::parse($anoMes . '-01');
            $diasNoMes   = $dataInicio->daysInMonth;
            $ePassado    = $dataInicio->copy()->endOfMonth()->lt($hoje);
            $eAtual      = $dataInicio->format('Y-m') === $hoje->format('Y-m');
            $diasDecorridos = $ePassado
                ? $diasNoMes
                : ($eAtual ? $hoje->day : 0);

            $metaAcumulada = $metaDiaria * $diasDecorridos;
            $percMeta = $metaAcumulada > 0 ? round(($diario / $metaAcumulada) * 100, 1) : null;

            $meses[] = [
                'ano_mes'           => $anoMes,
                'entradas'          => $entradas,
                'saidas'            => $saidas,
                'diario'            => $diario,
                'saldo_liquido'     => round($saldoLiquidoMes, 2),
                'maior_entrada'     => $maiorEntrada,
                'maior_saida'       => $maiorSaida,
                'qtd_transacoes'    => $qtdTransacoes,
                'meta_diaria'       => $metaDiaria,
                'meta_perc'         => $percMeta,
            ];
        }

        // ── KPIs globais ──────────────────────────────────────────────────
        $totalEntradas = collect($meses)->sum('entradas');
        $totalSaidas   = collect($meses)->sum('saidas');
        $totalDiario   = collect($meses)->sum('diario');
        $saldoLiquido  = $totalEntradas - $totalSaidas - $totalDiario;

        $qtdMeses = count($meses);
        $mediaMensalSaida   = $qtdMeses > 0 ? $totalSaidas  / $qtdMeses : 0;
        $mediaMensalDiario  = $qtdMeses > 0 ? $totalDiario  / $qtdMeses : 0;
        $mediaMensalEntrada = $qtdMeses > 0 ? $totalEntradas / $qtdMeses : 0;

        $melhorMes = collect($meses)->sortByDesc('saldo_liquido')->first();
        $piorMes   = collect($meses)->sortBy('saldo_liquido')->first();

        // ── Ranking de tags histórico (saida + diario) ────────────────────
        $tagsSoma = [];
        foreach ($todasTransacoes->whereIn('tipo', ['saida', 'diario']) as $t) {
            $tag = $t->tag ? trim($t->tag) : 'Sem Tag';
            $tagsSoma[$tag] = ($tagsSoma[$tag] ?? 0) + (float) $t->valor;
        }

        arsort($tagsSoma);
        $totalTags = array_sum($tagsSoma);

        $tags = [];
        foreach ($tagsSoma as $tag => $valor) {
            $tags[] = [
                'tag'   => $tag,
                'valor' => round($valor, 2),
                'perc'  => $totalTags > 0 ? round(($valor / $totalTags) * 100, 1) : 0,
            ];
        }

        return response()->json([
            'meses' => $meses,
            'kpis'  => [
                'total_entradas'       => round($totalEntradas, 2),
                'total_saidas'         => round($totalSaidas, 2),
                'total_diario'         => round($totalDiario, 2),
                'saldo_liquido'        => round($saldoLiquido, 2),
                'media_mensal_entrada' => round($mediaMensalEntrada, 2),
                'media_mensal_saida'   => round($mediaMensalSaida, 2),
                'media_mensal_diario'  => round($mediaMensalDiario, 2),
                'melhor_mes'           => $melhorMes ? [
                    'ano_mes'       => $melhorMes['ano_mes'],
                    'saldo_liquido' => $melhorMes['saldo_liquido'],
                ] : null,
                'pior_mes' => $piorMes ? [
                    'ano_mes'       => $piorMes['ano_mes'],
                    'saldo_liquido' => $piorMes['saldo_liquido'],
                ] : null,
            ],
            'tags' => $tags,
        ]);
    }
}