using FluentAssertions;
using GameScore.Application.Configuration;

namespace GameScore.Domain.Tests;

public class SmtpConfigResendTests
{
    [Fact]
    public void PreferResendHttps_when_host_is_resend_and_key_present()
    {
        new SmtpConfig
        {
            Host = "smtp.resend.com",
            Pass = "re_test",
            From = "GameScore <noreply@example.com>",
        }.PreferResendHttps.Should().BeTrue();
    }

    [Fact]
    public void PreferResendHttps_false_for_mailpit()
    {
        new SmtpConfig
        {
            Host = "127.0.0.1",
            Port = 1025,
            Pass = null,
            From = "GameScore <noreply@localhost>",
        }.PreferResendHttps.Should().BeFalse();
    }
}
