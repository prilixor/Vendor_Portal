using Microsoft.Extensions.Configuration;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Common;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Common.MedicalDirectory;

public sealed record DoctorDto(
    Guid Id,
    string FullName,
    string UniqueCode,
    string Email,
    string? Specialization,
    string? ContactNumber,
    bool IsActive,
    string? PublicPageUrl = null);

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
    public static DoctorDto Map(Doctor d, string? publicPageUrl = null) =>
        new(d.Id, d.FullName, d.UniqueCode, d.Email, d.Specialization, d.ContactNumber, d.IsActive, publicPageUrl);
}
