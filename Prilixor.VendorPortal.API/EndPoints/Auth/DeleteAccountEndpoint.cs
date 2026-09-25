using System.Security.Claims;
using FastEndpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.API.EndPoints.Auth;

public sealed class DeleteAccountRequest
{
    public string Password { get; set; } = string.Empty;
}

public sealed record DeleteAccountResponse(bool Success, string Message);

/// <summary>
/// Closes the signed-in customer or vendor account. Google Play requires this
/// inside the app and on a public web page. Open rentals must be finished first.
/// Login details are removed. Orders and records the business must keep are retained.
/// </summary>
public sealed class DeleteAccountEndpoint(
    IVendorOnboardingRepository vendors,
    ICustomerRepository customers,
    IPasswordHasherService passwordHasher)
    : Endpoint<DeleteAccountRequest, Results<Ok<DeleteAccountResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("auth/delete-account");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Roles("customer", "vendor");
    }

    public override async Task<Results<Ok<DeleteAccountResponse>, ProblemHttpResult>> ExecuteAsync(
        DeleteAccountRequest req,
        CancellationToken ct)
    {
        if (User.HasClaim("impersonation", "true"))
        {
            return TypedResults.Problem(
                title: "auth.impersonation_blocked",
                detail: "Account deletion is not allowed during impersonation.",
                statusCode: 403);
        }

        if (string.IsNullOrWhiteSpace(req.Password))
        {
            return TypedResults.Problem(
                title: "auth.invalid_password",
                detail: "Password is required.",
                statusCode: 400);
        }

        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);
        }

        var role = User.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "customer", StringComparison.OrdinalIgnoreCase))
            return await DeleteCustomerAsync(userId, req.Password, ct);

        if (string.Equals(role, "vendor", StringComparison.OrdinalIgnoreCase))
            return await DeleteVendorAsync(userId, req.Password, ct);

        return TypedResults.Problem(
            title: "auth.forbidden",
            detail: "This account type cannot be deleted here.",
            statusCode: 403);
    }

    private async Task<Results<Ok<DeleteAccountResponse>, ProblemHttpResult>> DeleteCustomerAsync(
        Guid customerId,
        string password,
        CancellationToken ct)
    {
        var customer = await customers.GetCustomerByIdAsync(customerId, ct);
        if (customer is null || customer.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "Account not found.", statusCode: 404);
        }

        if (!passwordHasher.VerifyPassword(password, customer.PasswordHash))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Password is incorrect.", statusCode: 400);
        }

        var openOrders = await customers.CountOpenOrdersForCustomerAsync(customerId, ct);
        if (openOrders > 0)
        {
            return TypedResults.Problem(
                title: "account.open_orders",
                detail: "This account still has open rentals. Finish or cancel those orders before deleting the account.",
                statusCode: 409);
        }

        var now = DateTimeOffset.UtcNow;
        var addresses = await customers.GetCustomerAddressesAsync(customerId, ct);
        foreach (var address in addresses)
        {
            address.Label = null;
            address.Line1 = "Removed";
            address.City = "Removed";
            address.State = "Removed";
            address.Postal = "000000";
            address.Latitude = null;
            address.Longitude = null;
            address.IsDeleted = true;
            address.DeletedAt = now;
            address.DeletedBy = customerId;
        }

        customer.Email = DeletedEmail(customerId);
        customer.FullName = "Deleted user";
        customer.Phone = null;
        customer.PasswordHash = passwordHasher.HashPassword(Guid.NewGuid().ToString("N"));
        customer.IsDeleted = true;
        customer.DeletedAt = now;
        customer.DeletedBy = customerId;
        await customers.SaveChangesAsync(ct);

        await vendors.RevokeRefreshTokensForUserAsync(customerId.ToString(), ct);
        await vendors.SaveChangesAsync(ct);

        return TypedResults.Ok(new DeleteAccountResponse(true, "Your account has been deleted."));
    }

    private async Task<Results<Ok<DeleteAccountResponse>, ProblemHttpResult>> DeleteVendorAsync(
        Guid vendorId,
        string password,
        CancellationToken ct)
    {
        var vendor = await vendors.GetVendorByIdAsync(vendorId, ct);
        if (vendor is null || vendor.IsDeleted)
        {
            return TypedResults.Problem(title: "auth.user_not_found", detail: "Account not found.", statusCode: 404);
        }

        if (!passwordHasher.VerifyPassword(password, vendor.PasswordHash))
        {
            return TypedResults.Problem(title: "auth.invalid_password", detail: "Password is incorrect.", statusCode: 400);
        }

        var openOrders = await customers.CountOpenOrdersForVendorAsync(vendorId, ct);
        if (openOrders > 0)
        {
            return TypedResults.Problem(
                title: "account.open_orders",
                detail: "This account still has open orders or pending requests. Finish or decline those before deleting the account.",
                statusCode: 409);
        }

        var now = DateTimeOffset.UtcNow;
        var profile = await vendors.GetVendorProfileAsync(vendorId, ct);
        if (profile is not null)
        {
            profile.OwnerName = "Deleted user";
            profile.BusinessName = "Deleted vendor";
            profile.SupportPhone = null;
            profile.GstNumber = null;
            profile.AddressLine1 = "Removed";
            profile.AddressLine2 = null;
            profile.City = "Removed";
            profile.State = "Removed";
            profile.PostalCode = "000000";
            profile.Latitude = null;
            profile.Longitude = null;
            profile.IsDeleted = true;
            profile.DeletedAt = now;
            profile.DeletedBy = vendorId;
        }

        vendor.Email = DeletedEmail(vendorId);
        vendor.SupportPhone = null;
        vendor.PasswordHash = passwordHasher.HashPassword(Guid.NewGuid().ToString("N"));
        vendor.EmailVerificationToken = null;
        vendor.VerificationTokenExpiryUtc = null;
        vendor.AccountStatus = "closed";
        vendor.IsDeleted = true;
        vendor.DeletedAt = now;
        vendor.DeletedBy = vendorId;

        await vendors.RevokeRefreshTokensForUserAsync(vendorId.ToString(), ct);
        await vendors.SaveChangesAsync(ct);

        return TypedResults.Ok(new DeleteAccountResponse(true, "Your account has been deleted."));
    }

    private static string DeletedEmail(Guid userId) =>
        $"deleted.{userId:N}@deleted.blinksmed.invalid";
}
