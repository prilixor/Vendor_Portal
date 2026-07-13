using FluentValidation;
using MediatR;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Common;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Common.MedicalDirectory;

public sealed record HospitalDto(Guid Id, string Name, string? AddressLine1, string? City, string? State, string? PostalCode, bool IsVerified);
public sealed record DoctorDto(Guid Id, string FullName, string? Specialization, string? ContactNumber, bool IsVerified);

// Queries
public sealed record SearchHospitalsQuery(string? SearchTerm) : IQuery<List<HospitalDto>>;

internal sealed class SearchHospitalsQueryHandler(ICustomerRepository repository)
    : IQueryHandler<SearchHospitalsQuery, List<HospitalDto>>
{
    public async Task<Result<List<HospitalDto>>> Handle(SearchHospitalsQuery request, CancellationToken cancellationToken)
    {
        var hospitals = await repository.SearchHospitalsAsync(request.SearchTerm ?? string.Empty, cancellationToken);
        return Result.Success(hospitals.Select(h => new HospitalDto(h.Id, h.Name, h.AddressLine1, h.City, h.State, h.PostalCode, h.IsVerified)).ToList());
    }
}

public sealed record SearchDoctorsQuery(Guid? HospitalId, string? SearchTerm) : IQuery<List<DoctorDto>>;

internal sealed class SearchDoctorsQueryHandler(ICustomerRepository repository)
    : IQueryHandler<SearchDoctorsQuery, List<DoctorDto>>
{
    public async Task<Result<List<DoctorDto>>> Handle(SearchDoctorsQuery request, CancellationToken cancellationToken)
    {
        var doctors = await repository.SearchDoctorsAsync(request.HospitalId, request.SearchTerm ?? string.Empty, cancellationToken);
        return Result.Success(doctors.Select(d => new DoctorDto(d.Id, d.FullName, d.Specialization, d.ContactNumber, d.IsVerified)).ToList());
    }
}

// Commands
public sealed record CreateHospitalCommand(string Name, string? AddressLine1, string? City, string? State, string? PostalCode) : ICommand<HospitalDto>;

internal sealed class CreateHospitalCommandHandler(ICustomerRepository repository)
    : ICommandHandler<CreateHospitalCommand, HospitalDto>
{
    public async Task<Result<HospitalDto>> Handle(CreateHospitalCommand request, CancellationToken cancellationToken)
    {
        var hospital = new Hospital
        {
            Name = request.Name,
            AddressLine1 = request.AddressLine1,
            City = request.City,
            State = request.State,
            PostalCode = request.PostalCode,
            IsVerified = true // Auto-approved based on CEO feedback
        };
        
        await repository.AddHospitalAsync(hospital, cancellationToken);
        return Result.Success(new HospitalDto(hospital.Id, hospital.Name, hospital.AddressLine1, hospital.City, hospital.State, hospital.PostalCode, hospital.IsVerified));
    }
}

public sealed record CreateDoctorCommand(Guid HospitalId, string FullName, string? Specialization, string? ContactNumber) : ICommand<DoctorDto>;

internal sealed class CreateDoctorCommandHandler(ICustomerRepository repository)
    : ICommandHandler<CreateDoctorCommand, DoctorDto>
{
    public async Task<Result<DoctorDto>> Handle(CreateDoctorCommand request, CancellationToken cancellationToken)
    {
        var hospital = await repository.GetHospitalByIdAsync(request.HospitalId, cancellationToken);
        if (hospital is null)
        {
            return Result.Failure<DoctorDto>(new Error("directory.hospital_not_found", "Hospital not found", ErrorCategory.NotFound));
        }

        var doctor = new Doctor
        {
            FullName = request.FullName,
            Specialization = request.Specialization,
            ContactNumber = request.ContactNumber,
            IsVerified = true // Auto-approved based on CEO feedback
        };
        
        await repository.AddDoctorAsync(doctor, cancellationToken);
        await repository.LinkDoctorToHospitalAsync(request.HospitalId, doctor.Id, cancellationToken);
        
        return Result.Success(new DoctorDto(doctor.Id, doctor.FullName, doctor.Specialization, doctor.ContactNumber, doctor.IsVerified));
    }
}
