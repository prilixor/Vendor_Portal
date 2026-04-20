using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RegisterVendorCommand(string Email, string Password) : ICommand<VendorDto>;

public sealed class RegisterVendorCommandValidator : AbstractValidator<RegisterVendorCommand>
{
    public RegisterVendorCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
    }
}

internal sealed class RegisterVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasherService)
    : ICommandHandler<RegisterVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(RegisterVendorCommand request, CancellationToken cancellationToken)
    {
        var existing = await repository.GetVendorByEmailAsync(request.Email, cancellationToken);
        if (existing is not null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.email_exists", "A vendor account already exists for this email.", ErrorCategory.Validation));
        }

        var vendor = new Vendor
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHasherService.HashPassword(request.Password),
            EmailVerified = false,
            AccountStatus = "pending",
            RegistrationStage = "email_registered"
        };

        await repository.AddVendorAsync(vendor, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorDto(
            vendor.Id.ToString(),
            vendor.Email,
            vendor.EmailVerified,
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt));
    }
}
