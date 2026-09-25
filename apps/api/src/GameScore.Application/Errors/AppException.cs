namespace GameScore.Application.Errors;

public class AppException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyDictionary<string, string[]>? Details { get; }

    public AppException(string code, string message, int statusCode, IReadOnlyDictionary<string, string[]>? details = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details;
    }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string code = ErrorCodes.NotFound, string message = "Resource not found")
        : base(code, message, StatusCodes.Status404NotFound)
    {
    }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string code, string message)
        : base(code, message, StatusCodes.Status409Conflict)
    {
    }
}

public sealed class BadRequestException : AppException
{
    public BadRequestException(
        string code = ErrorCodes.BadRequest,
        string message = "Bad request",
        IReadOnlyDictionary<string, string[]>? details = null)
        : base(code, message, StatusCodes.Status400BadRequest, details)
    {
    }
}

public sealed class UnauthorizedException : AppException
{
    public UnauthorizedException(string code = ErrorCodes.Unauthorized, string message = "Authentication required")
        : base(code, message, StatusCodes.Status401Unauthorized)
    {
    }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string code = ErrorCodes.Forbidden, string message = "Not allowed")
        : base(code, message, StatusCodes.Status403Forbidden)
    {
    }
}

public sealed class TooManyRequestsException : AppException
{
    public TooManyRequestsException(
        string code = ErrorCodes.RateLimitExceeded,
        string message = "Too many requests, please slow down")
        : base(code, message, StatusCodes.Status429TooManyRequests)
    {
    }
}

file static class StatusCodes
{
    public const int Status400BadRequest = 400;
    public const int Status401Unauthorized = 401;
    public const int Status403Forbidden = 403;
    public const int Status404NotFound = 404;
    public const int Status409Conflict = 409;
    public const int Status429TooManyRequests = 429;
}
