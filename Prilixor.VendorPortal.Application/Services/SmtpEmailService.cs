using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

public class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public bool EnableSsl { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
}

public class SmtpEmailService : IEmailService
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<SmtpOptions> options, ILogger<SmtpEmailService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task SendEmailAsync(string toEmail, string subject, string body, CancellationToken ct = default) =>
        SendEmailAsync(toEmail, subject, body, null, null, null, ct);

    public async Task SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody,
        IReadOnlyList<EmailInlineImage>? inlineImages,
        IReadOnlyList<EmailFileAttachment>? attachments,
        CancellationToken ct = default)
    {
        try
        {
            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.EnableSsl,
                Credentials = new NetworkCredential(_options.Username, _options.Password)
            };

            using var mailMessage = SmtpMailMessageFactory.Create(
                _options.FromEmail,
                _options.FromName,
                toEmail,
                subject,
                htmlBody,
                plainTextBody,
                inlineImages,
                attachments);

            await client.SendMailAsync(mailMessage, ct);
            _logger.LogInformation("Email sent successfully to {ToEmail}", toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail}", toEmail);
            throw;
        }
    }
}
