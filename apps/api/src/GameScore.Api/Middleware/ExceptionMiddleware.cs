using System.Text.Json;
using GameScore.Application.Errors;
using Microsoft.AspNetCore.Mvc;

namespace GameScore.Api.Middleware;

public sealed class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception exception)
    {
        var requestId = context.TraceIdentifier;
        int status;
        ErrorResponseBody body;

        switch (exception)
        {
            case AppException app:
                status = app.StatusCode;
                body = new ErrorResponseBody(app.Code, app.Message, app.Details);
                if (status >= 500)
                {
                    logger.LogError(exception, "{Method} {Path} failed: {Code}", context.Request.Method, context.Request.Path, app.Code);
                }
                else if (status >= 400)
                {
                    logger.LogDebug("{Method} {Path} -> {Status} {Code}", context.Request.Method, context.Request.Path, status, app.Code);
                }

                break;
            case BadHttpRequestException bad:
                status = StatusCodes.Status400BadRequest;
                body = new ErrorResponseBody(ErrorCodes.BadRequest, bad.Message, null);
                break;
            default:
                status = StatusCodes.Status500InternalServerError;
                body = new ErrorResponseBody(ErrorCodes.InternalError, "An unexpected error occurred", null);
                logger.LogError(exception, "{Method} {Path} unhandled", context.Request.Method, context.Request.Path);
                break;
        }

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            code = body.Code,
            message = body.Message,
            details = body.Details,
            requestId,
        }, JsonSerializerOptions));
    }

    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed record ErrorResponseBody(
        string Code,
        string Message,
        IReadOnlyDictionary<string, string[]>? Details);
}

public sealed class RequestIdMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["x-request-id"] = context.TraceIdentifier;
        await next(context);
    }
}
