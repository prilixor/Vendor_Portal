using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Builds SMTP messages with optional plain-text part, CID inline images, and file attachments.
/// Gmail and most mobile clients block data-URI images; CID / attachments are the reliable path.
/// </summary>
public static class SmtpMailMessageFactory
{
    public static MailMessage Create(
        string fromEmail,
        string fromName,
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody = null,
        IReadOnlyList<EmailInlineImage>? inlineImages = null,
        IReadOnlyList<EmailFileAttachment>? attachments = null)
    {
        var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            IsBodyHtml = true,
        };
        message.To.Add(toEmail);

        var hasInline = inlineImages is { Count: > 0 };
        var hasPlain = !string.IsNullOrWhiteSpace(plainTextBody);
        var hasFiles = attachments is { Count: > 0 };

        if (!hasInline && !hasPlain && !hasFiles)
        {
            message.Body = htmlBody;
            return message;
        }

        if (hasPlain)
        {
            message.AlternateViews.Add(
                AlternateView.CreateAlternateViewFromString(plainTextBody!, Encoding.UTF8, MediaTypeNames.Text.Plain));
        }

        var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, MediaTypeNames.Text.Html);
        if (hasInline)
        {
            foreach (var img in inlineImages!)
            {
                if (img.Content is not { Length: > 0 } || string.IsNullOrWhiteSpace(img.ContentId))
                    continue;

                var resource = new LinkedResource(new MemoryStream(img.Content), new ContentType(img.MediaType))
                {
                    ContentId = img.ContentId,
                    TransferEncoding = TransferEncoding.Base64,
                    ContentType = { Name = img.FileName ?? $"{img.ContentId}.png" },
                };
                htmlView.LinkedResources.Add(resource);
            }
        }

        message.AlternateViews.Add(htmlView);

        if (hasFiles)
        {
            foreach (var file in attachments!)
            {
                if (file.Content is not { Length: > 0 } || string.IsNullOrWhiteSpace(file.FileName))
                    continue;

                message.Attachments.Add(new Attachment(
                    new MemoryStream(file.Content),
                    file.FileName,
                    file.MediaType));
            }
        }

        return message;
    }
}
