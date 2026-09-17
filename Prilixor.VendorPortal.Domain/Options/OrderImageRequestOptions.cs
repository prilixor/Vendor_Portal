namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>
/// How many labeled photo slots a vendor gets when a customer requests order photos.
/// Each option holds up to <see cref="ImagesPerOption"/> images. The customer then picks one option.
/// </summary>
public sealed class OrderImageRequestOptions
{
    public const string SectionName = "OrderImageRequest";

    /// <summary>Photos allowed under each option (Option 1, Option 2, …). Clamped to 1–10.</summary>
    public int ImagesPerOption { get; set; } = 3;

    /// <summary>Number of slots. 3 → Option 1/2/3. Clamped to 1–10.</summary>
    public int OptionCount { get; set; } = 3;

    /// <summary>Optional description under each option, in characters.</summary>
    public int MaxDescriptionLength { get; set; } = 500;

    public int ResolvedOptionCount => Math.Clamp(OptionCount, 1, 10);

    public int ResolvedImagesPerOption => Math.Clamp(ImagesPerOption, 1, 10);

    public int ResolvedMaxDescriptionLength => Math.Clamp(MaxDescriptionLength, 1, 2000);
}
