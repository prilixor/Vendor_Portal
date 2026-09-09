using Ganss.Xss;
using Markdig;
using Prilixor.Shared.Abstractions.DI;
using Prilixor.VendorPortal.Application.Abstractions;
using AppHtmlSanitizer = Prilixor.VendorPortal.Application.Abstractions.IHtmlSanitizer;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class LegalHtmlSanitizer : AppHtmlSanitizer, ISingletonService
{
    private readonly HtmlSanitizer _sanitizer;
    private readonly MarkdownPipeline _markdown;

    public LegalHtmlSanitizer()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedTags.Clear();
        foreach (var tag in new[]
                 {
                     "h1", "h2", "h3", "h4", "h5", "h6",
                     "p", "br", "hr",
                     "strong", "b", "em", "i", "u", "s",
                     "ul", "ol", "li",
                     "a",
                     "blockquote",
                     "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
                     "span", "div",
                 })
        {
            _sanitizer.AllowedTags.Add(tag);
        }

        _sanitizer.AllowedAttributes.Clear();
        foreach (var attr in new[] { "href", "title", "target", "rel", "colspan", "rowspan", "class", "style" })
        {
            _sanitizer.AllowedAttributes.Add(attr);
        }

        _sanitizer.AllowedTags.Remove("template");
        _sanitizer.AllowedTags.Remove("script");
        _sanitizer.AllowedTags.Remove("iframe");
        _sanitizer.AllowedAttributes.Remove("shadowrootmode");
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.Add("https");
        _sanitizer.AllowedSchemes.Add("http");
        _sanitizer.AllowedSchemes.Add("mailto");

        _sanitizer.AllowedCssProperties.Clear();
        foreach (var css in new[] { "text-align", "width", "min-width", "border", "border-collapse", "padding", "background-color" })
        {
            _sanitizer.AllowedCssProperties.Add(css);
        }

        _markdown = new MarkdownPipelineBuilder()
            .UseAdvancedExtensions()
            .Build();
    }

    public string Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        return _sanitizer.Sanitize(html);
    }

    public string MarkdownToSanitizedHtml(string? markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
            return string.Empty;

        var html = Markdown.ToHtml(markdown, _markdown);
        return Sanitize(html);
    }
}
