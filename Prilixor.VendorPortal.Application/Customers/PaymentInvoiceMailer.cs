using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

/// <summary>
/// Emails a payment receipt after Razorpay confirms a checkout or a rental extension.
/// Phone-only customers are skipped. A mail failure must not undo the payment.
/// </summary>
internal static class PaymentInvoiceMailer
{
    private static readonly CultureInfo In = CultureInfo.GetCultureInfo("en-IN");

    public static Task SendOrderPaymentAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerCheckoutSession session,
        CancellationToken cancellationToken) =>
        SendSafeAsync(logger, session.Id, () => SendOrderPaymentCoreAsync(customers, email, session, cancellationToken));

    public static Task SendExtensionPaymentAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerCheckoutSession session,
        CustomerRentalOrderExtension extension,
        string? razorpayPaymentId,
        CancellationToken cancellationToken) =>
        SendSafeAsync(logger, extension.Id, () => SendExtensionPaymentCoreAsync(
            customers, email, session, extension, razorpayPaymentId, cancellationToken));

    /// <summary>
    /// Asks the customer to pay, using the same branded mail as the payment receipt.
    /// A mail failure must not undo the payment link.
    /// </summary>
    public static async Task SendPaymentLinkAsync(
        IEmailService email,
        ILogger logger,
        Customer customer,
        string paymentUrl,
        decimal amount,
        IReadOnlyList<CustomerOrderDto> orders,
        CancellationToken cancellationToken)
    {
        if (!HasEmail(customer.Email) || string.IsNullOrWhiteSpace(paymentUrl))
        {
            logger.LogWarning(
                "Payment link was created for customer {CustomerId} but no email was sent.",
                customer.Id);
            return;
        }

        try
        {
            var model = new PaymentRequestDocument(customer, paymentUrl.Trim(), amount, orders);
            await email.SendEmailAsync(
                customer.Email!.Trim(),
                orders.Count == 1
                    ? $"Complete payment for order {orders[0].OrderNumber}"
                    : "Complete payment for your BlinksMed order",
                PaymentRequestHtml.Render(model),
                PaymentRequestHtml.RenderPlain(model),
                null,
                null,
                cancellationToken,
                "BlinksMed");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Payment link for customer {CustomerId} was created but the email was not sent.", customer.Id);
        }
    }

    /// <summary>
    /// Receipt after admin sends a cancellation refund. A mail failure must not undo the refund.
    /// </summary>
    public static Task SendCancellationRefundAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerRentalOrder order,
        CustomerOrderCancellationRefund refund,
        CancellationToken cancellationToken) =>
        SendSafeAsync(logger, refund.Id, () => SendCancellationRefundCoreAsync(
            customers, email, logger, order, refund, cancellationToken));

    /// <summary>
    /// Receipt after admin sends a deposit refund. A mail failure must not undo the refund.
    /// </summary>
    public static Task SendDepositRefundAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerRentalOrder order,
        CustomerOrderReturn refund,
        CancellationToken cancellationToken) =>
        SendSafeAsync(logger, refund.Id, () => SendDepositRefundCoreAsync(
            customers, email, logger, order, refund, cancellationToken));

    private static async Task SendSafeAsync(ILogger logger, Guid referenceId, Func<Task> send)
    {
        try
        {
            await send();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Payment {ReferenceId} succeeded but the invoice email was not sent.", referenceId);
        }
    }

    private static async Task SendOrderPaymentCoreAsync(
        ICustomerRepository customers,
        IEmailService email,
        CustomerCheckoutSession session,
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(session.CustomerId, cancellationToken);
        if (!HasEmail(customer?.Email))
            return;

        var orders = await customers.GetOrdersByCheckoutSessionIdAsync(session.Id, cancellationToken);
        var lines = new List<InvoiceLine>();
        CustomerAddress? address = null;
        foreach (var order in orders.OrderBy(o => o.OrderNumber, StringComparer.Ordinal))
        {
            var row = await customers.GetCustomerOrderByIdAsync(order.Id, cancellationToken);
            var source = row?.Order ?? order;
            var title = row?.Listing?.ListingTitle;
            if (!string.IsNullOrWhiteSpace(row?.VariantDescription))
                title = string.IsNullOrWhiteSpace(title) ? row!.VariantDescription : $"{title} ({row.VariantDescription})";
            var vendor = row?.Listing?.Vendor?.Profile?.BusinessName;
            if (string.IsNullOrWhiteSpace(vendor))
                vendor = row?.Listing?.Vendor?.Email;
            lines.Add(InvoiceLine.FromOrder(source, title, vendor));

            if (address is null && source.CustomerAddressId is Guid addressId)
                address = await customers.GetCustomerAddressByIdAsync(source.CustomerId, addressId, cancellationToken);
        }

        if (lines.Count == 0)
            return;

        var paidAt = session.PaidAt ?? DateTimeOffset.UtcNow;
        var invoiceNo = InvoiceNumber("INV", paidAt, session.Id);
        var amountPaid = session.Amount > 0 ? session.Amount : lines.Sum(l => l.Total);
        var model = new InvoiceDocument(
            invoiceNo,
            "Order payment",
            paidAt,
            session.RazorpayPaymentId,
            customer!,
            address,
            lines,
            amountPaid,
            IsExtension: false);

        var orderSubject = lines.Count == 1
            ? $"Payment received · order {lines[0].OrderNumber}"
            : $"Payment received · {lines.Count} items";
        await email.SendEmailAsync(
            customer!.Email!.Trim(),
            orderSubject,
            PaymentInvoiceHtml.Render(model),
            PaymentInvoiceHtml.RenderPlain(model),
            null,
            null,
            cancellationToken,
            "BlinksMed");
    }

    private static async Task SendExtensionPaymentCoreAsync(
        ICustomerRepository customers,
        IEmailService email,
        CustomerCheckoutSession session,
        CustomerRentalOrderExtension extension,
        string? razorpayPaymentId,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(extension.CustomerRentalOrderId, cancellationToken);
        var order = row?.Order;
        if (order is null)
            return;

        var customer = await customers.GetCustomerByIdAsync(order.CustomerId, cancellationToken);
        if (!HasEmail(customer?.Email))
            return;

        CustomerAddress? address = null;
        if (order.CustomerAddressId is Guid addressId)
            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, addressId, cancellationToken);

        var title = row?.Listing?.ListingTitle;
        if (!string.IsNullOrWhiteSpace(row?.VariantDescription))
            title = string.IsNullOrWhiteSpace(title) ? row!.VariantDescription : $"{title} ({row.VariantDescription})";
        var vendor = row?.Listing?.Vendor?.Profile?.BusinessName;
        if (string.IsNullOrWhiteSpace(vendor))
            vendor = row?.Listing?.Vendor?.Email;

        var line = InvoiceLine.FromExtension(order, extension, title, vendor);
        var paidAt = session.PaidAt ?? DateTimeOffset.UtcNow;
        var invoiceNo = InvoiceNumber("INV-EXT", paidAt, extension.Id);
        var model = new InvoiceDocument(
            invoiceNo,
            "Rental extension",
            paidAt,
            string.IsNullOrWhiteSpace(razorpayPaymentId) ? session.RazorpayPaymentId : razorpayPaymentId,
            customer!,
            address,
            [line],
            extension.TotalAmount > 0 ? extension.TotalAmount : session.Amount,
            IsExtension: true);

        var extensionSubject = string.IsNullOrWhiteSpace(order.OrderNumber)
            ? "Payment received · rental extension"
            : $"Payment received · extension for {order.OrderNumber}";
        await email.SendEmailAsync(
            customer!.Email!.Trim(),
            extensionSubject,
            PaymentInvoiceHtml.Render(model),
            PaymentInvoiceHtml.RenderPlain(model),
            null,
            null,
            cancellationToken,
            "BlinksMed");
    }

    private static async Task SendCancellationRefundCoreAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerRentalOrder order,
        CustomerOrderCancellationRefund refund,
        CancellationToken cancellationToken)
    {
        if (refund.RefundAmount <= 0)
            return;

        var customer = await customers.GetCustomerByIdAsync(order.CustomerId, cancellationToken);
        if (!HasEmail(customer?.Email))
        {
            logger.LogWarning(
                "Refund for order {OrderNumber} was sent but the customer has no email.",
                order.OrderNumber);
            return;
        }

        var title = await ProductTitleAsync(customers, order.Id, cancellationToken);
        var sentAt = refund.RefundedAt ?? DateTimeOffset.UtcNow;
        var reference = FirstReference(refund.RazorpayRefundId, refund.RefundReference);
        var cancelledByCustomer = string.Equals(refund.ActorRole, CancellationActors.Customer, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(refund.Outcome, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase);
        var dispatchFailed = string.Equals(refund.Outcome, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase);
        var intro = dispatchFailed
            ? "No vendor accepted this product, so it was not fulfilled. Your refund has been sent. This email is your receipt."
            : cancelledByCustomer
                ? "You cancelled this order. Your refund has been sent. This email is your receipt."
                : "This order was cancelled. Your refund has been sent. This email is your receipt.";
        var model = new RefundReceiptDocument(
            InvoiceNumber("RFD", sentAt, refund.Id),
            "Order refund",
            intro,
            customer!,
            order.OrderNumber,
            title,
            "Amount paid",
            refund.PaidAmount,
            refund.ExtensionPaidAmount > 0 ? refund.ExtensionPaidAmount : null,
            refund.ChargeAmount > 0 ? "Charge kept" : null,
            refund.ChargeAmount,
            refund.ChargeAmount > 0 ? refund.ChargeReason : null,
            refund.RefundAmount,
            sentAt,
            reference,
            MethodNote(refund.RefundMethod));

        await email.SendEmailAsync(
            customer!.Email!.Trim(),
            string.IsNullOrWhiteSpace(order.OrderNumber)
                ? "Refund sent for your BlinksMed order"
                : $"Refund sent · order {order.OrderNumber}",
            RefundReceiptHtml.Render(model),
            RefundReceiptHtml.RenderPlain(model),
            null,
            null,
            cancellationToken,
            "BlinksMed");
    }

    private static async Task SendDepositRefundCoreAsync(
        ICustomerRepository customers,
        IEmailService email,
        ILogger logger,
        CustomerRentalOrder order,
        CustomerOrderReturn refund,
        CancellationToken cancellationToken)
    {
        if (refund.RefundAmount <= 0)
            return;

        var customer = await customers.GetCustomerByIdAsync(order.CustomerId, cancellationToken);
        if (!HasEmail(customer?.Email))
        {
            logger.LogWarning(
                "Deposit refund for order {OrderNumber} was sent but the customer has no email.",
                order.OrderNumber);
            return;
        }

        var title = await ProductTitleAsync(customers, order.Id, cancellationToken);
        var sentAt = refund.RefundedAt ?? DateTimeOffset.UtcNow;
        var model = new RefundReceiptDocument(
            InvoiceNumber("DEP", sentAt, refund.Id),
            "Deposit refund",
            "Your item has been returned. The deposit refund below has been sent. This email is your receipt.",
            customer!,
            order.OrderNumber,
            title,
            "Deposit held",
            refund.DepositAmount,
            null,
            refund.DamageAmount > 0 ? "Damage charge" : null,
            refund.DamageAmount,
            refund.DamageAmount > 0 ? refund.DamageReason : null,
            refund.RefundAmount,
            sentAt,
            FirstReference(refund.RazorpayRefundId, refund.RefundReference),
            MethodNote(refund.RefundMethod));

        await email.SendEmailAsync(
            customer!.Email!.Trim(),
            string.IsNullOrWhiteSpace(order.OrderNumber)
                ? "Deposit refund sent for your BlinksMed order"
                : $"Deposit refund sent · order {order.OrderNumber}",
            RefundReceiptHtml.Render(model),
            RefundReceiptHtml.RenderPlain(model),
            null,
            null,
            cancellationToken,
            "BlinksMed");
    }

    private static async Task<string> ProductTitleAsync(
        ICustomerRepository customers,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        var title = row?.Listing?.ListingTitle;
        if (!string.IsNullOrWhiteSpace(row?.VariantDescription))
            title = string.IsNullOrWhiteSpace(title) ? row!.VariantDescription : $"{title} ({row.VariantDescription})";
        return string.IsNullOrWhiteSpace(title) ? "Item" : title.Trim();
    }

    private static string? FirstReference(string? primary, string? fallback)
    {
        var value = string.IsNullOrWhiteSpace(primary) ? fallback : primary;
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string MethodNote(string? method)
    {
        if (string.Equals(method, OrderRefundMethods.Manual, StringComparison.OrdinalIgnoreCase))
            return "This refund was paid outside the original card payment. Use the reference above if you need to trace it.";
        return "The amount goes back through the original payment. It can take a few working days to appear in your account.";
    }

    private static bool HasEmail(string? email)
    {
        var value = email?.Trim();
        return !string.IsNullOrWhiteSpace(value) && value.Contains('@');
    }

    private static string InvoiceNumber(string prefix, DateTimeOffset paidAt, Guid id)
    {
        var stamp = ToIndia(paidAt).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        return $"{prefix}-{stamp}-{id.ToString("N")[..8].ToUpperInvariant()}";
    }

    internal static DateTimeOffset ToIndia(DateTimeOffset instant)
    {
        TimeZoneInfo zone;
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById("India Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }
        catch (InvalidTimeZoneException)
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }

        return TimeZoneInfo.ConvertTime(instant, zone);
    }

    private static string Money(decimal amount) => "₹" + amount.ToString("N2", In);

    private sealed record InvoiceLine(
        string OrderNumber,
        string Title,
        string? VendorName,
        string Kind,
        int Quantity,
        string Period,
        decimal ProductAmount,
        decimal DepositAmount,
        decimal ServiceFeeAmount,
        decimal DistanceFeeAmount,
        decimal ExpressFeeAmount,
        decimal GstAmount,
        decimal Total,
        string? ExtensionNote)
    {
        public static InvoiceLine FromOrder(CustomerRentalOrder order, string? title, string? vendor)
        {
            var buy = string.Equals(order.OrderType, "buy", StringComparison.OrdinalIgnoreCase);
            var period = buy
                ? "Purchase"
                : DescribeRental(order.RentalDurationLabel, order.RentalDays, order.StartDate, order.EndDate);
            return new InvoiceLine(
                order.OrderNumber,
                string.IsNullOrWhiteSpace(title) ? "Item" : title.Trim(),
                string.IsNullOrWhiteSpace(vendor) ? null : vendor.Trim(),
                buy ? "Buy" : "Rent",
                order.Quantity,
                period,
                order.SubtotalAmount,
                order.DepositAmount,
                PlatformFee(order),
                order.DistanceFeeAmount,
                order.ExpressFeeAmount,
                order.GstAmount,
                order.TotalAmount,
                null);
        }

        public static InvoiceLine FromExtension(
            CustomerRentalOrder order,
            CustomerRentalOrderExtension extension,
            string? title,
            string? vendor)
        {
            var from = extension.OriginalEndDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
            var to = extension.NewEndDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
            var days = extension.AdditionalDays;
            return new InvoiceLine(
                order.OrderNumber,
                string.IsNullOrWhiteSpace(title) ? "Item" : title.Trim(),
                string.IsNullOrWhiteSpace(vendor) ? null : vendor.Trim(),
                "Extension",
                order.Quantity,
                $"{days} extra day{(days == 1 ? "" : "s")}",
                extension.ExtensionAmount,
                0,
                extension.ServiceFeeAmount,
                0,
                0,
                extension.GstAmount,
                extension.TotalAmount,
                $"End date moves from {from} to {to}.");
        }

        private static decimal PlatformFee(CustomerRentalOrder order)
        {
            var platform = order.ServiceFeeAmount - order.DistanceFeeAmount - order.ExpressFeeAmount;
            return platform > 0 ? platform : 0;
        }

        private static string DescribeRental(string? label, int days, DateOnly? start, DateOnly? end)
        {
            var range = start is null && end is null
                ? null
                : $"{start?.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) ?? "—"} to {end?.ToString("dd MMM yyyy", CultureInfo.InvariantCulture) ?? "—"}";
            var dayText = $"{days} day{(days == 1 ? "" : "s")}";
            if (!string.IsNullOrWhiteSpace(label) && range is not null)
                return $"{label.Trim()} · {dayText} · {range}";
            if (!string.IsNullOrWhiteSpace(label))
                return $"{label.Trim()} · {dayText}";
            return range is null ? dayText : $"{dayText} · {range}";
        }
    }

    private sealed record InvoiceDocument(
        string InvoiceNumber,
        string Kind,
        DateTimeOffset PaidAtUtc,
        string? PaymentId,
        Customer Customer,
        CustomerAddress? Address,
        IReadOnlyList<InvoiceLine> Lines,
        decimal AmountPaid,
        bool IsExtension);

    private static class PaymentInvoiceHtml
    {
        public static string Render(InvoiceDocument doc)
        {
            var paid = PaymentInvoiceMailer.ToIndia(doc.PaidAtUtc);
            var paidLabel = paid.ToString("dd MMM yyyy, h:mm tt", CultureInfo.InvariantCulture) + " IST";
            var sb = new StringBuilder();
            sb.Append("""
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>BlinksMed invoice</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#1c2430;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4eaf2;">
                        <tr><td style="background:#052A72;padding:28px 32px;">
                          <div style="color:#9ec0ff;font-size:12px;letter-spacing:2px;font-weight:700;">BLINKSMED</div>
                          <div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:6px;">Invoice</div>
                          <div style="color:#d6e4ff;font-size:14px;margin-top:4px;">
                """);
            sb.Append(E(doc.Kind));
            sb.Append("""
                           · Payment received</div>
                        </td></tr>
                        <tr><td style="padding:28px 32px 8px;">
                          <p style="margin:0 0 8px;font-size:16px;">Hi 
                """);
            sb.Append(E(doc.Customer.FullName));
            sb.Append("""
                ,</p>
                          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#3d4a5c;">
                """);
            sb.Append(doc.IsExtension
                ? "Your extension payment is received. This email is the invoice for the extra rental days only. The original order payment is a separate receipt."
                : "Your payment is received and your order is placed. This email is your invoice. Please keep it for your records. A vendor still needs to accept each product before it is prepared.");
            sb.Append("</p>");
            sb.Append(MetaTable(doc, paidLabel));
            sb.Append(BillTo(doc));
            sb.Append("<div style=\"margin:22px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.4px;color:#052A72;\">ITEMS IN THIS PAYMENT</div>");
            foreach (var line in doc.Lines)
                sb.Append(LineCard(line));
            sb.Append(Totals(doc));
            sb.Append(Notes(doc));
            sb.Append("""
                        </td></tr>
                        <tr><td style="padding:18px 32px 28px;background:#f7f9fc;border-top:1px solid #e4eaf2;">
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#5c6b7a;">Questions about this payment? Write to <a href="mailto:support@blinksmed.in" style="color:#052A72;">support@blinksmed.in</a>.</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#5c6b7a;">BlinksMed · 
                """);
            sb.Append(E(PublicSiteUrls.DefaultCustomerPortal));
            sb.Append("""
                </p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """);
            return sb.ToString();
        }

        public static string RenderPlain(InvoiceDocument doc)
        {
            var paid = PaymentInvoiceMailer.ToIndia(doc.PaidAtUtc);
            var sb = new StringBuilder();
            sb.AppendLine("BlinksMed invoice");
            sb.AppendLine(doc.Kind);
            sb.AppendLine($"Invoice: {doc.InvoiceNumber}");
            sb.AppendLine($"Paid: {paid:dd MMM yyyy, h:mm tt} IST");
            if (!string.IsNullOrWhiteSpace(doc.PaymentId))
                sb.AppendLine($"Payment reference: {doc.PaymentId}");
            sb.AppendLine();
            sb.AppendLine($"Billed to: {doc.Customer.FullName}");
            if (!string.IsNullOrWhiteSpace(doc.Customer.Phone))
                sb.AppendLine($"Phone: {doc.Customer.Phone}");
            sb.AppendLine($"Email: {doc.Customer.Email}");
            var address = FormatAddress(doc.Address);
            if (address is not null)
                sb.AppendLine($"Address: {address}");
            sb.AppendLine();
            foreach (var line in doc.Lines)
            {
                sb.AppendLine($"{line.Title} ({line.OrderNumber})");
                sb.AppendLine($"{line.Kind} · Qty {line.Quantity} · {line.Period}");
                if (!string.IsNullOrWhiteSpace(line.VendorName))
                    sb.AppendLine($"Fulfilled by: {line.VendorName}");
                if (line.ExtensionNote is not null)
                    sb.AppendLine(line.ExtensionNote);
                AppendPlainMoney(sb, "Product amount", line.ProductAmount);
                AppendPlainMoney(sb, "Security deposit", line.DepositAmount);
                AppendPlainMoney(sb, "Service fee", line.ServiceFeeAmount);
                AppendPlainMoney(sb, "Distance charge", line.DistanceFeeAmount);
                AppendPlainMoney(sb, "Express delivery", line.ExpressFeeAmount);
                AppendPlainMoney(sb, "GST", line.GstAmount);
                sb.AppendLine($"Line total: {Money(line.Total)}");
                sb.AppendLine();
            }

            sb.AppendLine($"Amount paid: {Money(doc.AmountPaid)}");
            sb.AppendLine();
            if (doc.IsExtension)
                sb.AppendLine("This invoice covers only the extra rental days. The original order payment is separate.");
            else if (doc.Lines.Any(l => l.DepositAmount > 0))
                sb.AppendLine("Security deposit is held with the rental and is refundable after the item is returned in good condition.");
            if (!doc.IsExtension && doc.Lines.Any(l => l.Kind == "Rent"))
                sb.AppendLine("The rental period begins when the item is delivered.");
            sb.AppendLine();
            sb.AppendLine("Support: support@blinksmed.in");
            return sb.ToString();
        }

        private static string MetaTable(InvoiceDocument doc, string paidLabel)
        {
            var sb = new StringBuilder();
            sb.Append("""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                  <tr>
                    <td style="width:50%;padding:10px 12px;background:#f7f9fc;border-radius:10px;">
                      <div style="font-size:11px;color:#5c6b7a;font-weight:700;">INVOICE NUMBER</div>
                      <div style="font-size:14px;font-weight:700;margin-top:3px;">
                """);
            sb.Append(E(doc.InvoiceNumber));
            sb.Append("""
                      </div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="width:50%;padding:10px 12px;background:#f7f9fc;border-radius:10px;">
                      <div style="font-size:11px;color:#5c6b7a;font-weight:700;">PAID ON</div>
                      <div style="font-size:14px;font-weight:700;margin-top:3px;">
                """);
            sb.Append(E(paidLabel));
            sb.Append("""
                      </div>
                    </td>
                  </tr>
                </table>
                """);
            if (!string.IsNullOrWhiteSpace(doc.PaymentId))
            {
                sb.Append("""
                    <p style="margin:0 0 18px;font-size:13px;color:#3d4a5c;">Payment reference: <strong>
                    """);
                sb.Append(E(doc.PaymentId));
                sb.Append("</strong></p>");
            }

            return sb.ToString();
        }

        private static string BillTo(InvoiceDocument doc)
        {
            var sb = new StringBuilder();
            sb.Append("""
                <div style="border:1px solid #e4eaf2;border-radius:12px;padding:14px 16px;margin-bottom:8px;">
                  <div style="font-size:11px;color:#5c6b7a;font-weight:700;letter-spacing:0.4px;">BILLED TO</div>
                  <div style="font-size:16px;font-weight:700;margin-top:4px;">
                """);
            sb.Append(E(doc.Customer.FullName));
            sb.Append("</div>");
            if (!string.IsNullOrWhiteSpace(doc.Customer.Phone))
            {
                sb.Append("<div style=\"font-size:13px;color:#3d4a5c;margin-top:2px;\">");
                sb.Append(E(doc.Customer.Phone));
                sb.Append("</div>");
            }

            sb.Append("<div style=\"font-size:13px;color:#3d4a5c;margin-top:2px;\">");
            sb.Append(E(doc.Customer.Email));
            sb.Append("</div>");
            var address = FormatAddress(doc.Address);
            if (address is not null)
            {
                sb.Append("<div style=\"font-size:13px;color:#3d4a5c;margin-top:2px;\">");
                sb.Append(E(address));
                sb.Append("</div>");
            }

            sb.Append("</div>");
            return sb.ToString();
        }

        private static string LineCard(InvoiceLine line)
        {
            var sb = new StringBuilder();
            sb.Append("""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4eaf2;border-radius:12px;margin-top:10px;">
                  <tr><td style="padding:14px 16px;">
                    <div style="font-size:15px;font-weight:700;">
                """);
            sb.Append(E(line.Title));
            sb.Append("""
                    </div>
                    <div style="font-size:12px;color:#5c6b7a;margin-top:3px;">
                """);
            sb.Append(E($"{line.OrderNumber} · {line.Kind} · Qty {line.Quantity}"));
            sb.Append("</div><div style=\"font-size:13px;color:#3d4a5c;margin-top:4px;\">");
            sb.Append(E(line.Period));
            sb.Append("</div>");
            if (!string.IsNullOrWhiteSpace(line.VendorName))
            {
                sb.Append("<div style=\"font-size:12px;color:#5c6b7a;margin-top:3px;\">Fulfilled by ");
                sb.Append(E(line.VendorName));
                sb.Append("</div>");
            }

            if (line.ExtensionNote is not null)
            {
                sb.Append("<div style=\"margin-top:8px;background:#fff7e8;border-radius:8px;padding:8px 10px;font-size:13px;color:#7a4b00;\">");
                sb.Append(E(line.ExtensionNote));
                sb.Append("</div>");
            }

            sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:10px;\">");
            AppendHtmlMoney(sb, line.Kind == "Buy" ? "Purchase price" : line.Kind == "Extension" ? "Extension rent" : "Rental amount", line.ProductAmount);
            AppendHtmlMoney(sb, "Security deposit", line.DepositAmount);
            AppendHtmlMoney(sb, "Service fee", line.ServiceFeeAmount);
            AppendHtmlMoney(sb, "Distance charge", line.DistanceFeeAmount);
            AppendHtmlMoney(sb, "Express delivery", line.ExpressFeeAmount);
            AppendHtmlMoney(sb, "GST", line.GstAmount);
            sb.Append("<tr><td style=\"padding-top:8px;font-size:13px;font-weight:700;\">Line total</td><td align=\"right\" style=\"padding-top:8px;font-size:13px;font-weight:700;\">");
            sb.Append(E(Money(line.Total)));
            sb.Append("</td></tr></table></td></tr></table>");
            return sb.ToString();
        }

        private static string Totals(InvoiceDocument doc)
        {
            return $"""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f3faf0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;color:#1c2430;">Amount paid</td>
                    <td align="right" style="padding:16px 18px;font-size:22px;font-weight:700;color:#2f7d08;">{E(Money(doc.AmountPaid))}</td>
                  </tr>
                </table>
                """;
        }

        private static string Notes(InvoiceDocument doc)
        {
            var sb = new StringBuilder();
            sb.Append("<div style=\"margin-top:16px;font-size:12px;line-height:1.55;color:#5c6b7a;\">");
            if (doc.IsExtension)
                sb.Append("This invoice covers only the extra days on this product. Your original order payment is a separate receipt. The security deposit is not charged again.");
            else
            {
                if (doc.Lines.Any(l => l.Kind == "Rent"))
                    sb.Append("The rental period begins when the item is delivered. ");
                if (doc.Lines.Any(l => l.DepositAmount > 0))
                    sb.Append("Security deposit is held with the rental and is refundable after the item is returned in good condition.");
            }

            sb.Append("</div>");
            return sb.ToString();
        }

        private static void AppendHtmlMoney(StringBuilder sb, string label, decimal amount)
        {
            if (amount <= 0)
                return;
            sb.Append("<tr><td style=\"padding-top:4px;font-size:13px;color:#3d4a5c;\">");
            sb.Append(E(label));
            sb.Append("</td><td align=\"right\" style=\"padding-top:4px;font-size:13px;color:#1c2430;\">");
            sb.Append(E(Money(amount)));
            sb.Append("</td></tr>");
        }

        private static void AppendPlainMoney(StringBuilder sb, string label, decimal amount)
        {
            if (amount <= 0)
                return;
            sb.AppendLine($"{label}: {Money(amount)}");
        }

        private static string? FormatAddress(CustomerAddress? address)
        {
            if (address is null)
                return null;
            var parts = new[] { address.Line1, address.City, address.State, address.Postal }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim());
            var text = string.Join(", ", parts);
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }

        private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
    }

    private sealed record PaymentRequestDocument(
        Customer Customer,
        string PaymentUrl,
        decimal Amount,
        IReadOnlyList<CustomerOrderDto> Orders);

    private static class PaymentRequestHtml
    {
        public static string Render(PaymentRequestDocument doc)
        {
            var sb = new StringBuilder();
            sb.Append("""
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Complete your BlinksMed payment</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#1c2430;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4eaf2;">
                        <tr><td style="background:#052A72;padding:28px 32px;">
                          <div style="color:#9ec0ff;font-size:12px;letter-spacing:2px;font-weight:700;">BLINKSMED</div>
                          <div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:6px;">Payment needed</div>
                          <div style="color:#d6e4ff;font-size:14px;margin-top:4px;">Your order is placed. Complete payment to send it to a vendor.</div>
                        </td></tr>
                        <tr><td style="padding:28px 32px 8px;">
                          <p style="margin:0 0 8px;font-size:16px;">Hi 
                """);
            sb.Append(WebUtility.HtmlEncode(doc.Customer.FullName));
            sb.Append("""
                ,</p>
                          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#3d4a5c;">An order was prepared for you. Pay the amount below and we will offer it to a vendor. You will get a separate invoice email after the payment is received.</p>
                """);
            foreach (var order in doc.Orders)
            {
                var kind = string.Equals(order.OrderType, "buy", StringComparison.OrdinalIgnoreCase) ? "Buy" : "Rent";
                sb.Append("""
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4eaf2;border-radius:12px;margin-top:10px;">
                      <tr><td style="padding:14px 16px;">
                        <div style="font-size:15px;font-weight:700;">
                    """);
                sb.Append(WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(order.ListingTitle) ? "Item" : order.ListingTitle));
                sb.Append("</div><div style=\"font-size:12px;color:#5c6b7a;margin-top:3px;\">");
                sb.Append(WebUtility.HtmlEncode($"{order.OrderNumber} · {kind} · Qty {order.Quantity}"));
                sb.Append("</div><div style=\"font-size:14px;font-weight:700;margin-top:8px;\">");
                sb.Append(WebUtility.HtmlEncode(Money(order.TotalAmount)));
                sb.Append("</div></td></tr></table>");
            }

            sb.Append("""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f3faf0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;">Amount to pay</td>
                    <td align="right" style="padding:16px 18px;font-size:22px;font-weight:700;color:#2f7d08;">
                """);
            sb.Append(WebUtility.HtmlEncode(Money(doc.Amount)));
            sb.Append("""
                    </td>
                  </tr>
                </table>
                <div style="text-align:center;margin:22px 0;">
                  <a href="
                """);
            sb.Append(WebUtility.HtmlEncode(doc.PaymentUrl));
            sb.Append("""
                " style="display:inline-block;background:#052A72;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;">Pay now</a>
                </div>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#5c6b7a;">If the button does not open, copy this link:<br>
                """);
            sb.Append(WebUtility.HtmlEncode(doc.PaymentUrl));
            sb.Append("""
                </p>
                        </td></tr>
                        <tr><td style="padding:18px 32px 28px;background:#f7f9fc;border-top:1px solid #e4eaf2;">
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#5c6b7a;">Questions about this payment? Write to <a href="mailto:support@blinksmed.in" style="color:#052A72;">support@blinksmed.in</a>.</p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """);
            return sb.ToString();
        }

        public static string RenderPlain(PaymentRequestDocument doc)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"Hi {doc.Customer.FullName},");
            sb.AppendLine();
            sb.AppendLine("Your order is placed. Complete payment so it can be sent to a vendor.");
            sb.AppendLine();
            foreach (var order in doc.Orders)
            {
                var kind = string.Equals(order.OrderType, "buy", StringComparison.OrdinalIgnoreCase) ? "Buy" : "Rent";
                var title = string.IsNullOrWhiteSpace(order.ListingTitle) ? "Item" : order.ListingTitle.Trim();
                sb.AppendLine($"{title} ({order.OrderNumber}) · {kind} · Qty {order.Quantity} · {Money(order.TotalAmount)}");
            }

            sb.AppendLine();
            sb.AppendLine($"Amount to pay: {Money(doc.Amount)}");
            sb.AppendLine($"Pay now: {doc.PaymentUrl}");
            sb.AppendLine();
            sb.AppendLine("You will get a separate invoice email after the payment is received.");
            sb.AppendLine("Support: support@blinksmed.in");
            return sb.ToString();
        }
    }

    private sealed record RefundReceiptDocument(
        string ReceiptNumber,
        string Kind,
        string Intro,
        Customer Customer,
        string OrderNumber,
        string ProductTitle,
        string PaidLabel,
        decimal PaidAmount,
        decimal? ExtensionPaidAmount,
        string? ChargeLabel,
        decimal ChargeAmount,
        string? ChargeReason,
        decimal RefundAmount,
        DateTimeOffset SentAtUtc,
        string? Reference,
        string MethodNote);

    private static class RefundReceiptHtml
    {
        public static string Render(RefundReceiptDocument doc)
        {
            var sent = PaymentInvoiceMailer.ToIndia(doc.SentAtUtc);
            var sentLabel = sent.ToString("dd MMM yyyy, h:mm tt", CultureInfo.InvariantCulture) + " IST";
            var name = string.IsNullOrWhiteSpace(doc.Customer.FullName) ? "there" : doc.Customer.FullName.Trim();
            var sb = new StringBuilder();
            sb.Append("""
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>BlinksMed refund receipt</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#1c2430;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f8;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4eaf2;">
                        <tr><td style="background:#052A72;padding:28px 32px;">
                          <div style="color:#9ec0ff;font-size:12px;letter-spacing:2px;font-weight:700;">BLINKSMED</div>
                          <div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:6px;">Refund receipt</div>
                          <div style="color:#d6e4ff;font-size:14px;margin-top:4px;">
                """);
            sb.Append(E(doc.Kind));
            sb.Append("""
                           · Amount sent to you</div>
                        </td></tr>
                        <tr><td style="padding:28px 32px 8px;">
                          <p style="margin:0 0 8px;font-size:16px;">Hi 
                """);
            sb.Append(E(name));
            sb.Append("""
                ,</p>
                          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#3d4a5c;">
                """);
            sb.Append(E(doc.Intro));
            sb.Append("</p>");
            sb.Append("""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                  <tr>
                    <td style="width:50%;padding:10px 12px;background:#f7f9fc;border-radius:10px;">
                      <div style="font-size:11px;color:#5c6b7a;font-weight:700;">RECEIPT NUMBER</div>
                      <div style="font-size:14px;font-weight:700;margin-top:3px;">
                """);
            sb.Append(E(doc.ReceiptNumber));
            sb.Append("""
                      </div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="width:50%;padding:10px 12px;background:#f7f9fc;border-radius:10px;">
                      <div style="font-size:11px;color:#5c6b7a;font-weight:700;">SENT ON</div>
                      <div style="font-size:14px;font-weight:700;margin-top:3px;">
                """);
            sb.Append(E(sentLabel));
            sb.Append("</div></td></tr></table>");
            sb.Append("""
                <div style="border:1px solid #e4eaf2;border-radius:12px;padding:14px 16px;">
                  <div style="font-size:15px;font-weight:700;">
                """);
            sb.Append(E(doc.ProductTitle));
            sb.Append("</div><div style=\"font-size:12px;color:#5c6b7a;margin-top:3px;\">Order ");
            sb.Append(E(string.IsNullOrWhiteSpace(doc.OrderNumber) ? "—" : doc.OrderNumber));
            sb.Append("</div><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:12px;\">");
            AppendRow(sb, doc.PaidLabel, doc.PaidAmount, bold: false);
            if (doc.ExtensionPaidAmount is decimal extensionPaid && extensionPaid > 0)
                AppendRow(sb, "Includes extension payment", extensionPaid, bold: false);
            if (!string.IsNullOrWhiteSpace(doc.ChargeLabel) && doc.ChargeAmount > 0)
                AppendRow(sb, doc.ChargeLabel, doc.ChargeAmount, bold: false);
            sb.Append("</table>");
            if (!string.IsNullOrWhiteSpace(doc.ChargeReason))
            {
                sb.Append("<div style=\"margin-top:10px;background:#fff7e8;border-radius:8px;padding:8px 10px;font-size:13px;color:#7a4b00;\">");
                sb.Append(E(doc.ChargeReason));
                sb.Append("</div>");
            }

            sb.Append("</div>");
            sb.Append("""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f3faf0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;color:#1c2430;">Refund sent</td>
                    <td align="right" style="padding:16px 18px;font-size:22px;font-weight:700;color:#2f7d08;">
                """);
            sb.Append(E(Money(doc.RefundAmount)));
            sb.Append("</td></tr></table>");
            if (!string.IsNullOrWhiteSpace(doc.Reference))
            {
                sb.Append("<p style=\"margin:16px 0 0;font-size:13px;color:#3d4a5c;\">Reference: <strong>");
                sb.Append(E(doc.Reference));
                sb.Append("</strong></p>");
            }

            sb.Append("<p style=\"margin:12px 0 18px;font-size:13px;line-height:1.55;color:#5c6b7a;\">");
            sb.Append(E(doc.MethodNote));
            sb.Append("</p></td></tr>");
            sb.Append("""
                        <tr><td style="padding:18px 32px 28px;background:#f7f9fc;border-top:1px solid #e4eaf2;">
                          <p style="margin:0;font-size:12px;line-height:1.5;color:#5c6b7a;">Questions about this refund? Write to <a href="mailto:support@blinksmed.in" style="color:#052A72;">support@blinksmed.in</a>.</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#5c6b7a;">BlinksMed · 
                """);
            sb.Append(E(PublicSiteUrls.DefaultCustomerPortal));
            sb.Append("""
                </p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """);
            return sb.ToString();
        }

        public static string RenderPlain(RefundReceiptDocument doc)
        {
            var sent = PaymentInvoiceMailer.ToIndia(doc.SentAtUtc);
            var name = string.IsNullOrWhiteSpace(doc.Customer.FullName) ? "there" : doc.Customer.FullName.Trim();
            var sb = new StringBuilder();
            sb.AppendLine("BlinksMed refund receipt");
            sb.AppendLine(doc.Kind);
            sb.AppendLine($"Receipt: {doc.ReceiptNumber}");
            sb.AppendLine($"Sent: {sent:dd MMM yyyy, h:mm tt} IST");
            sb.AppendLine();
            sb.AppendLine($"Hi {name},");
            sb.AppendLine(doc.Intro);
            sb.AppendLine();
            sb.AppendLine($"{doc.ProductTitle} ({(string.IsNullOrWhiteSpace(doc.OrderNumber) ? "—" : doc.OrderNumber)})");
            sb.AppendLine($"{doc.PaidLabel}: {Money(doc.PaidAmount)}");
            if (doc.ExtensionPaidAmount is decimal extensionPaid && extensionPaid > 0)
                sb.AppendLine($"Includes extension payment: {Money(extensionPaid)}");
            if (!string.IsNullOrWhiteSpace(doc.ChargeLabel) && doc.ChargeAmount > 0)
                sb.AppendLine($"{doc.ChargeLabel}: {Money(doc.ChargeAmount)}");
            if (!string.IsNullOrWhiteSpace(doc.ChargeReason))
                sb.AppendLine(doc.ChargeReason);
            sb.AppendLine($"Refund sent: {Money(doc.RefundAmount)}");
            if (!string.IsNullOrWhiteSpace(doc.Reference))
                sb.AppendLine($"Reference: {doc.Reference}");
            sb.AppendLine(doc.MethodNote);
            sb.AppendLine();
            sb.AppendLine("Support: support@blinksmed.in");
            return sb.ToString();
        }

        private static void AppendRow(StringBuilder sb, string label, decimal amount, bool bold)
        {
            var weight = bold ? "font-weight:700;" : string.Empty;
            sb.Append("<tr><td style=\"padding-top:6px;font-size:13px;color:#3d4a5c;");
            sb.Append(weight);
            sb.Append("\">");
            sb.Append(E(label));
            sb.Append("</td><td align=\"right\" style=\"padding-top:6px;font-size:13px;color:#1c2430;");
            sb.Append(weight);
            sb.Append("\">");
            sb.Append(E(Money(amount)));
            sb.Append("</td></tr>");
        }

        private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
    }
}
