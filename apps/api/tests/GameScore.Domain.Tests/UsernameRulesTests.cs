using FluentAssertions;
using GameScore.Application.Auth;
using GameScore.Application.Errors;

namespace GameScore.Domain.Tests;

public class UsernameRulesTests
{
    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    [InlineData("alan-zayon")]
    [InlineData("alan.zayon")]
    [InlineData("alan zayon")]
    [InlineData("Alan")]
    [InlineData("joão")]
    [InlineData("this_username_is_way_too_long_for_the_rule")]
    public void EnsureValid_rejects_invalid_usernames(string username)
    {
        var act = () => UsernameRules.EnsureValid(username);
        act.Should().Throw<BadRequestException>()
            .Which.Code.Should().Be(ErrorCodes.ValidationFailed);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("alan")]
    [InlineData("alan_zayon")]
    [InlineData("player1")]
    [InlineData("a_b_c_012345678901234567")]
    public void EnsureValid_accepts_valid_usernames(string username)
    {
        var act = () => UsernameRules.EnsureValid(username);
        act.Should().NotThrow();
    }
}
