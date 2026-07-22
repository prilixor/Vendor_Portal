namespace Prilixor.VendorPortal.Domain.Common;

public class HospitalDoctor
{
    public Guid HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;
}
