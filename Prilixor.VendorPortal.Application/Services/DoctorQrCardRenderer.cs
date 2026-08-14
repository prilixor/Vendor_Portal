using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Server-side match of the Admin "Download card" layout (760×1020 branded card).
/// </summary>
internal static class DoctorQrCardRenderer
{
    private const int Width = 760;
    private const int Height = 1020;

    public static byte[] Render(byte[] qrPng, string fullName, string uniqueCode, string? specialization)
    {
        using var image = new Image<Rgba32>(Width, Height);
        using var qr = Image.Load<Rgba32>(qrPng);

        var sans = ResolveFamily("Arial", "Segoe UI", "DejaVu Sans", "Liberation Sans", "FreeSans");
        var mono = ResolveFamily("Consolas", "Cascadia Mono", "DejaVu Sans Mono", "Courier New", "Liberation Mono");

        var brandFont = sans.CreateFont(18, FontStyle.Bold);
        var nameFont = sans.CreateFont(36, FontStyle.Bold);
        var specFont = sans.CreateFont(20, FontStyle.Regular);
        var cardLabelFont = sans.CreateFont(14, FontStyle.Bold);
        var uniqueLabelFont = sans.CreateFont(13, FontStyle.Bold);
        var uniqueValueFont = mono.CreateFont(34, FontStyle.Bold);
        var scanFont = sans.CreateFont(18, FontStyle.Regular);
        var hintFont = sans.CreateFont(14, FontStyle.Regular);
        var footerFont = sans.CreateFont(13, FontStyle.Bold);

        const int cardX = 48;
        const int cardY = 56;
        const int cardW = Width - 96;
        const int cardH = Height - 120;
        const int headerH = 210;
        const int pillY = cardY + headerH + 36;
        const int qrSize = 340;
        var qrX = (Width - qrSize) / 2;
        var qrY = pillY + 128;

        image.Mutate(ctx =>
        {
            ctx.Fill(Color.ParseHex("0b1f1c"));

            ctx.Fill(Color.White, RoundedRect(cardX, cardY, cardW, cardH, 36));

            ctx.Fill(Color.ParseHex("0f766e"), RoundedRect(cardX, cardY, cardW, headerH, 36));
            ctx.Fill(Color.ParseHex("0f766e"), new RectangularPolygon(cardX, cardY + headerH - 36, cardW, 36));

            DrawText(ctx, "BLINKSMED", brandFont, Color.ParseHex("ccfbf1"), cardX + 40, cardY + 28);
            DrawText(
                ctx,
                Truncate(fullName.Trim().Length == 0 ? "Doctor" : fullName.Trim(), nameFont, cardW - 80),
                nameFont,
                Color.White,
                cardX + 40,
                cardY + 68);

            if (!string.IsNullOrWhiteSpace(specialization))
            {
                DrawText(
                    ctx,
                    Truncate(specialization.Trim(), specFont, cardW - 80),
                    specFont,
                    Color.ParseHex("ccfbf1"),
                    cardX + 40,
                    cardY + 116);
            }

            DrawText(ctx, "DOCTOR REFERENCE CARD", cardLabelFont, Color.ParseHex("e6fffa"), cardX + 40, cardY + 160);

            var pill = RoundedRect(cardX + 40, pillY, cardW - 80, 92, 20);
            ctx.Fill(Color.ParseHex("f0fdfa"), pill);
            ctx.Draw(Color.ParseHex("99f6e4"), 2f, pill);

            DrawText(ctx, "UNIQUE ID", uniqueLabelFont, Color.ParseHex("0f766e"), cardX + 64, pillY + 16);
            DrawText(ctx, uniqueCode, uniqueValueFont, Color.ParseHex("134e4a"), cardX + 64, pillY + 44);

            var qrFrame = RoundedRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
            ctx.Fill(Color.White, qrFrame);
            ctx.Draw(Color.ParseHex("e2e8f0"), 2f, qrFrame);
        });

        qr.Mutate(x => x.Resize(qrSize, qrSize));
        image.Mutate(ctx => ctx.DrawImage(qr, new Point(qrX, qrY), 1f));

        image.Mutate(ctx =>
        {
            DrawCentered(ctx, "Scan to open doctor profile on BlinksMed", scanFont, Color.ParseHex("475569"), Width / 2f, qrY + qrSize + 40);
            DrawCentered(ctx, "Patients use this Unique ID at checkout (optional)", hintFont, Color.ParseHex("94a3b8"), Width / 2f, qrY + qrSize + 68);
            DrawCentered(ctx, "blinksmed · medical equipment rentals", footerFont, Color.ParseHex("99f6e1"), Width / 2f, Height - 42);
        });

        using var ms = new MemoryStream();
        image.SaveAsPng(ms);
        return ms.ToArray();
    }

    private static void DrawText(IImageProcessingContext ctx, string text, Font font, Color color, float x, float y)
    {
        ctx.DrawText(new RichTextOptions(font)
        {
            Origin = new PointF(x, y),
            HorizontalAlignment = HorizontalAlignment.Left,
            VerticalAlignment = VerticalAlignment.Top,
        }, text, color);
    }

    private static void DrawCentered(IImageProcessingContext ctx, string text, Font font, Color color, float x, float y)
    {
        ctx.DrawText(new RichTextOptions(font)
        {
            Origin = new PointF(x, y),
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Top,
        }, text, color);
    }

    private static string Truncate(string text, Font font, float maxWidth)
    {
        var options = new TextOptions(font);
        if (TextMeasurer.MeasureSize(text, options).Width <= maxWidth)
            return text;

        var t = text;
        while (t.Length > 1)
        {
            var candidate = t + "…";
            if (TextMeasurer.MeasureSize(candidate, options).Width <= maxWidth)
                return candidate;
            t = t[..^1];
        }

        return "…";
    }

    private static IPath RoundedRect(float x, float y, float w, float h, float radius)
    {
        var r = Math.Min(radius, Math.Min(w, h) / 2f);
        const float k = 0.5522847498f;
        var c = r * k;
        return new PathBuilder()
            .StartFigure()
            .AddLine(new PointF(x + r, y), new PointF(x + w - r, y))
            .AddCubicBezier(new PointF(x + w - r, y), new PointF(x + w - r + c, y), new PointF(x + w, y + r - c), new PointF(x + w, y + r))
            .AddLine(new PointF(x + w, y + r), new PointF(x + w, y + h - r))
            .AddCubicBezier(new PointF(x + w, y + h - r), new PointF(x + w, y + h - r + c), new PointF(x + w - r + c, y + h), new PointF(x + w - r, y + h))
            .AddLine(new PointF(x + w - r, y + h), new PointF(x + r, y + h))
            .AddCubicBezier(new PointF(x + r, y + h), new PointF(x + r - c, y + h), new PointF(x, y + h - r + c), new PointF(x, y + h - r))
            .AddLine(new PointF(x, y + h - r), new PointF(x, y + r))
            .AddCubicBezier(new PointF(x, y + r), new PointF(x, y + r - c), new PointF(x + r - c, y), new PointF(x + r, y))
            .CloseFigure()
            .Build();
    }

    private static FontFamily ResolveFamily(params string[] names)
    {
        foreach (var name in names)
        {
            if (SystemFonts.TryGet(name, out var family))
                return family;
        }

        return SystemFonts.Collection.Families.First();
    }
}
