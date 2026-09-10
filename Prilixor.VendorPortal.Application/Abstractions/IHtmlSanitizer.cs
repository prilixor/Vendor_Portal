namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IHtmlSanitizer
{
    string Sanitize(string? html);
    string MarkdownToSanitizedHtml(string? markdown);
}
