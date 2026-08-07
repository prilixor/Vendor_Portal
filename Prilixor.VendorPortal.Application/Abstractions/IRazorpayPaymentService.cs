namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record RazorpayOrderCreateResult(string OrderId, long AmountPaise, string Currency, string Receipt);

public sealed record RazorpayPaymentLinkCreateResult(
    string PaymentLinkId,
    string ShortUrl,
    string? OrderId);

public interface IRazorpayPaymentService
{
    bool IsConfigured { get; }
    string KeyId { get; }

    Task<RazorpayOrderCreateResult> CreateOrderAsync(
        long amountPaise,
        string currency,
        string receipt,
        IReadOnlyDictionary<string, string>? notes,
        CancellationToken cancellationToken);

    Task<RazorpayPaymentLinkCreateResult> CreatePaymentLinkAsync(
        long amountPaise,
        string currency,
        string description,
        string customerName,
        string customerEmail,
        string? customerPhone,
        string referenceId,
        string callbackUrl,
        IReadOnlyDictionary<string, string>? notes,
        CancellationToken cancellationToken);

    bool VerifyPaymentSignature(string razorpayOrderId, string razorpayPaymentId, string razorpaySignature);

    bool VerifyWebhookSignature(string rawBody, string signatureHeader);
}
