using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public class SmtpEmailService(IOptions<Domain.Options.SmtpOptions> smtpOptions) : IEmailService
{
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
        var smtp = smtpOptions.Value;

        using var mailMessage = SmtpMailMessageFactory.Create(
            smtp.FromEmail,
            smtp.FromName,
            toEmail,
            subject,
            htmlBody,
            plainTextBody,
            inlineImages,
            attachments);

        using var smtpClient = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = smtp.EnableSsl,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(smtp.Username, smtp.Password)
        };

        await smtpClient.SendMailAsync(mailMessage, ct);
    }
}
