using GameScore.Infrastructure.Persistence;

namespace GameScore.Infrastructure.Mappers;

public static class UserMapper
{
    public static object ToSummary(UserEntity user) =>
        new
        {
            id = user.Id,
            username = user.Username,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            reputationScore = user.ReputationScore,
            role = user.Role.ToString(),
            deleted = user.DeletedAt is not null,
        };

    public static object ToAuthenticatedUser(UserEntity user) =>
        new
        {
            id = user.Id,
            username = user.Username,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            reputationScore = user.ReputationScore,
            role = user.Role.ToString(),
            deleted = false,
            email = user.Email,
            status = user.Status.ToString(),
            createdAt = user.CreatedAt.ToString("O"),
            emailVerified = user.EmailVerifiedAt is not null,
        };

    public static object ToPlatform(PlatformEntity platform) =>
        new
        {
            id = platform.Id,
            slug = platform.Slug,
            name = platform.Name,
            abbreviation = platform.Abbreviation,
            family = platform.Family.ToString(),
        };
}
