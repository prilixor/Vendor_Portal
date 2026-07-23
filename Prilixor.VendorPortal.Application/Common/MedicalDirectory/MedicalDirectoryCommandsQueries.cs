using Microsoft.Extensions.Configuration;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Common;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Common.MedicalDirectory;

public sealed record HospitalDto(
    Guid Id,
    string Name,
    string? AddressLine1,
    string? City,
    string? State,
    string? PostalCode,
    decimal? Latitude,
    decimal? Longitude,
    string? ContactNumber,
    bool IsActive,
    IReadOnlyList<Guid>? DoctorIds = null,
    IReadOnlyList<string>? DoctorNames = null);

public sealed record DoctorDto(
    Guid Id,
    string FullName,
    string UniqueCode,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool IsActive,
    string? PublicPageUrl = null,
    IReadOnlyList<HospitalDto>? Hospitals = null);

public sealed record SearchDoctorsQuery(string? SearchTerm) : IQuery<List<DoctorDto>>;

internal sealed class SearchDoctorsQueryHandler(ICustomerRepository repository)
    : IQueryHandler<SearchDoctorsQuery, List<DoctorDto>>
{
    public async Task<Result<List<DoctorDto>>> Handle(SearchDoctorsQuery request, CancellationToken cancellationToken)
    {
        var doctors = await repository.SearchDoctorsAsync(request.SearchTerm ?? string.Empty, cancellationToken);
        return Result.Success(doctors.Select(d => DoctorDtoMapper.Map(d)).ToList());
    }
}

public sealed record GetDoctorByUniqueCodeQuery(string UniqueCode) : IQuery<DoctorDto>;

internal sealed class GetDoctorByUniqueCodeQueryHandler(ICustomerRepository repository, IConfiguration configuration)
    : IQueryHandler<GetDoctorByUniqueCodeQuery, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(GetDoctorByUniqueCodeQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UniqueCode))
            return Result.Failure<DoctorDto>(new Error("directory.doctor_code_required", "Doctor Unique ID is required.", ErrorCategory.Validation));

        var doctor = await repository.GetDoctorByUniqueCodeAsync(request.UniqueCode, cancellationToken);
        if (doctor is null)
            return Result.Failure<DoctorDto>(new Error("directory.doctor_not_found", "Doctor not found for this Unique ID.", ErrorCategory.NotFound));

        var baseUrl = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
        var pageUrl = $"{baseUrl}/dr/{doctor.UniqueCode}";
        return Result.Success(DoctorDtoMapper.Map(doctor, pageUrl));
    }
}

internal static class DoctorDtoMapper
{
    public static DoctorDto Map(Doctor d, string? publicPageUrl = null)
    {
        var hospitals = d.Hospitals?
            .Where(hd => hd.Hospital is not null && !hd.Hospital.IsDeleted)
            .Select(hd => HospitalDtoMapper.Map(hd.Hospital))
            .OrderBy(h => h.Name)
            .ToList() ?? [];

        return new DoctorDto(
            d.Id,
            d.FullName,
            d.UniqueCode,
            d.Email,
            d.Specialization,
            d.ContactNumber,
            d.IsActive,
            publicPageUrl,
            hospitals);
    }
}

internal static class HospitalDtoMapper
{
    public static HospitalDto Map(Hospital h) =>
        new(
            h.Id,
            h.Name,
            h.AddressLine1,
            h.City,
            h.State,
            h.PostalCode,
            h.Latitude,
            h.Longitude,
            h.ContactNumber,
            h.IsActive,
            h.Doctors?.Where(x => x.Doctor is not null && !x.Doctor.IsDeleted).Select(x => x.DoctorId).ToList(),
            h.Doctors?.Where(x => x.Doctor is not null && !x.Doctor.IsDeleted).Select(x => x.Doctor.FullName).OrderBy(n => n).ToList());
}
