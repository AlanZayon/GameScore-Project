using System.Net;
using System.Text;

namespace GameScore.Infrastructure.Email;

public static class EmailTemplates
{
    public static EmailMessage Verification(string to, string verifyUrl, string siteUrl)
    {
        var subject = "Confirme seu e-mail — GameScore";
        var text = new StringBuilder()
            .AppendLine("Olá!")
            .AppendLine()
            .AppendLine("Confirme seu e-mail para começar a avaliar jogos e votar no GameScore.")
            .AppendLine("Este link é válido por 24 horas:")
            .AppendLine(verifyUrl)
            .AppendLine()
            .AppendLine("Se você não criou uma conta no GameScore, ignore este e-mail.")
            .AppendLine()
            .AppendLine($"GameScore · {siteUrl}")
            .ToString();

        var html = Layout(
            siteUrl,
            preheader: "Confirme seu e-mail para ativar sua conta no GameScore.",
            title: "Confirme seu e-mail",
            bodyHtml: $"""
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">
                  Olá! Falta só um passo para ativar sua conta.
                </p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#334155;">
                  Confirme seu e-mail para avaliar jogos, votar em reviews e usar o GameScore com segurança.
                  O link abaixo é válido por <strong>24 horas</strong>.
                </p>
                {Cta(verifyUrl, "Confirmar e-mail")}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a href="{Escape(verifyUrl)}" style="color:#0f766e;word-break:break-all;">{Escape(verifyUrl)}</a>
                </p>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">
                  Se você não criou uma conta no GameScore, pode ignorar este e-mail.
                </p>
                """);

        return new EmailMessage(to, subject, text, html);
    }

    public static EmailMessage PasswordReset(string to, string resetUrl, string siteUrl)
    {
        var subject = "Redefinir senha — GameScore";
        var text = new StringBuilder()
            .AppendLine("Olá!")
            .AppendLine()
            .AppendLine("Recebemos um pedido para redefinir sua senha no GameScore.")
            .AppendLine("Este link é válido por 1 hora:")
            .AppendLine(resetUrl)
            .AppendLine()
            .AppendLine("Se você não pediu isso, ignore este e-mail.")
            .AppendLine()
            .AppendLine($"GameScore · {siteUrl}")
            .ToString();

        var html = Layout(
            siteUrl,
            preheader: "Redefina sua senha do GameScore. Link válido por 1 hora.",
            title: "Redefinir senha",
            bodyHtml: $"""
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#334155;">
                  Recebemos um pedido para redefinir a senha da sua conta.
                </p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#334155;">
                  Use o botão abaixo. O link é válido por <strong>1 hora</strong>.
                </p>
                {Cta(resetUrl, "Escolher nova senha")}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a href="{Escape(resetUrl)}" style="color:#0f766e;word-break:break-all;">{Escape(resetUrl)}</a>
                </p>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">
                  Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.
                </p>
                """);

        return new EmailMessage(to, subject, text, html);
    }

    private static string Cta(string href, string label) =>
        $"""
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
           <tr>
             <td style="border-radius:8px;background:#0f766e;">
               <a href="{Escape(href)}"
                  style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                 {Escape(label)}
               </a>
             </td>
           </tr>
         </table>
         """;

    private static string Layout(string siteUrl, string preheader, string title, string bodyHtml)
    {
        var safeSite = Escape(siteUrl.TrimEnd('/'));
        return $"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>{Escape(title)}</title>
            </head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{Escape(preheader)}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#0f766e 0%,#115e59 100%);">
                          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">GameScore</p>
                          <p style="margin:8px 0 0;font-size:14px;color:#ccfbf1;">{Escape(title)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:28px 32px 32px;">
                          {bodyHtml}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                            GameScore · avaliações com evidência<br />
                            <a href="{safeSite}" style="color:#0f766e;text-decoration:none;">{safeSite}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }

    private static string Escape(string value) => WebUtility.HtmlEncode(value);
}
