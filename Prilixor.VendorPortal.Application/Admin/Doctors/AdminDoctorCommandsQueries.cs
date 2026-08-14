using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Admin.Hospitals;
using Prilixor.VendorPortal.Application.Common;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Common;

namespace Prilixor.VendorPortal.Application.Admin.Doctors;

public static class DoctorUniqueCodeGenerator
{
    private static readonly Regex TitlePrefix = new(@"^(dr\.?|doctor)\s+", RegexOptions.IgnoreCase | RegexOptions.Compiled);

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

internal static class DoctorHospitalLinkHelper
{
    public static async Task<Result<List<Guid>>> ResolveHospitalIdsAsync(
        ICustomerRepository repository,
        IReadOnlyList<Guid>? existingHospitalIds,
        IReadOnlyList<CreateHospitalInput>? newHospitals,
        CancellationToken cancellationToken)
    {
        var ids = new List<Guid>();
        if (existingHospitalIds is not null)
            ids.AddRange(existingHospitalIds);

        if (newHospitals is not null)
        {
            foreach (var input in newHospitals)
            {
                if (string.IsNullOrWhiteSpace(input.Name))
                    return Result.Failure<List<Guid>>(new Error("directory.hospital_name_required", "Hospital name is required.", ErrorCategory.Validation));
                if (!IndianContactNumber.TryNormalizeOptional(input.ContactNumber, out var hospitalContact))
                    return Result.Failure<List<Guid>>(new Error("directory.contact_invalid", IndianContactNumber.InvalidMessage, ErrorCategory.Validation));

                var hospital = new Hospital
                {
                    Name = input.Name.Trim(),
                    AddressLine1 = string.IsNullOrWhiteSpace(input.AddressLine1) ? null : input.AddressLine1.Trim(),
                    City = string.IsNullOrWhiteSpace(input.City) ? null : input.City.Trim(),
                    State = string.IsNullOrWhiteSpace(input.State) ? null : input.State.Trim(),
                    PostalCode = string.IsNullOrWhiteSpace(input.PostalCode) ? null : input.PostalCode.Trim(),
                    Latitude = input.Latitude,
                    Longitude = input.Longitude,
                    ContactNumber = hospitalContact,
                    IsActive = true,
                };
                await repository.AddHospitalAsync(hospital, cancellationToken);
                ids.Add(hospital.Id);
            }
        }

        return Result.Success(ids.Distinct().ToList());
    }
}

public sealed record ListAdminDoctorsQuery(string? Search, bool? IsActive) : IQuery<List<DoctorDto>>;

internal sealed class ListAdminDoctorsQueryHandler(ICustomerRepository repository, IConfiguration configuration)
    : IQueryHandler<ListAdminDoctorsQuery, List<DoctorDto>>
{
    public async Task<Result<List<DoctorDto>>> Handle(ListAdminDoctorsQuery request, CancellationToken cancellationToken)
    {
        var doctors = await repository.ListDoctorsForAdminAsync(request.Search, request.IsActive, cancellationToken);
        return Result.Success(doctors.Select(d => DoctorDtoMapper.Map(d, PublicSiteUrls.DoctorSharePage(configuration, d.UniqueCode))).ToList());
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

        return Result.Success(DoctorDtoMapper.Map(doctor, PublicSiteUrls.DoctorSharePage(configuration, doctor.UniqueCode)));
    }
}

public sealed record CreateAdminDoctorCommand(
    string FullName,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool SendEmail = true,
    IReadOnlyList<Guid>? HospitalIds = null,
    IReadOnlyList<CreateHospitalInput>? NewHospitals = null) : ICommand<DoctorDto>;

internal sealed class CreateAdminDoctorCommandHandler(
    ICustomerRepository repository,
    IEmailService emailService,
    IQrCodeService qrCodeService,
    IConfiguration configuration,
    ILogger<CreateAdminDoctorCommandHandler> logger)
    : ICommandHandler<CreateAdminDoctorCommand, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(CreateAdminDoctorCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return Result.Failure<DoctorDto>(new Error("directory.name_required", "Doctor full name is required.", ErrorCategory.Validation));
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return Result.Failure<DoctorDto>(new Error("directory.email_required", "A valid doctor email is required.", ErrorCategory.Validation));
        if (!IndianContactNumber.TryNormalizeOptional(request.ContactNumber, out var contactNumber))
            return Result.Failure<DoctorDto>(new Error("directory.contact_invalid", IndianContactNumber.InvalidMessage, ErrorCategory.Validation));
        var duplicate = await repository.FindDoctorByEmailAsync(request.Email, excludeDoctorId: null, cancellationToken);
        if (duplicate is not null)
            return Result.Failure<DoctorDto>(new Error("directory.email_exists", "A doctor with this email already exists.", ErrorCategory.Validation));

        var hospitalIdsResult = await DoctorHospitalLinkHelper.ResolveHospitalIdsAsync(
            repository, request.HospitalIds, request.NewHospitals, cancellationToken);
        if (!hospitalIdsResult.IsSuccess)
            return Result.Failure<DoctorDto>(hospitalIdsResult.Errors);

        var now = DateTimeOffset.UtcNow;
        var prefix = DoctorUniqueCodeGenerator.BuildPrefix(request.FullName, now);
        var yearYy = now.ToString("yy");
        var nextSeq = await repository.CountDoctorsEnrolledInYearAsync(yearYy, cancellationToken) + 1;
        var uniqueCode = DoctorUniqueCodeGenerator.FormatCode(prefix, nextSeq);

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
            ContactNumber = contactNumber,
            UniqueCode = uniqueCode,
            IsActive = true,
        };

        await repository.AddDoctorAsync(doctor, cancellationToken);
        await repository.SetDoctorHospitalLinksAsync(doctor.Id, hospitalIdsResult.Value!, cancellationToken);

        var saved = await repository.GetDoctorByIdAsync(doctor.Id, cancellationToken);
        var pageUrl = PublicSiteUrls.DoctorSharePage(configuration, doctor.UniqueCode);

        if (request.SendEmail)
        {
            try
            {
                await SendDoctorShareEmailAsync(emailService, qrCodeService, doctor, pageUrl, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send doctor reference email to {Email} for {UniqueCode}", doctor.Email, doctor.UniqueCode);
            }
        }

        return Result.Success(DoctorDtoMapper.Map(saved!, pageUrl));
    }

    internal static async Task SendDoctorShareEmailAsync(
        IEmailService emailService,
        IQrCodeService qrCodeService,
        Doctor doctor,
        string pageUrl,
        CancellationToken cancellationToken)
    {
        var qrPng = qrCodeService.GeneratePng(pageUrl, pixelsPerModule: 10);
        var qrUsable = qrPng is { Length: > 200 };

        var subject = $"Your BlinksMed Doctor Reference ID: {doctor.UniqueCode}";
        var html = EmailTemplates.DoctorShareInvite(
            doctor.FullName,
            doctor.UniqueCode,
            pageUrl,
            doctor.Specialization,
            qrUsable ? $"cid:{EmailTemplates.DoctorQrContentId}" : null);
        var plain = EmailTemplates.DoctorShareInvitePlainText(
            doctor.FullName,
            doctor.UniqueCode,
            pageUrl,
            doctor.Specialization);

        IReadOnlyList<EmailInlineImage>? inlineImages = null;
        IReadOnlyList<EmailFileAttachment>? attachments = null;
        if (qrUsable)
        {
            var fileName = $"BlinksMed-{doctor.UniqueCode}-QR.png";
            inlineImages = [new EmailInlineImage(EmailTemplates.DoctorQrContentId, qrPng, "image/png", fileName)];
            attachments = [new EmailFileAttachment(fileName, qrPng, "image/png")];
        }

        await emailService.SendEmailAsync(doctor.Email, subject, html, plain, inlineImages, attachments, cancellationToken);
    }
}
public sealed record UpdateAdminDoctorCommand(
    Guid Id,
    string FullName,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool IsActive,
    IReadOnlyList<Guid>? HospitalIds = null,
    IReadOnlyList<CreateHospitalInput>? NewHospitals = null) : ICommand<DoctorDto>;

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
        if (!IndianContactNumber.TryNormalizeOptional(request.ContactNumber, out var contactNumber))
            return Result.Failure<DoctorDto>(new Error("directory.contact_invalid", IndianContactNumber.InvalidMessage, ErrorCategory.Validation));
        var duplicate = await repository.FindDoctorByEmailAsync(request.Email, request.Id, cancellationToken);
        if (duplicate is not null)
            return Result.Failure<DoctorDto>(new Error("directory.email_exists", "A doctor with this email already exists.", ErrorCategory.Validation));

        doctor.FullName = request.FullName.Trim();
        doctor.Email = request.Email.Trim();
        doctor.Specialization = string.IsNullOrWhiteSpace(request.Specialization) ? null : request.Specialization.Trim();
        doctor.ContactNumber = contactNumber;
        doctor.IsActive = request.IsActive;

        await repository.UpdateDoctorAsync(doctor, cancellationToken);

        if (request.HospitalIds is not null || request.NewHospitals is not null)
        {
            var hospitalIdsResult = await DoctorHospitalLinkHelper.ResolveHospitalIdsAsync(
                repository, request.HospitalIds ?? [], request.NewHospitals, cancellationToken);
            if (!hospitalIdsResult.IsSuccess)
                return Result.Failure<DoctorDto>(hospitalIdsResult.Errors);

            await repository.SetDoctorHospitalLinksAsync(doctor.Id, hospitalIdsResult.Value!, cancellationToken);
        }

        var saved = await repository.GetDoctorByIdAsync(doctor.Id, cancellationToken);
        return Result.Success(DoctorDtoMapper.Map(saved!, PublicSiteUrls.DoctorSharePage(configuration, doctor.UniqueCode)));
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

        var pageUrl = PublicSiteUrls.DoctorSharePage(configuration, doctor.UniqueCode);
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

        var pageUrl = PublicSiteUrls.DoctorSharePage(configuration, doctor.UniqueCode);
        var png = qrCodeService.GeneratePng(pageUrl, pixelsPerModule: 12);
        return Result.Success(png);
    }
}
