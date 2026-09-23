# Feats exclusivas do Ninho (não existem no Mimo)

Base: Ninho é fork do [Mimo](https://github.com/vitorcgo/MIMO-GerenciadordeGastos), adaptado pra meta única (mobiliar casa nova) em vez de fluxo de caixa mensal.

## Domínio (funcionalidades novas)

- **Itens da casa (CRUD)** — prioridade essencial / importante / conforto, faixa de preço (mínimo, médio, máximo), observação, busca e filtro por prioridade. Catálogo inicial com 16 itens (origem: `eletrodomesticos_casal.xlsx`).
- **Aportes por pessoa** — depósito na poupança conjunta com data e nota, total por pessoa, card com contribuição individual no verso.
- **Plano do casal** — nomes dos dois, aporte mensal de cada um, data de início e data alvo, base de preço usada na meta (mín/méd/máx), toggle pra incluir/excluir itens de conforto da meta.
- **Cálculo de meta** — soma de itens essenciais + importantes na base escolhida; conforto fica fora salvo opção marcada; item sem preço não entra (com aviso no painel).
- **Projeção por aporte** — com aporte mensal preenchido, calcula em quantos meses a meta fecha e em que mês.
- **Projeção por data** — com data alvo preenchida, calcula quanto guardar por mês (dividido na proporção configurada entre os dois, ou meio a meio).
- **Ritmo** — com aporte e data preenchidos, mascote fica preocupado se o mês previsto passa da data alvo.
- **Cobertura por prioridade** — guardado cobre primeiro essenciais, depois importantes, depois conforto (se estiver na meta).
- **Dashboard específico** — barras de progresso por prioridade, gráfico rosca por prioridade, linha do tempo de aportes, gráfico de evolução (real + projeção + linha da meta).

## Infraestrutura (dev/projeto)

- `package.json` com `npm start` / `npm test`.
- Servidor local próprio em `scripts/serve.cjs` (sem depender de `python -m http.server`).
- Bibliotecas (Chart.js, Lucide) vendorizadas em `assets/vendor/` — sem CDN, funciona offline desde a primeira abertura.
- Suite de testes `tests/app.test.cjs` (`node --test`), roda `app.js` num contexto `vm` sem DOM.
- `docs/recuperacao.md` — proteção contra dado corrompido: se `localStorage` não puder ser lido, app para de gravar (não sobrescreve) e avisa.
