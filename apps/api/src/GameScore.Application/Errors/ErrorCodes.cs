namespace GameScore.Application.Errors;

public static class ErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string InternalError = "INTERNAL_ERROR";
    public const string NotFound = "NOT_FOUND";
    public const string Forbidden = "FORBIDDEN";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string RateLimitExceeded = "RATE_LIMIT_EXCEEDED";
    public const string BadRequest = "BAD_REQUEST";

    public const string EmailAlreadyInUse = "EMAIL_ALREADY_IN_USE";
    public const string UsernameAlreadyInUse = "USERNAME_ALREADY_IN_USE";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string InvalidRefreshToken = "INVALID_REFRESH_TOKEN";
    public const string AccountSuspended = "ACCOUNT_SUSPENDED";
    public const string AccessTokenExpired = "ACCESS_TOKEN_EXPIRED";
    public const string InsufficientRole = "INSUFFICIENT_ROLE";
    public const string InvalidResetToken = "INVALID_RESET_TOKEN";
    public const string ResetTokenExpired = "RESET_TOKEN_EXPIRED";
    public const string CurrentPasswordInvalid = "CURRENT_PASSWORD_INVALID";
    public const string InvalidAvatarUrl = "INVALID_AVATAR_URL";
    public const string InvalidVerificationToken = "INVALID_VERIFICATION_TOKEN";
    public const string VerificationTokenExpired = "VERIFICATION_TOKEN_EXPIRED";
    public const string EmailAlreadyVerified = "EMAIL_ALREADY_VERIFIED";

    public const string UserNotFound = "USER_NOT_FOUND";
    public const string GameNotFound = "GAME_NOT_FOUND";
    public const string GameAlreadyExists = "GAME_ALREADY_EXISTS";
    public const string PlatformNotFound = "PLATFORM_NOT_FOUND";
    public const string GenreNotFound = "GENRE_NOT_FOUND";
    public const string PlatformNotAvailableForGame = "PLATFORM_NOT_AVAILABLE_FOR_GAME";

    public const string ReviewNotFound = "REVIEW_NOT_FOUND";
    public const string ReviewAlreadyExists = "REVIEW_ALREADY_EXISTS";
    public const string ReviewNotOwned = "REVIEW_NOT_OWNED";
    public const string CannotVoteOwnReview = "CANNOT_VOTE_OWN_REVIEW";
    public const string VoteNotFound = "VOTE_NOT_FOUND";
    public const string CannotReportOwnReview = "CANNOT_REPORT_OWN_REVIEW";
    public const string ReviewAlreadyReported = "REVIEW_ALREADY_REPORTED";
    public const string ReviewRejectedAsSpam = "REVIEW_REJECTED_AS_SPAM";
    public const string ReviewRateLimitExceeded = "REVIEW_RATE_LIMIT_EXCEEDED";
    public const string InvalidCursor = "INVALID_CURSOR";

    public const string ReportNotFound = "REPORT_NOT_FOUND";
    public const string ReportAlreadyResolved = "REPORT_ALREADY_RESOLVED";
    public const string ReviewBombEventNotFound = "REVIEW_BOMB_EVENT_NOT_FOUND";

    public const string IgdbNotConfigured = "IGDB_NOT_CONFIGURED";
    public const string IgdbRequestFailed = "IGDB_REQUEST_FAILED";
    public const string IgdbGameNotFound = "IGDB_GAME_NOT_FOUND";
    public const string IgdbInvalidPayload = "IGDB_INVALID_PAYLOAD";
}
