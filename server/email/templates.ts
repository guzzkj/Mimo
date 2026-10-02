import type { EmailMessage } from "./mailer";

// Templates transacionais. HTML simples com tabela (compatível com clientes de
// e-mail) + versão texto. Todo dado vindo do usuário passa por escapeHtml.

export const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (ch) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string
));

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface LayoutInput {
  preheader: string;
  title: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

function layout({ preheader, title, paragraphs, cta, footnote }: LayoutInput): { html: string; text: string } {
  const p = paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3d4250">${escapeHtml(t)}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 22px;border-radius:14px;background:#0e7f6d;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none">${escapeHtml(cta.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12.5px;line-height:1.5;color:#8790a6">Se o botão não funcionar, copie este link: <br><span style="word-break:break-all">${escapeHtml(cta.url)}</span></p>`
    : "";
  const note = footnote ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#8790a6">${escapeHtml(footnote)}</p>` : "";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:Manrope,Segoe UI,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#0e7f6d">Mimo</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1b1e27">${escapeHtml(title)}</h1>
${p}${button}${note}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#8790a6">Você recebeu este e-mail porque tem uma conta no Mimo.</p>
</td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), ...(footnote ? ["", footnote] : [])].join("\n");
  return { html, text };
}

type Msg = Omit<EmailMessage, "to">;

export function verifyEmailMessage(name: string, url: string): Msg {
  const { html, text } = layout({
    preheader: "Confirme seu e-mail para abrir o painel.",
    title: name ? `Oi, ${name}! Confirme seu e-mail` : "Confirme seu e-mail",
    paragraphs: ["Falta só um passo para começar a organizar suas finanças no Mimo."],
    cta: { label: "Confirmar e-mail", url },
    footnote: "O link vale por 24 horas. Se você não criou uma conta, ignore este e-mail.",
  });
  return { subject: "Confirme seu e-mail no Mimo", html, text, tag: "verify_email" };
}

export function resetPasswordMessage(url: string): Msg {
  const { html, text } = layout({
    preheader: "Link para criar uma senha nova.",
    title: "Redefinir sua senha",
    paragraphs: ["Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para escolher uma nova."],
    cta: { label: "Criar senha nova", url },
    footnote: "O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore: sua senha continua a mesma.",
  });
  return { subject: "Redefinir sua senha do Mimo", html, text, tag: "reset_password" };
}

export function passwordChangedMessage(appUrl: string): Msg {
  const { html, text } = layout({
    preheader: "Sua senha foi alterada.",
    title: "Sua senha foi alterada",
    paragraphs: ["A senha da sua conta no Mimo acabou de ser alterada e as outras sessões foram encerradas."],
    cta: { label: "Abrir o Mimo", url: appUrl },
    footnote: "Se não foi você, redefina a senha agora pelo link \"Esqueci minha senha\".",
  });
  return { subject: "Sua senha do Mimo foi alterada", html, text, tag: "password_changed" };
}

export function duoInviteMessage(inviterName: string, message: string | null, url: string): Msg {
  const who = inviterName || "Alguém";
  const { html, text } = layout({
    preheader: `${who} quer organizar as finanças da casa com você.`,
    title: `${who} convidou você para o Mimo Duo`,
    paragraphs: [
      ...(message ? [`“${message}”`] : []),
      "No Mimo Duo vocês acompanham os gastos do casal, dividem despesas e guardam para metas juntos. O que cada um marcar como privado continua privado.",
    ],
    cta: { label: "Ver convite", url },
    footnote: "O convite vale por 7 dias.",
  });
  return { subject: `${who} convidou você para o Mimo Duo`, html, text, tag: "duo_invite" };
}

export function inviteAcceptedMessage(partnerName: string, url: string): Msg {
  const who = partnerName || "Seu par";
  const { html, text } = layout({
    preheader: `${who} entrou na conta Duo.`,
    title: `${who} aceitou o convite`,
    paragraphs: ["A conta Duo está ativa. O que cada um marcar como compartilhado aparece no painel do casal."],
    cta: { label: "Abrir o painel do casal", url },
  });
  return { subject: `${who} aceitou o convite do Mimo Duo`, html, text, tag: "invite_accepted" };
}

export function goalMilestoneMessage(goalName: string, milestone: number, savedCents: number, url: string, duo: boolean): Msg {
  const done = milestone >= 100;
  const { html, text } = layout({
    preheader: done ? `Meta "${goalName}" concluída!` : `"${goalName}" passou de ${milestone}%.`,
    title: done ? `Meta concluída: ${goalName}` : `${goalName} passou de ${milestone}%`,
    paragraphs: [`${duo ? "Vocês já guardaram" : "Você já guardou"} ${brl(savedCents)}.${done ? " Hora de comemorar!" : ""}`],
    cta: { label: "Ver a meta", url },
  });
  return { subject: done ? `Meta concluída: ${goalName}` : `${goalName} passou de ${milestone}%`, html, text, tag: "goal_milestone" };
}

export function billsDueMessage(bills: { description: string; amountCents: number; dueOn: string }[], url: string): Msg {
  const lines = bills.map((b) => `${b.description}: ${brl(b.amountCents)} (vence ${b.dueOn.split("-").reverse().join("/")})`);
  const { html, text } = layout({
    preheader: `${bills.length} ${bills.length === 1 ? "conta vence" : "contas vencem"} em breve.`,
    title: bills.length === 1 ? "Uma conta vence em breve" : `${bills.length} contas vencem em breve`,
    paragraphs: lines,
    cta: { label: "Ver contas a pagar", url },
    footnote: "Você pode desligar estes avisos em Configurações > Notificações.",
  });
  return { subject: bills.length === 1 ? `Lembrete: ${bills[0].description} vence em breve` : `Lembrete: ${bills.length} contas vencem em breve`, html, text, tag: "bills_due" };
}
