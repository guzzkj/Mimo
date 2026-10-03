// Política de Privacidade (LGPD). PLACEHOLDER: o texto final e os dados do
// encarregado (DPO) precisam ser definidos pelo negócio/jurídico antes de ir ao ar.

const DPO_EMAIL = "privacidade@EXEMPLO-TROCAR.com.br";

export default function Privacidade() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", lineHeight: 1.7, color: "var(--ink)" }}>
      <p style={{ fontSize: 13, color: "var(--faint)" }}>
        <a href="/" style={{ color: "var(--accent-ink)" }}>← Voltar ao Mimo</a>
      </p>
      <h1>Política de Privacidade</h1>
      <p style={{ color: "var(--muted)" }}>Versão 2025-10-03 · Última atualização: 03/10/2025</p>

      <p style={{ background: "var(--accent-soft)", padding: 12, borderRadius: 8, fontSize: 13 }}>
        Documento em preenchimento. O conteúdo abaixo é um esqueleto conforme a Lei
        13.709/2018 (LGPD) e deve ser revisado pelo jurídico antes da publicação.
      </p>

      <h2>1. Controlador e Encarregado (DPO)</h2>
      <p>
        Controlador: <strong>A DEFINIR (razão social / CNPJ)</strong>. Encarregado pelo
        tratamento de dados: <strong>A DEFINIR</strong> — contato:{" "}
        <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>Cadastro: e-mail, nome e senha (armazenada apenas como hash).</li>
        <li>Financeiros informados por você: renda, movimentações, metas, investimentos.</li>
        <li>Técnicos: endereço IP e tentativas de login (segurança), sessões.</li>
      </ul>

      <h2>3. Finalidades e base legal</h2>
      <p>
        Prestação do serviço (execução de contrato, art. 7º, V), segurança (legítimo
        interesse/obrigação legal) e, quando você consentir, comunicações de marketing e
        métricas de uso (consentimento, art. 7º, I). O consentimento opcional pode ser
        revogado a qualquer momento nas configurações.
      </p>

      <h2>4. Compartilhamento</h2>
      <p>
        Operadores estritamente necessários: provedor de banco de dados e provedor de
        envio de e-mail. A DEFINIR a lista e a localização (transferência internacional).
      </p>

      <h2>5. Retenção</h2>
      <p>
        Mantemos os dados enquanto a conta existir. Tokens e sessões expiram e são
        expurgados; tentativas de login são retidas por prazo curto (segurança). Prazos
        finais: A DEFINIR.
      </p>

      <h2>6. Seus direitos (art. 18)</h2>
      <p>
        Acesso e portabilidade (exportação dos seus dados em JSON), correção, exclusão da
        conta e revogação de consentimento — disponíveis no app, em Configurações. Dúvidas:{" "}
        <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Senhas com hash, transporte HTTPS, cookies de sessão HttpOnly/Secure/SameSite,
        controle de acesso por conta e limites contra abuso.
      </p>

      <h2>8. Incidentes</h2>
      <p>Procedimento de resposta e comunicação à ANPD e aos titulares: A DEFINIR.</p>
    </main>
  );
}
