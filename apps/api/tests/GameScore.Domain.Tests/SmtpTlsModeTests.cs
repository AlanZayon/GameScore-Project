using FluentAssertions;
using GameScore.Application.Email;

namespace GameScore.Domain.Tests;

public class SmtpTlsModeTests
{
    [Fact]
    public void Port_465_uses_implicit_tls()
    {
        SmtpTls.Resolve(465, secure: false).Should().Be(SmtpTlsMode.SslOnConnect);
        SmtpTls.Resolve(465, secure: true).Should().Be(SmtpTlsMode.SslOnConnect);
    }

    [Fact]
    public void Secure_587_uses_starttls()
    {
        SmtpTls.Resolve(587, secure: true).Should().Be(SmtpTlsMode.StartTls);
    }

    [Fact]
    public void Insecure_mailpit_uses_none()
    {
        SmtpTls.Resolve(1025, secure: false).Should().Be(SmtpTlsMode.None);
    }
}
