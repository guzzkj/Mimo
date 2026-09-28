# Responsividade mobile: Mimo Solo e Mimo Duo

> **Data:** 28/09/2026 · Branch: `fix/mobile-responsiveness`.
> **Escopo:** layout e experiência no celular (até 720px, com ajustes em 380px). Só apresentação: a lógica e o estado dos filtros, das movimentações e das contas não mudaram.
> Citações no formato `caminho:linha`, relativas à raiz do repositório.

---

## 1. Sumário

| Frente | O que mudou |
|---|---|
| Varredura de quebras | 4 itens que quebravam o layout (P0), 5 com texto cortado (P1) e 5 de acabamento (P2), corrigidos |
| Navegação | Topbar some no celular; o "Mais" do dock virou um menu de tela cheia com conta, notificações, tema, destinos e ferramentas |
| Toque | Links de texto e botões pequenos ganharam área de toque de 44px sem mudar o visual |
| Movimentações | Busca e filtros viraram uma barra fixa no topo + folha de filtros, igual no Solo e no Duo |

Verificação: `npx tsc -b` sem erros, `npx oxlint` sem warnings novos (15, todos anteriores), build ok. Conferência visual com Playwright no Chrome em 320, 375, 390, 414, 768 e 1280px, tema claro e escuro. O projeto não tem suíte de testes automatizados. Não houve teste em aparelho iOS real.

---

## 2. Varredura de quebras

Auditoria de 63 rotas (Solo e Duo) em 320, 375, 390, 414 e 768px, mais os estados que dependem de clique (painel lateral, menu, modal de nova movimentação, notificações). Nenhuma rota tinha scroll horizontal, mas só porque `.app` usava `overflow-x: hidden`: os elementos eram cortados na borda.

### P0: quebravam o layout
- **Dock com 9 botões em 320px** cortava o "+" (Metas, Investimentos, Ajustes). Primeiro os slots passaram a encolher juntos; depois o menu de tela cheia fixou o dock em 7 botões (seção 3).
- **`/duo/movimentacoes` de 320 a 414px:** a grade desktop de 7 colunas vencia o cartão mobile e valor, data e ações saíam do cartão. `src/styles/mimo-telas.css`, bloco `.mv-table--extra`.
- **Detalhe de meta (`/metas/:id`):** valor de 44px estourava o cartão e as contribuições do Duo saíam da tela. Valor com `clamp()` e blocos que empilham. `src/pages/DuoMetas.tsx`.
- **Topo do acesso em `/acesso/verificar`:** e-mail longo empurrava o "Sair" para fora. E-mail com reticências. `src/pages/FluxoAcesso.tsx`.

### P1: texto cortado
- Investimentos: nome do ativo com ~33px em 320px e valor invadindo a coluna "Rent." em 768px; valor e rentabilidade empilhados. Total da carteira com `clamp()`. `src/pages/Configuracoes.tsx`.
- Cards Gustavo/Suelen em `/duo` quebram linha de forma controlada. `src/pages/DuoMetas.tsx`.
- Lista de movimentações do Solo: ícone "−" não encolhe e a tag "Mensal" mostra só o ícone no celular (texto segue no `title`). `src/styles/mimo-rodada3.css`, `src/components/TagsMovimentacao.tsx`.
- Cabeçalho do painel de notificações quebra de forma organizada. `src/components/PainelNotificacoes.tsx`.

### P2: acabamento
- Campos com fonte menor que 16px (zoom automático do iOS): ~25 campos ficam em 16px até 720px. `src/styles/mimo-telas.css`.
- Modal com `100dvh` (fallback `100vh`). `src/styles/legacy-mobile.css`.
- Links "← Metas" e "← Ajustes" com 44px de altura de toque.
- Rabo do gato em Metas não é mais cortado entre 721 e 900px.
- E-mail longo em Ajustes > Notificações quebra linha (`overflow-wrap: anywhere`).

---

## 3. Navegação no celular: menu de tela cheia

Até 720px a Topbar fica oculta (`src/styles/legacy-mobile.css`) e o conteúdo começa no topo, respeitando `safe-area-inset-top`. O painel de resumo lateral também passa a ocupar a tela inteira.

O botão "Mais" do dock virou **Menu** (ícone de hambúrguer, com um ponto vermelho quando há notificação não lida) e abre `src/components/MenuMobile.tsx`:

- **Topo:** logo e fechar (44px).
- **Conta:** avatar, nome, tipo de conta, mês e % do limite; leva ao perfil.
- **Atalhos:** Notificações (contador no ícone; abre o painel de notificações) e troca de tema. Em telas de até 360px os dois empilham.
- **Navegar:** todos os destinos, com o atual em destaque. No Duo inclui Divisão e Visão Solo.
- **Ferramentas:** Resumo do mês, Ocultar/Mostrar valores e Exportar CSV.

Fecha com X, Esc ou ao escolher um item. Foco preso (`src/hooks/useDialogo.ts`) e página de trás sem rolagem enquanto aberto.

O dock no celular fica com 7 botões fixos: 3 destinos principais, Menu, painel, ocultar valores e "+". Em Metas, Investimentos ou Ajustes o botão Menu fica aceso em vez de acrescentar um botão ao dock (`src/components/Moldura.tsx`).

`src/components/Dock.tsx` recebe a prop `menu` (conta, tema, notificações), passada por `src/App.tsx` e `src/components/Moldura.tsx`. No desktop nada muda: a Topbar continua e o botão Menu não aparece.

---

## 4. Área de toque

Classe `.alvo-toque` em `src/styles/mimo-telas.css`: um `::after` invisível estende a área clicável até ~44px sem alterar o tamanho do texto. Também vale para `.link-button`, `.orc-editar` e `.mes-nav__seta`.

| Elemento | Área de toque |
|---|---|
| "Ver todas", "Detalhes", "Ajustar"/"Definir" | 45–47px |
| "Entrar", "Criar conta", "Sair", "Reenviar link/e-mail", "Usar outro e-mail", "Trocar e-mail" | 47px |
| "Marcar todas como lidas" | 45px |
| Fechar notificações | 44×44 |
| Setas do mês | 34×44 (crescem mais na altura para não cobrir o mês nem o "Hoje") |

---

## 5. Movimentações: busca e filtros

**Antes:** 4 linhas de controles no Solo e 5 no Duo antes da lista (busca, tipo, status, categoria + "Só cartão" e, no Duo, autor quebrando em duas linhas). Em 390px a lista começava a 386px (Solo) e 439px (Duo) do topo.

**Agora** (`src/components/FiltrosMovimentacoes.tsx`, compartilhado pelo Solo e pelo Duo):

- **Barra fixa no topo:** busca com lupa, botão × para limpar (Esc também limpa) e fonte de 16px, mais o botão **Filtros** com contador de filtros ativos. Em 380px o botão vira só ícone.
- **Folha de filtros:** Tipo, Status, Categoria e "Só compras no cartão"; no Duo também "Quem lançou", com avatar e contagem. Os filtros aplicam na hora e "Ver N resultados" só fecha a folha, então a contagem é a real (`d.visiveis.length`) sem duplicar lógica. Fecha com Esc, toque fora ou X; fecha sozinha se a janela passar de 720px.
- **Filtros ativos** aparecem como chips removíveis abaixo da barra, com "Limpar tudo". O "Marcar N como pagas" fica na mesma linha.
- **Lista vazia** ganhou o botão "Limpar busca e filtros".
- Em 390px a lista passou a começar a 249px (Solo) e 195px (Duo).

Arquivos:
- `src/lib/filtrosMovimentacoes.ts`: tipos `FiltrosProps` e `FiltroAutor`, funções `limparFiltros` e `temFiltroAtivo`.
- `src/components/ViewLista.tsx`: usa `<FiltrosMovimentacoes>`; a prop `filtrosExtras` (JSX) virou `filtroAutor` (estruturada).
- `src/pages/DuoMetas.tsx`: o filtro de autor virou o objeto `filtroAutor`, sobre o mesmo estado `quemFiltro`.
- `src/styles/filtros-mov.css` (importado em `src/index.css`): estilos da busca, barra, chips ativos e folha, com tokens existentes, tema claro/escuro e `prefers-reduced-motion`.
- `src/styles/legacy-mobile.css`: `.app, .main { overflow-x: clip; }` no celular. O `overflow-x: hidden` anterior impedia qualquer elemento de grudar no topo.

No desktop a tela continua igual, só com a lupa e o × na busca. O texto de exemplo virou "Buscar movimentações"; a descrição completa fica no rótulo para leitor de tela.

---

## 6. Pendências

- **Dock em 320px:** com 7 botões, cada um fica com ~38px, abaixo dos 44px recomendados. Reduzir exige tirar algum atalho do dock.
- **"Conta conjunta" cortado** na folha de filtros do Duo em 390px ("Conta conju…"). Resolve reduzindo o contador ou deixando o texto quebrar linha.
- **Topbar do desktop** tem `position: sticky` mas não gruda, pelo `overflow-x: hidden` em `.app` fora do celular. Aplicar o `clip` também no desktop resolve.
- **Safari abaixo de 16** não suporta `overflow-x: clip`: a barra de busca não gruda no topo, o resto funciona.
- **Tema no menu** mostra o tema atual ("Tema claro"), não o que vai ativar.
- `min-height: 100vh` em `body` e `.app` (`src/styles/legacy-desktop.css`) mantido, sem impacto visível.
- Sem teste em aparelho iOS real e sem suíte de testes automatizados.
