namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>
/// How many labeled photo slots a vendor gets when a customer requests order photos.
/// Each option holds exactly one image.
/// </summary>
public sealed class OrderImageRequestOptions
{
    public const string SectionName = "OrderImageRequest";

    /// <summary>One photo per option (Option 1, Option 2, …).</summary>
    public const int ImagesPerOption = 1;

    /// <summary>Number of slots. 3 → 3 photos; 5 → 5 photos. Clamped to 1–10.</summary>
    public int OptionCount { get; set; } = 3;

    /// <summary>Optional description under each option, in characters.</summary>
    public int MaxDescriptionLength { get; set; } = 500;

    public int ResolvedOptionCount => Math.Clamp(OptionCount, 1, 10);

    public int ResolvedMaxDescriptionLength => Math.Clamp(MaxDescriptionLength, 1, 2000);
}
