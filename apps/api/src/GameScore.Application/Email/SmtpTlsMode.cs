namespace GameScore.Application.Email;

public enum SmtpTlsMode
{
    None,
    StartTls,
    SslOnConnect,
}

public static class SmtpTls
{
    /// <summary>
    /// 465 → implicit TLS. Secure on other ports → STARTTLS (Resend/SendGrid :587).
    /// Otherwise cleartext (local Mailpit).
    /// </summary>
    public static SmtpTlsMode Resolve(int port, bool secure) =>
        port == 465
            ? SmtpTlsMode.SslOnConnect
            : secure
                ? SmtpTlsMode.StartTls
                : SmtpTlsMode.None;
}
