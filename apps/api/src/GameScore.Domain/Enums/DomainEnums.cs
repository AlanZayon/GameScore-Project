namespace GameScore.Domain.Enums;

public static class UserRoles
{
    public const string User = "USER";
    public const string Moderator = "MODERATOR";
    public const string Admin = "ADMIN";

    public static readonly IReadOnlyList<string> All = [User, Moderator, Admin];

    private static readonly Dictionary<string, int> Rank = new(StringComparer.Ordinal)
    {
        [User] = 0,
        [Moderator] = 1,
        [Admin] = 2,
    };

    public static int RoleRank(string role) => Rank.GetValueOrDefault(role, 0);

    public static bool CanModerateRole(string actor, string target) =>
        RoleRank(actor) > RoleRank(target);
}

public static class UserStatuses
{
    public const string Active = "ACTIVE";
    public const string Suspended = "SUSPENDED";
}

public static class ReviewStatuses
{
    public const string Published = "PUBLISHED";
    public const string Hidden = "HIDDEN";
}

public static class ReviewModerationStatuses
{
    public const string Normal = "NORMAL";
    public const string Suspicious = "SUSPICIOUS";
    public const string ReviewBomb = "REVIEW_BOMB";
    public const string ModerationRequired = "MODERATION_REQUIRED";
}

public static class ReportReasons
{
    public const string Spam = "SPAM";
    public const string Abuse = "ABUSE";
    public const string OffTopic = "OFF_TOPIC";
    public const string FakeReview = "FAKE_REVIEW";
    public const string Harassment = "HARASSMENT";
    public const string Other = "OTHER";

    public static readonly IReadOnlyList<string> All =
    [
        Spam, Abuse, OffTopic, FakeReview, Harassment, Other
    ];
}

public static class ReportStatuses
{
    public const string Pending = "PENDING";
    public const string Resolved = "RESOLVED";
    public const string Dismissed = "DISMISSED";
}

public static class ReviewBombStatuses
{
    public const string Detected = "DETECTED";
    public const string Confirmed = "CONFIRMED";
    public const string Dismissed = "DISMISSED";
}

public static class ExternalProviders
{
    public const string Igdb = "IGDB";
}

public static class PlatformFamilies
{
    public const string Pc = "PC";
    public const string Playstation = "PLAYSTATION";
    public const string Xbox = "XBOX";
    public const string Nintendo = "NINTENDO";
    public const string Mobile = "MOBILE";
    public const string Other = "OTHER";
}

public static class ReviewSorts
{
    public const string Best = "BEST";
    public const string Recent = "RECENT";
    public const string MostUseful = "MOST_USEFUL";
}

public static class ReviewRecommendationFilters
{
    public const string All = "ALL";
    public const string Positive = "POSITIVE";
    public const string Negative = "NEGATIVE";
}

public static class GameSorts
{
    public const string Relevance = "RELEVANCE";
    public const string TopRated = "TOP_RATED";
    public const string Popular = "POPULAR";
    public const string Recent = "RECENT";
    public const string Name = "NAME";
}

public static class AuditActions
{
    public const string AdminDeletedReview = "ADMIN_DELETED_REVIEW";
    public const string AdminRestoredReview = "ADMIN_RESTORED_REVIEW";
    public const string AdminUpdatedReviewModeration = "ADMIN_UPDATED_REVIEW_MODERATION";
    public const string AdminSuspendedUser = "ADMIN_SUSPENDED_USER";
    public const string AdminReinstatedUser = "ADMIN_REINSTATED_USER";
    public const string AdminUpdatedUserRole = "ADMIN_UPDATED_USER_ROLE";
    public const string AdminImportedGame = "ADMIN_IMPORTED_GAME";
    public const string AdminSyncedGame = "ADMIN_SYNCED_GAME";
    public const string AdminUpdatedGame = "ADMIN_UPDATED_GAME";
    public const string AdminResolvedReport = "ADMIN_RESOLVED_REPORT";
    public const string AdminUpdatedReviewBombEvent = "ADMIN_UPDATED_REVIEW_BOMB_EVENT";
    public const string AdminRecalculatedGameScore = "ADMIN_RECALCULATED_GAME_SCORE";
}

public static class Locales
{
    public const string PtBr = "pt-BR";
    public const string En = "en";
    public const string Default = PtBr;
}
