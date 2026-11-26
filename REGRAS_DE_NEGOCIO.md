# Regras de Negócio — Sistema Financeiro (CashFlow)

> **Instrução Permanente para o Agente:**
> Este arquivo é a fonte oficial da verdade sobre as regras de negócio do sistema.
> 1. **Sempre consulte este arquivo** antes de implementar qualquer alteração ou nova funcionalidade.
> 2. **Sempre salve aqui** toda nova informação ou decisão de regra de negócio fornecida pelo usuário.
> 3. **Caso qualquer requisito ou impacto fique ambíguo, pergunte ao usuário** antes de assumir um comportamento.

---

## 1. Navegação e Seleção de Data
- **RN-01 (Data definida pelo clique na tabela):** O modal de lançamento/transações do dia **não deve conter seletores de data** (nem campo `<input type="date">`, nem botões de atalho como `Hoje`, `Amanhã`, `Fim Mês`).
- **RN-02 (Troca de data e abertura do modal):** O usuário escolhe a data clicando diretamente na linha/célula da data desejada na tabela principal. Se quiser operar em outra data, ele fecha o modal e clica na outra data na tabela. Não deve haver botões genéricos de `Simular` e `Lançar` no cabeçalho superior direito da tela.

## 2. Lançamentos e Transações do Dia (Saída, Diário, Entrada)
- **RN-03 (Sem "Definir valor/total do dia"):** Não existe a funcionalidade de "Definir Total do Dia" nem "Somar ao Diário" como um valor único sobrescrito (`daily_override`).
- **RN-04 (Transações individuais um a um):** Todos os lançamentos do dia — inclusive os do tipo **Diário** (`expense_daily`) — são adicionados **um a um como transações individuais** na tabela `transactions`. Cada transação pode ser editada ou excluída individualmente.
- **RN-05 (Propriedades de uma transação do tipo Diário):** Cada transação individual do tipo **Diário** possui **Valor, Descrição e Categoria** (mesmas propriedades de uma Saída à vista, sem opção de parcelamento no cartão de crédito).
- **RN-06 (Comportamento da coluna Diário e Meta Diária):**
  - O valor da coluna **Diário** de um dia é a **soma das transações individuais do tipo Diário** lançadas naquele dia.
  - Em **dias passados ou hoje** sem transações do tipo Diário lançadas, o valor da coluna Diário é `R$ 0,00`.
  - Em **dias futuros** que ainda não possuem nenhuma transação do tipo Diário lançada, o sistema projeta automaticamente o valor da **Meta Diária** (configurada em Configurações) para efeito de projeção de saldo. Assim que o usuário lançar transações do tipo Diário naquele dia futuro, o valor passa a ser a soma das transações lançadas.
  - Os valores históricos importados da planilha original para a coluna Diário são armazenados como transações individuais do tipo `Diário` (`expense_daily`), podendo ser editados ou excluídos normalmente.

## 3. Edição de Transações e Feedback Visual
- **RN-07 (Edição Inline no próprio card clicado):** Ao clicar em **Editar** em uma transação na lista do dia, **o próprio card da transação se transforma inline nos campos editáveis** (Tipo: `Saída` / `Diário` / `Entrada`, Valor, Descrição, Categoria e botões **Salvar** e **Cancelar** ali mesmo), com forte destaque visual indicando que aquele item está em edição.

---

## 4. Regras Gerais do Fluxo de Caixa (Referência)
- **RN-08 (Faixas de Liquidez do Saldo):**
  - `> R$ 3.000`: Excelente (Verde escuro)
  - `R$ 2.000 a R$ 3.000`: Seguro (Verde claro)
  - `R$ 1.500 a R$ 1.999,99`: Atenção (Amarelo)
  - `R$ 1.000 a R$ 1.499,99`: Crítico (Laranja)
  - `< R$ 1.000`: Perigo (Vermelho)
- **RN-09 (Cartão de Crédito):** Aplicável apenas a transações do tipo **Saída** (`expense_fixed`). Compras no cartão respeitam o dia de fechamento e o dia de vencimento configurados (compras até o dia de fechamento caem no vencimento do ciclo atual; após o fechamento, deslocam para o próximo mês).
