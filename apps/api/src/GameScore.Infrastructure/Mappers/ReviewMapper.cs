using GameScore.Infrastructure.Mappers;
using GameScore.Infrastructure.Persistence;

namespace GameScore.Infrastructure.Mappers;

public static class ReviewMapper
{
    public static object ToDto(
        ReviewEntity review,
        UserEntity author,
        GameEntity game,
        PlatformEntity? platform,
        Guid? viewerId = null,
        bool? viewerVote = null,
        bool viewerHasReported = false) =>
        new
        {
            id = review.Id,
            author = UserMapper.ToSummary(author),
            game = new
            {
                id = game.Id,
                slug = game.Slug,
                name = game.Name,
                coverImageUrl = game.CoverImageUrl,
            },
            recommended = review.Recommended,
            rating = review.Rating,
            text = review.Text,
            hoursPlayed = review.HoursPlayed,
            platform = platform is null ? null : UserMapper.ToPlatform(platform),
            usefulCount = review.UsefulCount,
            notUsefulCount = review.NotUsefulCount,
            createdAt = review.CreatedAt.ToString("O"),
            updatedAt = review.UpdatedAt.ToString("O"),
            edited = review.Edited,
            status = review.Status.ToString(),
            moderationStatus = review.ModerationStatus.ToString(),
            viewerVote = viewerVote switch
            {
                true => "USEFUL",
                false => "NOT_USEFUL",
                _ => null,
            },
            viewerIsAuthor = viewerId == review.UserId,
            viewerHasReported,
        };
}
