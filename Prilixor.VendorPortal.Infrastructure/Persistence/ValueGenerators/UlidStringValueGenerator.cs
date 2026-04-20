using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.ValueGeneration;
using NUlid;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.ValueGenerators
{
    internal class UlidStringValueGenerator : ValueGenerator<string>
    {
        public override bool GeneratesTemporaryValues => false;

        public override string Next(EntityEntry entry)
        {
            return Ulid.NewUlid().ToString();
        }
    }
}
