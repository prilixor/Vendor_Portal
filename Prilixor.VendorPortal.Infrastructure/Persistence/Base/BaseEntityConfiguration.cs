using Prilixor.VendorPortal.Infrastructure.Persistence.ValueGenerators;
using Prilixor.Shared.Abstractions.DB;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Base
{
    internal abstract class BaseEntityConfiguration<TEntity, TId> : IEntityTypeConfiguration<TEntity>
        where TEntity : Entity<TId>
        where TId : IEquatable<TId>
    {
        public void Configure(EntityTypeBuilder<TEntity> builder)
        {
            builder.HasKey(e => e.Id);

            var idProperty = builder.Property(e => e.Id);

            if (typeof(TId) == typeof(string))
            {
                idProperty
                    .HasValueGenerator<UlidStringValueGenerator>()
                    .ValueGeneratedOnAdd();
            }
            else
            {
                idProperty.ValueGeneratedOnAdd();
            }

            ConfigureEntity(builder);
        }

        protected abstract void ConfigureEntity(EntityTypeBuilder<TEntity> builder);
    }
}
