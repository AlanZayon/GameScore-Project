using FluentAssertions;
using GameScore.Application.Auth;
using GameScore.Application.Errors;

namespace GameScore.Domain.Tests;

public class PasswordRulesTests
{
    [Theory]
    [InlineData("short1")]
    [InlineData("allletters")]
    [InlineData("12345678")]
    [InlineData("")]
    public void EnsureValid_rejects_weak_passwords(string password)
    {
        var act = () => PasswordRules.EnsureValid(password);
        act.Should().Throw<BadRequestException>()
            .Which.Code.Should().Be(ErrorCodes.ValidationFailed);
    }

    [Fact]
    public void EnsureValid_accepts_letter_and_digit()
    {
        var act = () => PasswordRules.EnsureValid("Password1");
        act.Should().NotThrow();
    }
}
