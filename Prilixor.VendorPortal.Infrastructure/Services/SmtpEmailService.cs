using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public class SmtpEmailService(IOptions<SmtpOptions> smtpOptions) : IEmailService
{
    public async Task SendEmailAsync(string toEmail, string subject, string body, CancellationToken ct = default)
    {
        var smtp = smtpOptions.Value;

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(smtp.FromEmail, smtp.FromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        mailMessage.To.Add(toEmail);

        using var smtpClient = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = smtp.EnableSsl,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(smtp.Username, smtp.Password)
        };

        await smtpClient.SendMailAsync(mailMessage, ct);
    }
}
