namespace Prilixor.VendorPortal.Domain.Options
{
    public class DataBaseOptions
    {
        public bool EnableDetailedErrors { get; set; }
        public bool UseTransaction { get; set; } = true;
        public bool UseSoftDelete { get; set; } = true;
        public bool CleanDBWithStartUp { get; set; }
    }
}
