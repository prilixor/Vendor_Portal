using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;
using Prilixor.VendorPortal.Domain.Common;

namespace Prilixor.VendorPortal.Application.Admin.Doctors;

public static class DoctorUniqueCodeGenerator
{
    private static readonly Regex TitlePrefix = new(@"^(dr\.?|doctor)\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Builds name code prefix e.g. Dr. Aditi Patel → DRAP
    /// </summary>
    public static string BuildNameCode(string fullName)
    {
        var cleaned = TitlePrefix.Replace((fullName ?? string.Empty).Trim(), string.Empty).Trim();
        var parts = cleaned.Split([' ', '-', '_'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        char first;
        char second;
        if (parts.Length >= 2)
        {
            first = char.ToUpperInvariant(parts[0][0]);
            second = char.ToUpperInvariant(parts[^1][0]);
        }
        else if (parts.Length == 1 && parts[0].Length >= 2)
        {
            first = char.ToUpperInvariant(parts[0][0]);
            second = char.ToUpperInvariant(parts[0][1]);
        }
        else if (parts.Length == 1)
        {
            first = char.ToUpperInvariant(parts[0][0]);
            second = 'X';
        }
        else
        {
            first = 'X';
            second = 'X';
        }

        return $"DR{first}{second}";
    }

    public static string BuildPrefix(string fullName, DateTimeOffset createdOnUtc) =>
        $"{BuildNameCode(fullName)}{createdOnUtc:yy}";

    public static string FormatCode(string prefix, int sequence) =>
        $"{prefix}{sequence:D3}";
}

public sealed record ListAdminDoctorsQuery(string? Search, bool? IsActive) : IQuery<List<DoctorDto>>;

internal sealed class ListAdminDoctorsQueryHandler(ICustomerRepository repository, IConfiguration configuration)
    : IQueryHandler<ListAdminDoctorsQuery, List<DoctorDto>>
{
    public async Task<Result<List<DoctorDto>>> Handle(ListAdminDoctorsQuery request, CancellationToken cancellationToken)
    {
        var doctors = await repository.ListDoctorsForAdminAsync(request.Search, request.IsActive, cancellationToken);
        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        return Result.Success(doctors.Select(d => DoctorDtoMapper.Map(d, $"{baseUrl}/dr/{d.UniqueCode}")).ToList());
    }
}

public sealed record GetAdminDoctorQuery(Guid Id) : IQuery<DoctorDto>;

internal sealed class GetAdminDoctorQueryHandler(ICustomerRepository repository, IConfiguration configuration)
    : IQueryHandler<GetAdminDoctorQuery, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(GetAdminDoctorQuery request, CancellationToken cancellationToken)
    {
        var doctor = await repository.GetDoctorByIdAsync(request.Id, cancellationToken);
        if (doctor is null)
            return Result.Failure<DoctorDto>(new Error("directory.doctor_not_found", "Doctor not found.", ErrorCategory.NotFound));

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        return Result.Success(DoctorDtoMapper.Map(doctor, $"{baseUrl}/dr/{doctor.UniqueCode}"));
    }
}

public sealed record CreateAdminDoctorCommand(
    string FullName,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool SendEmail = true) : ICommand<DoctorDto>;

internal sealed class CreateAdminDoctorCommandHandler(
    ICustomerRepository repository,
    IEmailService emailService,
    IQrCodeService qrCodeService,
    IConfiguration configuration)
    : ICommandHandler<CreateAdminDoctorCommand, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(CreateAdminDoctorCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return Result.Failure<DoctorDto>(new Error("directory.name_required", "Doctor full name is required.", ErrorCategory.Validation));
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Result.Failure<DoctorDto>(new Error("directory.email_required", "A valid doctor email is required.", ErrorCategory.Validation));

        var now = DateTimeOffset.UtcNow;
        var prefix = DoctorUniqueCodeGenerator.BuildPrefix(request.FullName, now);
        var nextSeq = await repository.CountDoctorsWithUniqueCodePrefixAsync(prefix, cancellationToken) + 1;
        var uniqueCode = DoctorUniqueCodeGenerator.FormatCode(prefix, nextSeq);

        // Extremely unlikely collision retry
        for (var i = 0; i < 5; i++)
        {
            var existing = await repository.GetDoctorByUniqueCodeAsync(uniqueCode, cancellationToken);
            if (existing is null) break;
            nextSeq++;
            uniqueCode = DoctorUniqueCodeGenerator.FormatCode(prefix, nextSeq);
        }

        var doctor = new Doctor
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            Specialization = string.IsNullOrWhiteSpace(request.Specialization) ? null : request.Specialization.Trim(),
            ContactNumber = string.IsNullOrWhiteSpace(request.ContactNumber) ? null : request.ContactNumber.Trim(),
            UniqueCode = uniqueCode,
            IsActive = true,
        };

        await repository.AddDoctorAsync(doctor, cancellationToken);

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        var pageUrl = $"{baseUrl}/dr/{doctor.UniqueCode}";

        if (request.SendEmail)
        {
            try
            {
                await SendDoctorShareEmailAsync(emailService, qrCodeService, doctor, pageUrl, cancellationToken);
            }
            catch
            {
                // Doctor is created even if email fails; admin can resend.
            }
        }

        return Result.Success(DoctorDtoMapper.Map(doctor, pageUrl));
    }

    internal static async Task SendDoctorShareEmailAsync(
        IEmailService emailService,
        IQrCodeService qrCodeService,
        Doctor doctor,
        string pageUrl,
        CancellationToken cancellationToken)
    {
        var subject = $"Your Prilixor Doctor ID: {doctor.UniqueCode}";
        var body = new StringBuilder()
            .AppendLine($"Dear {doctor.FullName},")
            .AppendLine()
            .AppendLine("Your doctor profile has been registered on Prilixor.")
            .AppendLine($"Unique ID: {doctor.UniqueCode}")
            .AppendLine($"Share page: {pageUrl}")
            .AppendLine()
            .AppendLine("Please share your Unique ID or QR code with patients so they can add you as a doctor reference when placing orders.")
            .AppendLine()
            .AppendLine("— Prilixor Team")
            .ToString();

        // QR is available via admin download; email body carries the URL (SMTP sends HTML/text only today).
        _ = qrCodeService.GeneratePng(pageUrl);
        await emailService.SendEmailAsync(doctor.Email, subject, body, cancellationToken);
    }
}

public sealed record UpdateAdminDoctorCommand(
    Guid Id,
    string FullName,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool IsActive) : ICommand<DoctorDto>;

internal sealed class UpdateAdminDoctorCommandHandler(ICustomerRepository repository, IConfiguration configuration)
    : ICommandHandler<UpdateAdminDoctorCommand, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(UpdateAdminDoctorCommand request, CancellationToken cancellationToken)
    {
        var doctor = await repository.GetDoctorByIdAsync(request.Id, cancellationToken);
        if (doctor is null)
            return Result.Failure<DoctorDto>(new Error("directory.doctor_not_found", "Doctor not found.", ErrorCategory.NotFound));

        if (string.IsNullOrWhiteSpace(request.FullName))
            return Result.Failure<DoctorDto>(new Error("directory.name_required", "Doctor full name is required.", ErrorCategory.Validation));
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Result.Failure<DoctorDto>(new Error("directory.email_required", "A valid doctor email is required.", ErrorCategory.Validation));

        doctor.FullName = request.FullName.Trim();
        doctor.Email = request.Email.Trim();
        doctor.Specialization = string.IsNullOrWhiteSpace(request.Specialization) ? null : request.Specialization.Trim();
        doctor.ContactNumber = string.IsNullOrWhiteSpace(request.ContactNumber) ? null : request.ContactNumber.Trim();
        doctor.IsActive = request.IsActive;
        // UniqueCode is immutable

        await repository.UpdateDoctorAsync(doctor, cancellationToken);

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        return Result.Success(DoctorDtoMapper.Map(doctor, $"{baseUrl}/dr/{doctor.UniqueCode}"));
    }
}

public sealed record SoftDeleteAdminDoctorCommand(Guid Id, Guid? DeletedBy) : ICommand<bool>;

internal sealed class SoftDeleteAdminDoctorCommandHandler(ICustomerRepository repository)
    : ICommandHandler<SoftDeleteAdminDoctorCommand, bool>
{
    public async Task<Result<bool>> Handle(SoftDeleteAdminDoctorCommand request, CancellationToken cancellationToken)
    {
        var doctor = await repository.GetDoctorByIdAsync(request.Id, cancellationToken);
        if (doctor is null)
            return Result.Failure<bool>(new Error("directory.doctor_not_found", "Doctor not found.", ErrorCategory.NotFound));

        await repository.SoftDeleteDoctorAsync(request.Id, request.DeletedBy, cancellationToken);
        return Result.Success(true);
    }
}

public sealed record ResendAdminDoctorEmailCommand(Guid Id) : ICommand<bool>;

internal sealed class ResendAdminDoctorEmailCommandHandler(
    ICustomerRepository repository,
    IEmailService emailService,
    IQrCodeService qrCodeService,
    IConfiguration configuration)
    : ICommandHandler<ResendAdminDoctorEmailCommand, bool>
{
    public async Task<Result<bool>> Handle(ResendAdminDoctorEmailCommand request, CancellationToken cancellationToken)
    {
        var doctor = await repository.GetDoctorByIdAsync(request.Id, cancellationToken);
        if (doctor is null)
            return Result.Failure<bool>(new Error("directory.doctor_not_found", "Doctor not found.", ErrorCategory.NotFound));

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        var pageUrl = $"{baseUrl}/dr/{doctor.UniqueCode}";
        await CreateAdminDoctorCommandHandler.SendDoctorShareEmailAsync(emailService, qrCodeService, doctor, pageUrl, cancellationToken);
        return Result.Success(true);
    }
}

public sealed record GetAdminDoctorQrQuery(Guid Id) : IQuery<byte[]>;

internal sealed class GetAdminDoctorQrQueryHandler(
    ICustomerRepository repository,
    IQrCodeService qrCodeService,
    IConfiguration configuration)
    : IQueryHandler<GetAdminDoctorQrQuery, byte[]>
{
    public async Task<Result<byte[]>> Handle(GetAdminDoctorQrQuery request, CancellationToken cancellationToken)
    {
        var doctor = await repository.GetDoctorByIdAsync(request.Id, cancellationToken);
        if (doctor is null)
            return Result.Failure<byte[]>(new Error("directory.doctor_not_found", "Doctor not found.", ErrorCategory.NotFound));

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        var pageUrl = $"{baseUrl}/dr/{doctor.UniqueCode}";
        var png = qrCodeService.GeneratePng(pageUrl);
        return Result.Success(png);
    }
}
