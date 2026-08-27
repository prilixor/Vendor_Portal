namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record EmailInlineImage(
    string ContentId,
    byte[] Content,
    string MediaType = "image/png",
    string? FileName = null);

public sealed record EmailFileAttachment(
    string FileName,
    byte[] Content,
    string MediaType = "application/octet-stream");

public interface IEmailService
{
    Task SendEmailAsync(
        string toEmail,
        string subject,
        string body,
        CancellationToken ct = default,
        string? fromDisplayName = null);

    Task SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody,
        IReadOnlyList<EmailInlineImage>? inlineImages,
        IReadOnlyList<EmailFileAttachment>? attachments,
        CancellationToken ct = default,
        string? fromDisplayName = null);
}
