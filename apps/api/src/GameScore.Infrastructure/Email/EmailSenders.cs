using GameScore.Application.Configuration;
using GameScore.Application.Email;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace GameScore.Infrastructure.Email;

public sealed class ConsoleEmailSender(ILogger<ConsoleEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Email (console): To={To} Subject={Subject} Html={HasHtml}\n{Text}",
            message.To,
            message.Subject,
            !string.IsNullOrWhiteSpace(message.Html),
            message.Text);
        return Task.CompletedTask;
    }
}

public sealed class SmtpEmailSender(IOptions<AppConfig> config, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly AppConfig _config = config.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var smtp = _config.Smtp ?? throw new InvalidOperationException("SMTP is not configured");
        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(smtp.From));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        if (!string.IsNullOrWhiteSpace(message.Html))
        {
            var builder = new BodyBuilder { TextBody = message.Text, HtmlBody = message.Html };
            mime.Body = builder.ToMessageBody();
        }
        else
        {
            mime.Body = new TextPart("plain") { Text = message.Text };
        }

        using var client = new SmtpClient();
        // 465 = implicit TLS. 587 / Resend = STARTTLS when Secure=true.
        // Secure=false = cleartext (Mailpit). Do not use SslOnConnect on 587.
        var socketOptions = SmtpTls.Resolve(smtp.Port, smtp.Secure) switch
        {
            SmtpTlsMode.SslOnConnect => SecureSocketOptions.SslOnConnect,
            SmtpTlsMode.StartTls => SecureSocketOptions.StartTls,
            _ => SecureSocketOptions.None,
        };
        await client.ConnectAsync(smtp.Host, smtp.Port, socketOptions, cancellationToken);
        if (!string.IsNullOrEmpty(smtp.User))
        {
            await client.AuthenticateAsync(smtp.User, smtp.Pass, cancellationToken);
        }

        await client.SendAsync(mime, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
        logger.LogInformation("Sent email to {To} via {Host}:{Port}", message.To, smtp.Host, smtp.Port);
    }
}
