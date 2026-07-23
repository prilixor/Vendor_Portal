using Microsoft.Extensions.Configuration;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;
using Prilixor.VendorPortal.Domain.Common;

namespace Prilixor.VendorPortal.Application.Admin.Hospitals;

public sealed record CreateHospitalInput(
    string Name,
    string? AddressLine1,
    string? City,
    string? State,
    string? PostalCode,
    decimal? Latitude,
    decimal? Longitude,
    string? ContactNumber);

public sealed record ListAdminHospitalsQuery(string? Search, bool? IsActive) : IQuery<List<HospitalDto>>;

internal sealed class ListAdminHospitalsQueryHandler(ICustomerRepository repository)
    : IQueryHandler<ListAdminHospitalsQuery, List<HospitalDto>>
{
    public async Task<Result<List<HospitalDto>>> Handle(ListAdminHospitalsQuery request, CancellationToken cancellationToken)
    {
        var list = await repository.ListHospitalsForAdminAsync(request.Search, request.IsActive, cancellationToken);
        return Result.Success(list.Select(HospitalDtoMapper.Map).ToList());
    }
}

public sealed record GetAdminHospitalQuery(Guid Id) : IQuery<HospitalDto>;

internal sealed class GetAdminHospitalQueryHandler(ICustomerRepository repository)
    : IQueryHandler<GetAdminHospitalQuery, HospitalDto>
{
    public async Task<Result<HospitalDto>> Handle(GetAdminHospitalQuery request, CancellationToken cancellationToken)
    {
        var hospital = await repository.GetHospitalByIdAsync(request.Id, cancellationToken);
        if (hospital is null)
            return Result.Failure<HospitalDto>(new Error("directory.hospital_not_found", "Hospital not found.", ErrorCategory.NotFound));
        return Result.Success(HospitalDtoMapper.Map(hospital));
    }
}

public sealed record CreateAdminHospitalCommand(
    string Name,
    string? AddressLine1,
    string? City,
    string? State,
    string? PostalCode,
    decimal? Latitude,
    decimal? Longitude,
    string? ContactNumber,
    IReadOnlyList<Guid>? DoctorIds = null) : ICommand<HospitalDto>;

internal sealed class CreateAdminHospitalCommandHandler(ICustomerRepository repository)
    : ICommandHandler<CreateAdminHospitalCommand, HospitalDto>
{
    public async Task<Result<HospitalDto>> Handle(CreateAdminHospitalCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Result.Failure<HospitalDto>(new Error("directory.hospital_name_required", "Hospital name is required.", ErrorCategory.Validation));

        var hospital = new Hospital
        {
            Name = request.Name.Trim(),
            AddressLine1 = NullIfWhite(request.AddressLine1),
            City = NullIfWhite(request.City),
            State = NullIfWhite(request.State),
            PostalCode = NullIfWhite(request.PostalCode),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            ContactNumber = NullIfWhite(request.ContactNumber),
            IsActive = true,
        };

        await repository.AddHospitalAsync(hospital, cancellationToken);

        if (request.DoctorIds is { Count: > 0 })
            await repository.SetHospitalDoctorLinksAsync(hospital.Id, request.DoctorIds, cancellationToken);

        var saved = await repository.GetHospitalByIdAsync(hospital.Id, cancellationToken);
        return Result.Success(HospitalDtoMapper.Map(saved!));
    }

    private static string? NullIfWhite(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record UpdateAdminHospitalCommand(
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
    IReadOnlyList<Guid>? DoctorIds = null) : ICommand<HospitalDto>;

internal sealed class UpdateAdminHospitalCommandHandler(ICustomerRepository repository)
    : ICommandHandler<UpdateAdminHospitalCommand, HospitalDto>
{
    public async Task<Result<HospitalDto>> Handle(UpdateAdminHospitalCommand request, CancellationToken cancellationToken)
    {
        var hospital = await repository.GetHospitalByIdAsync(request.Id, cancellationToken);
        if (hospital is null)
            return Result.Failure<HospitalDto>(new Error("directory.hospital_not_found", "Hospital not found.", ErrorCategory.NotFound));

        if (string.IsNullOrWhiteSpace(request.Name))
            return Result.Failure<HospitalDto>(new Error("directory.hospital_name_required", "Hospital name is required.", ErrorCategory.Validation));

        hospital.Name = request.Name.Trim();
        hospital.AddressLine1 = string.IsNullOrWhiteSpace(request.AddressLine1) ? null : request.AddressLine1.Trim();
        hospital.City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim();
        hospital.State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim();
        hospital.PostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim();
        hospital.Latitude = request.Latitude;
        hospital.Longitude = request.Longitude;
        hospital.ContactNumber = string.IsNullOrWhiteSpace(request.ContactNumber) ? null : request.ContactNumber.Trim();
        hospital.IsActive = request.IsActive;

        await repository.UpdateHospitalAsync(hospital, cancellationToken);

        if (request.DoctorIds is not null)
            await repository.SetHospitalDoctorLinksAsync(hospital.Id, request.DoctorIds, cancellationToken);

        var saved = await repository.GetHospitalByIdAsync(hospital.Id, cancellationToken);
        return Result.Success(HospitalDtoMapper.Map(saved!));
    }
}

public sealed record SoftDeleteAdminHospitalCommand(Guid Id, Guid? DeletedBy) : ICommand<bool>;

internal sealed class SoftDeleteAdminHospitalCommandHandler(ICustomerRepository repository)
    : ICommandHandler<SoftDeleteAdminHospitalCommand, bool>
{
    public async Task<Result<bool>> Handle(SoftDeleteAdminHospitalCommand request, CancellationToken cancellationToken)
    {
        var hospital = await repository.GetHospitalByIdAsync(request.Id, cancellationToken);
        if (hospital is null)
            return Result.Failure<bool>(new Error("directory.hospital_not_found", "Hospital not found.", ErrorCategory.NotFound));

        await repository.SoftDeleteHospitalAsync(request.Id, request.DeletedBy, cancellationToken);
        return Result.Success(true);
    }
}
