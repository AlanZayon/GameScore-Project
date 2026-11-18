using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using GameScore.Application.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GameScore.Infrastructure.Email;

/// <summary>
/// Sends mail through Resend's HTTPS API. Required on Render free (and similar hosts)
/// that block outbound SMTP on ports 25/465/587.
/// </summary>
public sealed class ResendEmailSender : IEmailSender
{
    private readonly AppConfig _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ResendEmailSender> _logger;

    public ResendEmailSender(
        IOptions<AppConfig> config,
        IHttpClientFactory httpClientFactory,
        ILogger<ResendEmailSender> logger)
    {
        _config = config.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var smtp = _config.Smtp ?? throw new InvalidOperationException("SMTP/Resend is not configured");
        var apiKey = smtp.Pass;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("SMTP_PASS (Resend API key) is required for Resend HTTPS sending");
        }

        var client = _httpClientFactory.CreateClient("resend");
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent.Create(new ResendSendRequest(
            From: smtp.From,
            To: [message.To],
            Subject: message.Subject,
            Text: message.Text));

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Resend API returned {(int)response.StatusCode}: {body}");
        }

        _logger.LogInformation("Sent email to {To} via Resend HTTPS API", message.To);
    }

    private sealed record ResendSendRequest(
        [property: JsonPropertyName("from")] string From,
        [property: JsonPropertyName("to")] string[] To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("text")] string Text);
}
