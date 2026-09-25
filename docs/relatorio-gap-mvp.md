# Relatório visual e de UX: Mimo Solo e Mimo Duo

> **Escopo:** protótipo navegável. Backend, autenticação, segurança e infraestrutura estão **fora** deste relatório de propósito. O foco é o que a pessoa vê e sente: telas, gráficos, coerência dos números e fluxos.
> **Data:** 25/09/2026 · Base: `main` com as mudanças locais desta rodada.
> **Referências de mercado** (Mobills, Organizze, YNAB, Monarch, Copilot e Rocket Money para o Solo; Honeydue, Zeta, Splitwise, Tricount e YNAB Together para o Duo) vêm de conhecimento consolidado, **não verificado na web** nesta auditoria. Itens com `(?)` têm confiança menor.
> Citações no formato `caminho:linha`, relativas a `src/`.

---

## 1. Sumário executivo

O visual do Mimo já tem nível de produto: mascote contextual, tema claro/escuro com transição, modo privado e estados de vazio, erro, loading e sucesso desenhados em quase todas as telas. O que ainda quebra a ilusão do protótipo é **coerência**. Algumas telas mostram números reais das movimentações e outras mostram números fixos, então o mesmo dado aparece com valores diferentes conforme a página.

| Produto | Nota visual/UX (0–10) | Resumo |
|---|---|---|
| **Solo** | **7,5** (era 5,5 antes desta rodada) | Os gráficos e números da Visão geral, de Categorias, do painel lateral e do sino agora saem dos mesmos dados. O que falta é refinamento: projeção de saldo, comparativo mês a mês e calendário de vencimentos. |
| **Duo** | **5** | Movimentações e LIMITE são reais. A Visão do casal, a Divisão, o Lazer e as notificações ainda usam números fixos que **contradizem** a lista de movimentações e o topo. |

**Top 5 gaps visuais/UX restantes:**
1. **Duo:** a Visão do casal e a Divisão não refletem o que o casal lança (`pages/DuoMetas.tsx:197`, `:847`, `:866`, `:405-406`).
2. **Duo:** as notificações dizem "Limite do mês estourado (R$ 6.212 de R$ 6.000)" enquanto o topo mostra LIMITE 82% (`lib/notificacoes.ts:22`).
3. **Metas:** "Evolução" e "Linha do tempo de aportes" desenham um histórico fixo, igual para qualquer meta (`pages/DuoMetas.tsx:89`, `MENSAL`).
4. **Solo:** "sobra R$ 5.295" (saldo menos pendências) e "sobraram R$ 1.485" (resultado do mês) aparecem lado a lado com a mesma palavra e significados diferentes (`components/ViewGeral.tsx:96`, `:105`).
5. **Mobile:** Metas, Investimentos e Configurações somem do dock no celular. A única saída é o avatar (`styles/mimo-telas.css:135-137`).

---

## 2. Auditoria dos gráficos: dado de verdade ou só enfeite?

Legenda:
- ✅ **Dado real:** calculado das movimentações ou dos ajustes salvos.
- ⚠️ **Real com ressalva:** o cálculo é real, mas o recorte ou o rótulo engana.
- 🎭 **Decorativo/mock:** números fixos no código, que não mudam com o uso.
- ➕ **Informação a mais:** real, mas de pouco valor para decidir.

### Solo

| Gráfico / indicador | Tela | Fonte | Veredito | Observação |
|---|---|---|---|---|
| Saldo disponível + variação vs mês anterior | Visão geral | `lib/derive.ts` (`saldo`, `variacao`) | ✅ | Saldo acumulado até o fim do mês em foco. |
| "sobra R$ X · Depois das pendências" + trilho | Visão geral | `saldo - aPagar` | ⚠️ | O número é real, mas "sobra" colide com "sobraram R$ Y no mês" logo abaixo. Sugestão: "Livre após contas: R$ X". |
| Sparkline diária | Visão geral | `derive.ts` (`porDia`) | ⚠️ | Real, mas soma entradas e saídas numa barra só. O salário do dia 5 achata o resto. Sugestão: mostrar só saídas, ou barras divergentes (entrada para cima, saída para baixo). |
| Entradas / Saídas / **A pagar** | Visão geral | `derive.ts` | ✅ | "A pagar" substituiu "Movimentações", que já aparecia na frase acima. |
| **Cartão Mimo = Fatura do mês** | Visão geral | `derive.ts` (`fatura`, `faturaItens`, `faturaVence`) | ✅ **(novo)** | Antes era "Total a pagar", que duplicava o painel lateral. Agora mostra a fatura do cartão, com parcelas e vencimento. |
| Fluxo dos últimos 12 meses | Visão geral | `components/charts/FlowChart.tsx` + `serieMeses` | ⚠️ | Real, mas com 4 meses de dados o gráfico mostra 8 meses vazios. Sugestão: começar no primeiro mês com dados (mínimo 6). |
| Rosca "Para onde o dinheiro vai" | Visão geral | `components/charts/DonutChart.tsx` | ✅ **(corrigido)** | Antes mostrava só as 5 maiores categorias, enquanto o centro somava todas. Agora as demais entram numa fatia "Demais" e a rosca fecha 100%. |
| Barras de categoria (legenda) | Visão geral | `derive.ts` | ✅ | O valor fica em vermelho quando passa do orçamento. |
| KPIs: Gasto médio / Maior saída / Taxa de sobra / Total a pagar | Categorias | `derive.ts` | ➕ / ✅ | "Gasto médio por lançamento" ajuda pouco a decidir. Trocar por "vs mês anterior" (▲▼ por categoria). |
| **Saídas por categoria × orçamento** | Categorias | `derive.ts` + `lib/ajustes.ts` | ✅ **(novo)** | Bullet bar com marca de orçamento, % usado, resumo "Orçado / Gasto / N acima" e edição inline. |
| Limite mensal (painel lateral e LIMITE no topo) | Drawer / Topbar | `derive.ts` com `ajustes.limite` | ✅ **(corrigido)** | Antes era fixo em R$ 2.000 (`lib/constants.ts:18`). Agora segue Configurações > Finanças. |
| Regra 50/30/20 | Drawer | `derive.ts` (`regra`) | ⚠️ | Real, mas "Futuro" inclui qualquer saída fora de Essenciais/Desejos (ex.: Educação) somada à sobra do mês. Ganhou a marca do alvo (50/30/20) em cada barra. Falta explicar a classificação num tooltip. |
| Contas em aberto com prazo | Drawer | `derive.ts` + `helpers.ts` (`prazoDe`) | ✅ **(novo)** | "vence amanhã", "venceu há 34 dias", com cor por urgência. |
| Renda comprometida + "Gasto em {mês}" | Configurações > Finanças | `ajustes` + `app.derivado.saidas` | ✅ **(corrigido)** | Antes o gasto era fixo em R$ 4.212 e o mês era "setembro" escrito no código. |
| Sino (notificações) | Todas | `lib/notificacoes.ts` (`sincronizarAvisosSolo`) | ✅ **(corrigido)** | Os avisos nascem dos dados: contas vencendo ou atrasadas, 80%/100% do limite, orçamentos estourados e fatura. "Marcar como paga" marca de fato a movimentação. |

### Metas (Solo e Duo)

| Gráfico | Fonte | Veredito | Observação |
|---|---|---|---|
| Barra de progresso (lista e detalhe) | `METAS_*` + aportes salvos | ✅/🎭 | A base de cada meta de exemplo é fixa, mas os aportes somam de verdade e agora ficam salvos em qualquer meta. |
| "No ritmo atual… vocês chegam em {mês}" | `m.ritmo` fixo | 🎭 | O ritmo não vem dos aportes. O mês de partida é setembro de 2026 fixo (`mesLabel`, `DuoMetas.tsx:223`). |
| Rosca "Divisão do alvo" por prioridade | `ITENS` | 🎭 | Só faz sentido na meta "casa". **A página agora é bloqueada para metas sem itens** (antes a Viagem ao Japão mostrava geladeira e sofá). |
| Evolução real + projeção + meta | `MENSAL` + `m.ritmo` | 🎭 | A linha "real" é o mesmo histórico para qualquer meta. **A escala do eixo agora segue o alvo** (antes era fixa em 26 mil, e a linha da meta de R$ 45 mil saía do gráfico). As fontes do SVG ficam grandes demais em telas largas. |
| Linha do tempo de aportes | `MENSAL` | 🎭 | Não usa o histórico de aportes da própria meta. |
| Sparkline de preço do catálogo | `sel.preco × fatores fixos` | 🎭 | Série inventada a partir da variação do mês. |

### Duo

| Gráfico / indicador | Tela | Fonte | Veredito | Observação |
|---|---|---|---|---|
| Lista de movimentações + filtro por autor | `/duo/movimentacoes` | `useMimoApp(MOTOR_DUO)` | ✅ | É o único lugar do Duo onde os lançamentos aparecem. |
| LIMITE no topo e painel lateral | Moldura | `derive.ts` com `ajustes.duo.limite` | ✅ **(corrigido)** | Mostrava 247% (gastos do casal contra o limite Solo de R$ 2.000). Agora mostra 82% de R$ 6.000. |
| Saldo da conta conjunta | `/duo` | `2088.35 + cIn - cOut` sobre `MOVS` | 🎭 | Base fixa e lista fixa (`DuoMetas.tsx:847`). |
| "Os dois depositaram R$ 2.600" | `/duo` | texto fixo | 🎭 | `DuoMetas.tsx:851`. |
| Cards Você/Suelen (Entrou, Gastou, Na conjunta) | `/duo` | `MOVS` + `+132,60` e `2600` fixos | 🎭 | `DuoMetas.tsx:865-866`. |
| Barra "Divisão de despesas" | `/duo` e `/duo/divisao` | `MOVS` com `div: true` | 🎭 | Lançar pelo formulário não afeta a divisão. |
| Regra proporcional à renda | `/duo/divisao` | `6200 / 11600` | 🎭 | Não usa a renda salva em Configurações (`DuoMetas.tsx:217`). |
| Lazer do casal | `/duo` | `lg = 214`, `ls = 306` | 🎭 | Os lançamentos de Lazer somam R$ 94 (Gustavo) e R$ 186 (Suelen). "Restam … para os próximos 6 dias" é texto fixo. |
| Notificações Duo | Sino | `notifsBase(true)` | 🎭 | Contradiz o topo (ver a seção 3). |
| Alocação da carteira | `/investimentos` | `ATIVOS` + cotações `COT` | 🎭 | O cálculo é real sobre uma carteira fixa. Serve como protótipo. |

---

## 3. Harmonia entre Solo e Duo

Comparação das mesmas informações nos dois produtos. **✔ ok**, **✱ corrigido nesta rodada**, **✖ pendente**.

| Informação | Solo | Duo | Status |
|---|---|---|---|
| Nome do usuário | Topbar "Vitor Gomes" × Config "Gustavo Martins" | "Gustavo e Suelen" | ✱ Solo: uma fonte só (`lib/ajustes.ts`), editada em Perfil. ✖ No onboarding ainda há "Gustavo Andrade" e outros e-mails (`pages/FluxoAcesso.tsx:15`, `:586`). |
| Limite mensal | Painel R$ 2.000 × Config R$ 4.000 | Topo usava R$ 2.000 × Config R$ 6.000 | ✱ Os dois leem `ajustes.{solo,duo}.limite`. |
| Gasto do mês em Finanças | R$ 4.212 fixo | R$ 6.212 fixo | ✱ Gasto real do mês. |
| Renda | Onboarding descarta; Config R$ 6.200; exemplos com salário de R$ 3.200 | Config R$ 6.200 + Suelen R$ 5.400; Divisão usa 6200/11600 fixo | ✱ Solo passa a R$ 3.200, igual aos exemplos. ✖ A Divisão do Duo não lê a renda salva. ✖ Se Solo e Duo são a mesma pessoa, R$ 3.200 × R$ 6.200 destoa (decidir se a persona do Solo é outra). |
| Categorias | Form: Moradia, Salário…; Config: Casa, Renda… | `MOVS`: Casa, Renda, Presentes; motor mapeia para Moradia/Salário/Outros | ✱ Config usa a lista do formulário e as categorias próprias entram no formulário. ✖ A Visão do casal ainda mostra "Casa"/"Renda" (`MOVS`). |
| Cor de cada categoria | Mudava conforme o ranking do mês | idem | ✱ Cor fixa por categoria, a mesma de Configurações (`lib/ajustes.ts`, `CORES_CAT`). |
| Mês de referência | Mês atual do relógio | "setembro de 2026" fixo em cabeçalhos e textos (`DuoMetas.tsx:115`, `:845`, `:964`) | ✖ Em outubro o Duo "mente". |
| Notificações | Fixas ("Conta de luz vence amanhã", "4.212 de 4.000") | Fixas ("6.212 de 6.000") | ✱ Solo gerado dos dados. ✖ Duo continua fixo e contradiz o LIMITE de 82%. |
| Cartão / fatura | Não existia | Não existe | ✱ Solo. ✖ Duo: falta "cartão de quem" e fatura compartilhada. |
| Parcelas e recorrência | Lançamentos soltos "Nome (2/10)" | idem (mesmo formulário) | ✱ Nos dois, porque o formulário é o mesmo: parcela agrupada (tag 2/10), "Repete todo mês" (12 meses) e "Pago com". |
| Metas salvas | Só em memória; aporte só na "casa" | idem | ✱ Metas criadas e aportes (em qualquer meta) salvos por conta. O prazo escolhido passa a valer. |
| Linguagem | "Você" | "Vocês" / "você e Suelen" | ✔ Consistente. |
| Mascote | 1 gato verde | 2 gatos (verde e âmbar rajado) | ✔ Coerente e charmoso. |
| Estrutura visual | Classes CSS legadas | `style={{}}` inline nas telas portadas | ✖ Diferenças sutis de raio, sombra e tipografia entre a Visão geral Solo e a Visão do casal. |

---

## 4. O que foi corrigido nesta rodada (pontos 2 a 5 do Solo)

Tudo continua sendo protótipo: os dados ficam no navegador (`localStorage`), sem backend.

| # | Ponto | O que mudou | Arquivos |
|---|---|---|---|
| 2 | **Configurações sem efeito** | Nova fonte única `lib/ajustes.ts` (por conta) com nome, e-mail, avatar, renda, limite, categorias próprias, orçamentos e cartão. Perfil, Finanças e Categorias salvam nela. Topo, painel lateral, LIMITE, formulário e notificações leem dela. | `lib/ajustes.ts` (novo), `pages/Configuracoes.tsx`, `hooks/useMimoApp.ts`, `lib/derive.ts`, `App.tsx`, `components/Moldura.tsx` |
| 3 | **Contas, cartão e fatura; parcelas soltas** | Campo "Pago com: Débito/Pix · Cartão de crédito". O Cartão Mimo virou a **fatura do mês**, com número de compras, parceladas, vencimento e lista no verso. Parcelas agora têm `grupo` e `parcela {n,total}`: a tag "2/5" substitui o sufixo no nome e, no cartão, cada parcela entra na fatura do mês dela. O CSV ganhou as colunas "Pago com" e "Parcela". | `types.ts`, `components/ModalForm.tsx`, `components/ViewGeral.tsx`, `components/TagsMovimentacao.tsx` (novo), `lib/csv.ts` |
| 4 | **Recorrência, vencimento, orçamento, notificações** | "Repete todo mês" cria 12 meses (os futuros ficam pendentes, com tag "Mensal"). Pendências mostram o prazo com cor por urgência. Orçamento por categoria com bullet bar, marca de limite, resumo e edição inline em Categorias. O sino Solo é gerado dos dados e "Marcar como paga" altera a movimentação. | `helpers.ts` (`prazoDe`), `components/Drawer.tsx`, `components/ViewCategorias.tsx`, `lib/notificacoes.ts`, `components/PainelNotificacoes.tsx` |
| 5 | **Metas não salvas; aporte só na "casa"** | Metas criadas e aportes salvos por conta (`mimo.metas.{solo,duo}.v1`), exceto nos estados de protótipo `?estado=`. Aporte funciona em qualquer meta e aparece no histórico dela. O prazo escolhido é salvo e o ritmo é calculado do que falta. O gráfico de evolução escala pelo alvo. "Por prioridade" só abre para metas com itens. | `pages/DuoMetas.tsx` |
| + | Ajustes de gráfico | Rosca fecha 100% (fatia "Demais"). Cor fixa por categoria. Regra 50/30/20 com marca do alvo. | `components/charts/DonutChart.tsx`, `components/Drawer.tsx` |

**Dados de exemplo do Solo:** a chave subiu para `mimo.itens.v3`. Quem já usava volta ao exemplo novo, que agora tem compras no cartão, um fone parcelado em 5×, aluguel/internet/streaming recorrentes, uma conta de luz vencendo em 2 dias e um curso atrasado. Isso deixa todos os estados novos visíveis na primeira abertura.

**Verificação:**
- `tsc -b --force` passou sem erros. O `oxlint` não acusou avisos novos: os avisos que aparecem são de `FluxoAcesso.tsx` e `ViewLista.tsx` e já existiam.
- Conferi três telas por captura em Chrome headless: `/`, `/ajustes/financas` e `/metas/japao/prioridade`. A extensão do Chrome não estava conectada, então os cliques não foram exercitados visualmente: salvar um orçamento inline, lançar no cartão, marcar pelo sino. O código dessas ações passou na checagem de tipos, mas vale uma passada manual.

---

## 5. Página a página: SOLO

| Tela | Está bom | Falta (visual/UX) | Referência |
|---|---|---|---|
| **Visão geral** `/` | Hero com saldo, variação, sparkline e mascote que reage ao resultado. Fatura no cartão. Fluxo de 12 meses e rosca. | 1) Renomear "sobra" (ver a seção 1). 2) **Projeção do saldo até o fim do mês** (linha real → tracejada com pendentes e recorrentes). 3) Recentes clicáveis (abrir edição). 4) Fluxo começando no primeiro mês com dados. 5) Sparkline de saídas. | Copilot (projeção), Monarch (cash flow), Mobills (cartões no topo) |
| **Movimentações** | Busca, filtros, agrupamento por mês, totais, paginação, tags de cartão/parcela/mensal. | 1) Filtro por categoria e por "Cartão". 2) Ações em lote (marcar pagas). 3) "Desfazer" no toast de exclusão. 4) Editar uma parcela e perguntar "aplicar às próximas?". 5) Lista no celular: a descrição com tags quebra em 2–3 linhas, então compactar. | Organizze (filtros), YNAB (bulk edit) |
| **Categorias** | KPIs, orçamento × gasto com edição inline. | 1) **Comparativo com o mês anterior** (▲▼ por categoria). 2) Trocar "Gasto médio" por "Maior aumento". 3) Clicar na categoria abre a lista filtrada. 4) Estado vazio próprio (hoje só some a lista). | Mobills (orçamentos), Monarch (budget vs actual) |
| **Painel lateral** | Limite real, 50/30/20 com alvo, contas com prazo. | 1) Tooltip explicando o que entra em cada balde. 2) "Marcar como paga" direto na linha (hoje abre a edição). 3) Fatura do cartão como um item. | Organizze (contas a pagar) |
| **Metas** | Cards, detalhe, aporte com prévia e marcos 25/50/75/100 com confete. | 1) Ritmo e "Evolução" calculados dos aportes reais. 2) Editar e arquivar metas. 3) "Linha do tempo" por meta. 4) Diminuir as fontes do SVG de evolução. | YNAB Targets, Monarch Goals |
| **Configurações** | Perfil, Finanças e Categorias agora salvam de verdade. Aparência persiste. | 1) Preferências de notificação e "abrir oculto" ainda não surtem efeito. 2) Cartão: editar dias de fechamento/vencimento (o dado já existe em `ajustes.cartao`). 3) Permitir editar os orçamentos também em Configurações. | – |
| **Onboarding** `/acesso/*` | Fluxo completo com estados. | Renda e nome digitados não vão para `ajustes`. A prévia de "renda comprometida" usa um gasto fixo de R$ 2.000 (`FluxoAcesso.tsx:280`). `/selecao-conta` duplica `/acesso/plano` e não salva a escolha. | – |

**Tabela vs mercado (Solo, visual/UX):**

| Recurso | Mimo | Mobills | Organizze | YNAB | Monarch | Copilot |
|---|---|---|---|---|---|---|
| Dashboard com saldo e fluxo | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Fatura do cartão visível | ✅ novo | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Parcelas agrupadas | ✅ novo | ✅ | ✅ | ❌ | ⚠️ (?) | ⚠️ (?) |
| Recorrências | ✅ novo (12 meses) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Orçamento por categoria | ✅ novo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alertas gerados dos dados | ✅ novo | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Projeção de saldo | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ |
| Comparativo mês a mês | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calendário de vencimentos | ❌ | ✅ | ✅ | ❌ | ✅ | ⚠️ (?) |
| Personalidade/mascote | ✅✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ |

---

## 6. Página a página: DUO

| Tela | Está bom | Falta (visual/UX) | Referência |
|---|---|---|---|
| **Visão do casal** `/duo` | Composição forte: saldo da conjunta, dois gatos, cards por pessoa, divisão, lazer, últimas. | **P0 de coerência:** ligar tudo ao motor Duo (`app.state.itens`) em vez de `MOVS`. O saldo e os "depositaram R$ 2.600" viram cálculo. Lazer = soma da categoria Lazer por pessoa. Mês dinâmico. Depois: gráfico "quem gastou o quê por mês" (barras empilhadas por pessoa). | Honeydue, Zeta |
| **Movimentações** | Reusa a lista Solo com a coluna "Quem" e o filtro por autor. Herdou cartão, parcelas e recorrência. | Mostrar no formulário as opções **privado/compartilhado** e **dividir**. O modal com essas opções existe (`DuoMetas.tsx:613-690`), mas nenhum botão o abre (`:412`). É a feature mais "Duo" e está invisível. | Honeydue (privado), Splitwise |
| **Divisão** | Excelente metáfora visual (gatos + seta + "parte justa" na barra). | Ler as despesas marcadas "dividir" do motor. A regra proporcional deve usar a renda salva. Mostrar o histórico de acertos (lista ou linha do tempo). Oferecer "Desfazer" no acerto. | Splitwise, Tricount |
| **Lazer do casal** | Modal de limite com proposta e "Aguardando Suelen". | Valores reais. Contador de dias real. | Zeta (?) |
| **Metas do casal** | Barras bicolores por pessoa, aporte "quem está aportando". | Igual ao Solo, mais "contribuição por pessoa" em barra 100% na lista de metas. | YNAB Together (?) |
| **Notificações** | Estrutura e estados ok. | Gerar dos dados do Duo, como no Solo (o gerador `sincronizarAvisosSolo` pode ser generalizado). Hoje afirma que o limite estourou quando o topo mostra 82%. | – |

**Tabela vs mercado (Duo, visual/UX):**

| Recurso | Mimo | Honeydue | Zeta | Splitwise | Tricount | YNAB Together |
|---|---|---|---|---|---|---|
| Visão consolidada do casal | ⚠️ (mock) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Quem pagou / quem deve | ⚠️ (mock) | ⚠️ | ✅ | ✅ | ✅ | ❌ |
| Lançamento privado vs compartilhado | ❌ (oculto) | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| Regra proporcional à renda | ⚠️ (fixa) | ❌ (?) | ✅ (?) | ⚠️ | ⚠️ | ❌ |
| Metas conjuntas com contribuição por pessoa | ✅ | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| Limite compartilhado com aprovação | ⚠️ (mock) | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ |
| Histórico de acertos | ❌ | ❌ | ⚠️ | ✅ | ✅ | ❌ |
| Identidade visual do casal | ✅✅ (dois gatos) | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |

---

## 7. Visualizações que faltam

| # | Visualização | Tipo | Onde | Produto | Prioridade |
|---|---|---|---|---|---|
| 1 | Projeção de saldo até o fim do mês | Linha real → tracejada (pendentes + recorrentes, que agora existem) | Visão geral, abaixo do hero | Solo + Duo | **P0** |
| 2 | Comparativo mês a mês por categoria | Delta ▲▼ na linha da categoria ou barras pareadas | Categorias | Solo + Duo | **P0** |
| 3 | Quem gastou o quê ao longo do tempo | Barras empilhadas Você/Parceira/Conjunta por mês | Visão do casal | Duo | **P0** |
| 4 | Calendário de vencimentos | Grade do mês com pontos (pago/pendente/atrasado); o verso do cartão ou uma aba "Contas" | Visão geral ou painel | Solo + Duo | P1 |
| 5 | Faturas futuras | Mini barras das próximas 6 faturas (parcelas e recorrentes no cartão) | Verso do Cartão Mimo | Solo | P1 |
| 6 | % da renda comprometida | Gauge com faixas 50/80/100 | Topo (junto do LIMITE) | Solo + Duo | P1 |
| 7 | Evolução da meta com aportes reais | A linha existente, alimentada pelo histórico da meta | Detalhe da meta | Solo + Duo | P1 |
| 8 | Saldo da divisão no tempo | Linha com eventos de acerto | Divisão | Duo | P2 |
| 9 | Heatmap anual de gastos | Calendário heatmap | Categorias | Solo | P2 |
| 10 | Sankey renda → categorias → sobra | Sankey | Relatório mensal | Solo + Duo | P2 |

Padronização: o painel usa Chart.js e as telas portadas usam SVG à mão. Para o protótipo, basta alinhar tokens (fontes, cores de grade, tooltip) entre os dois. As fontes do SVG de evolução hoje crescem com a largura da tela.

---

## 8. Gaps de UX (priorizados, só visual e interação)

| Prioridade | Gap | Evidência | Recomendação |
|---|---|---|---|
| P0 | Números do Duo contradizem a lista e o topo. | Seções 2 e 3 | Ligar a Visão do casal, a Divisão, o Lazer e as notificações ao motor Duo. |
| P0 | Privado/compartilhado e "dividir" estão invisíveis no Duo. | `DuoMetas.tsx:412` | Levar esses campos para o `ModalForm` quando `autores` existir. |
| P0 | "sobra" com dois sentidos no hero Solo. | `ViewGeral.tsx:96`, `:105` | "Livre após contas" + "Resultado do mês". |
| P0 | Metas, Investimentos e Configurações somem do dock mobile. | `styles/mimo-telas.css:135-137` | Aba "Mais" (bottom sheet) ou Metas fixa no dock. |
| P1 | Datas fixas em setembro de 2026 no Duo e nas Metas. | `DuoMetas.tsx:115`, `:223`, `:340`, `:845` | Usar `MES_REF`/`HOJE_ISO` de `lib/helpers.ts`. |
| P1 | Recentes não clicáveis. | `ViewGeral.tsx:30-41` | Clique abre a edição. |
| P1 | Sem "Desfazer" em exclusão e acerto. | `useMimoApp.ts` (`confirmarExclusao`), `DuoMetas.tsx` (`acertar`) | Toast com ação por ~5 s. |
| P1 | Modais sem foco inicial, focus trap e retorno de foco. | `ModalForm.tsx`, `PainelNotificacoes.tsx` | Primitivo de diálogo acessível. |
| P1 | Preferências de notificação e "abrir oculto" não surtem efeito. | `Configuracoes.tsx` (`prefs`) | Ligar a `ajustes` (mesmo padrão de Finanças). |
| P1 | O onboarding descarta nome e renda. | `FluxoAcesso.tsx:280` | Salvar em `ajustes` ao concluir. |
| P2 | Loading artificial (skeleton de 750 ms, envio de 1,3 s) em toda abertura. | `DuoMetas.tsx:300-303`, `:380` | Mostrar só no primeiro acesso da sessão. |
| P2 | Preloader fixo de 1,15 s em `/`. | `Preloader.tsx:9-10` | Só na primeira carga. |
| P2 | Três estilos convivendo (CSS legado, inline e Tailwind). | `pages/*.tsx` | Extrair tokens de raio, sombra e tipografia comuns. |
| P2 | Valor sem máscara monetária. | `ModalForm.tsx` | Máscara BRL. |

**Preservar:** o mascote contextual, estados vazios com personalidade, mensagens de erro humanas, `prefers-reduced-motion`, modo privado e a transição circular do tema.

---

## 9. Roteiro visual/UX para o protótipo "refinado"

| Prioridade | Item | Produto | Esforço |
|---|---|---|---|
| P0 | Visão do casal, Divisão e Lazer sobre o motor Duo (fim dos números fixos) | Duo | M |
| P0 | Notificações Duo geradas dos dados (generalizar `sincronizarAvisosSolo`) | Duo | S |
| P0 | Privado/compartilhado e dividir no formulário Duo | Duo | S |
| P0 | Hero Solo: rótulos "Livre após contas" e "Resultado do mês" | Solo | S |
| P0 | Dock mobile com acesso a Metas | Comum | S |
| P0 | Projeção de saldo e comparativo mês a mês | Solo + Duo | M |
| P1 | Datas dinâmicas no Duo e nas Metas | Duo + Metas | S |
| P1 | Evolução e linha do tempo da meta a partir dos aportes reais | Metas | M |
| P1 | Calendário de vencimentos e faturas futuras | Solo | M |
| P1 | Recentes clicáveis, "Desfazer" e acessibilidade dos modais | Comum | M |
| P1 | Onboarding grava nome e renda em `ajustes`; remover `/selecao-conta` | Comum | S |
| P2 | Heatmap, Sankey, saldo da divisão no tempo | Solo + Duo | M |
| P2 | Unificar tokens visuais entre CSS legado e telas inline | Comum | L |

Esforço: S ≈ até meio dia · M ≈ 1–2 dias · L ≈ 3+ dias.
