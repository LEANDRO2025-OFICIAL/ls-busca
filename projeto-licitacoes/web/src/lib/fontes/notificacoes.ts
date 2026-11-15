// Envio de alertas por e-mail e WhatsApp.
// E-mail: configurar GMAIL_USER e GMAIL_APP_PASSWORD.
// WhatsApp: configurar WHATSAPP_API_URL, WHATSAPP_API_TOKEN.

export type Alerta = {
  titulo: string;
  corpo: string;
  linkUrl?: string;
};

export async function enviarEmail(para: string, alerta: Alerta): Promise<void> {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) {
    console.warn("[notificacoes] GMAIL_USER ou GMAIL_APP_PASSWORD não configurados — e-mail ignorado");
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = await import("nodemailer").catch(() => null);
    if (nodemailer) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass: appPassword },
      });
      await transporter.sendMail({
        from: `"LS Busca" <${user}>`,
        to: para,
        subject: alerta.titulo,
        text: `${alerta.corpo}${alerta.linkUrl ? `\n\n${alerta.linkUrl}` : ""}`,
        html: `<p>${alerta.corpo.replace(/\n/g, "<br>")}</p>${alerta.linkUrl ? `<p><a href="${alerta.linkUrl}">Acessar</a></p>` : ""}`,
      });
    }
  } catch (e) {
    console.error("[notificacoes] Erro ao enviar e-mail:", e);
  }
}

export async function enviarWhatsApp(numero: string, alerta: Alerta): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  if (!apiUrl || !apiToken) {
    console.warn("[notificacoes] WHATSAPP_API_URL ou WHATSAPP_API_TOKEN não configurados — WhatsApp ignorado");
    return;
  }

  const mensagem = `*${alerta.titulo}*\n\n${alerta.corpo}${alerta.linkUrl ? `\n\n${alerta.linkUrl}` : ""}`;
  try {
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiToken}` },
      body: JSON.stringify({ to: numero, type: "text", text: { body: mensagem } }),
    });
  } catch (e) {
    console.error("[notificacoes] Erro ao enviar WhatsApp:", e);
  }
}
