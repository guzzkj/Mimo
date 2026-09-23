# 🏦 ROADMAP · INTEGRAÇÕES

## Fase 1 · Open Finance (cartões e contas)
Objetivo: puxar entradas e saídas automaticamente

1. Escolher agregador (Pluggy, Belvo ou similar)
   > App não precisa ser instituição autorizada pelo BC
2. Testar no sandbox do agregador
3. Conectar conta/cartão com consentimento do usuário
4. Importar transações + categorização automática
5. Conciliar com lançamentos manuais (evitar duplicidade)
6. Duo: cada um conecta as próprias contas
   > definir o que é visível pro parceiro(a)

## Fase 2 · Investimentos (manual + mercado)
Objetivo: acompanhar carteira sem integração complexa

1. Usuário cadastra ativos manualmente (ticker, qtd, preço médio)
2. API de mercado para cotações e dividendos (ex: brapi.dev)
3. Calendário de proventos (datas com e pagamento)
4. Dividendos entram como receita no fluxo do app
5. Solo: rentabilidade da carteira
   Duo: carteira individual + visão consolidada do casal

## Fase 3 · Investimentos automáticos
Objetivo: importar a carteira real sem cadastro manual

1. Avaliar fontes de posição do usuário:
   - API Área do Investidor da B3 (paga, via contrato)
   - Open Finance investimentos (via agregador)
2. Sincronizar posição, movimentações e proventos
3. Substituir o cadastro manual (manter como fallback)

# 📍 ONDE ENTRA NO ROADMAP GERAL
- MVP → lançamento manual
- V2  → Open Finance (Fase 1) + catálogo de itens
- V3  → Investimentos manual + API de mercado (Fase 2)
- V4  → Atualização automática de preços + Fase 3

# ⚠️ ATENÇÃO
- LGPD: dado financeiro é sensível
  > consentimento explícito, criptografia, nunca salvar senha de banco
- Agregadores cobram por conexão/mês → impacta preço do plano
- Open Finance pode virar recurso do plano pago
- Duo: privacidade entre parceiros precisa ser configurável
