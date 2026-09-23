# 🔐 BACKLOG · LOGIN + DATABASE (fundação do MVP)

## 1. Autenticação
- Cadastro: e-mail + senha (Supabase Auth)
- Login social: Google (reduz fricção no onboarding)
- Recuperação de senha (magic link)
- Verificação de e-mail obrigatória antes de liberar app
- Sessão persistente (refresh token)
- Biometria/PIN no app mobile → v2, não MVP

## 2. Database (Supabase/Postgres)
Tabelas mínimas:
- `users` (auth.users + profile: nome, avatar, plano solo/duo)
- `contas_duo` (vínculo entre 2 usuários, status convite: pendente/aceito)
- `transacoes` (tipo entrada/saída, valor, categoria, data, conta_id, criado_por)
- `categorias` (padrão do sistema + custom por usuário)
- `metas` (nome, valor_alvo, valor_atual, prazo, tipo: casa/viagem/etc)
- `investimentos` (ticker, qtd, preço_médio) → fica vazio até Fase 2 do [roadmap de integrações](./roadmap-integracoes.md)

## 3. Regras de acesso (RLS)
- Solo: usuário só vê os próprios dados
- Duo: cada um vê a conta conjunta + escolhe o que expõe da conta pessoal
  > requer coluna `visibilidade` (privado/compartilhado) na transação
- RLS obrigatório em toda tabela com dado de usuário — sem exceção

# ⚠️ ATENÇÃO
- Duo sem RLS bem desenhado = vazamento de gasto pessoal pro parceiro(a)
- Definir ANTES de codar: convite Duo cria conta nova ou vincula existente?

---

# 🔎 PESQUISA · FUNCIONALIDADES EM GESTORES DE GASTOS (BR)

## O que Mobills, Organizze e YNAB têm em comum
- Categorização automática de transações
- Cartão de crédito: fatura, limite, parcelamento
- Metas com progresso visual
- Relatórios/gráficos mensais
- App mobile + web sincronizados

## Diferenciais por app
- **Mobills**: mais completo — Open Finance (Premium), geolocalização de gasto, alertas de conta a pagar, multi-conta pesada
- **Organizze**: mais simples, plano free generoso, conta compartilhada (Duo) já validada no mercado, Open Finance incluso
- **YNAB**: orçamento base-zero rígido, sem investimentos nem Open Finance — foco 100% em controle mensal

## O que isso muda no nosso backlog
- Conta Duo já é padrão de mercado (Organizze) → confirma que a feature do MVP faz sentido
- Open Finance é diferencial pago, não básico → confirma que fica pra V2, não MVP
- Nenhum concorrente forte tem "catálogo de metas com produto real" → segue como diferencial nosso

# ❓ PERGUNTAS EM ABERTO (novas)
- MVP entra com categorização manual ou já nasce com sugestão automática por palavra-chave?
- Cartão de crédito (fatura/parcelamento) entra no MVP ou só transação simples?

## Fontes
- [Encaixei vs Mobills vs Organizze: comparativo 2026](https://www.encaixei.com.br/comparativo-de-precos-apps-financas)
- [10 Melhores Apps de Finanças em 2026](https://www.encaixei.com.br/blog/melhores-apps-financas)
- [Mobills ou Organizze: Qual o Melhor em 2026?](https://zapgastos.com/blog/mobills-ou-organizze/)
- [Mobills - Budget Planner - App Store](https://apps.apple.com/us/app/mobills-budget-planner/id921838244)
- [brapi.dev — API B3 gratuita, limites, dados e planos](https://brapi.dev/faq)
