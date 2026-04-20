using Prilixor.VendorPortal.Domain.Options;
using Prilixor.Shared.Abstractions.DB;
using Prilixor.Shared.Abstractions.DI;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Prilixor.VendorPortal.Infrastructure.Persistence
{
    internal sealed class UnitOfWork(
        ApplicationDbContext dbContext,
        IPublisher domainEventsPublisher,
        IOptions<DataBaseOptions> dbOptions) : IUnitOfWork, IScopedService
    {
        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var savedResult = dbOptions.Value.UseTransaction
                ? await SaveChangesWithTransactionAsync(cancellationToken)
                : await SaveChangesWithoutTransactionAsync(cancellationToken);

            await PublishDomainEventsAsync(cancellationToken);
            return savedResult;
        }

        private async Task<int> SaveChangesWithTransactionAsync(CancellationToken cancellationToken)
        {
            using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var result = await SaveChangesWithoutTransactionAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }

        private async Task<int> SaveChangesWithoutTransactionAsync(CancellationToken cancellationToken = default)
        {
            if (dbOptions.Value.UseSoftDelete)
            {
                HandleSoftDelete();
            }

            HandleAuditableEntities();
            return await dbContext.SaveChangesAsync(cancellationToken);
        }

        private async Task PublishDomainEventsAsync(CancellationToken cancellationToken = default)
        {
            var domainEvents = dbContext.ChangeTracker.Entries<IEntity>()
                .Select(x => x.Entity)
                .Where(x => x.DomainEvents.Any())
                .SelectMany(x =>
                {
                    var events = x.DomainEvents.ToList();
                    x.ClearDomainEvents();
                    return events;
                })
                .ToList();

            foreach (var domainEvent in domainEvents)
            {
                await domainEventsPublisher.Publish(domainEvent, cancellationToken);
            }
        }

        private void HandleSoftDelete()
        {
            var softDeleteEntities = dbContext.ChangeTracker.Entries<ISoftDelete>()
                .Where(x => x.State == EntityState.Deleted);

            foreach (var softDeleteEntity in softDeleteEntities)
            {
                softDeleteEntity.State = EntityState.Modified;
                softDeleteEntity.Property(nameof(ISoftDelete.IsDeleted)).CurrentValue = true;
            }
        }

        private void HandleAuditableEntities()
        {
            var auditableEntities = dbContext.ChangeTracker.Entries<IAuditable>();

            foreach (var auditableEntity in auditableEntities)
            {
                if (auditableEntity.State == EntityState.Added)
                {
                    auditableEntity.Property(x => x.CreatedOnUtc).CurrentValue = DateTime.UtcNow;
                    auditableEntity.Property(x => x.CreatedBy).CurrentValue = null;
                    auditableEntity.Property(x => x.ModifiedOnUtc).CurrentValue = DateTime.UtcNow;
                    auditableEntity.Property(x => x.ModifiedBy).CurrentValue = null;
                }

                if (auditableEntity.State == EntityState.Modified)
                {
                    auditableEntity.Property(x => x.ModifiedOnUtc).CurrentValue = DateTime.UtcNow;
                    auditableEntity.Property(x => x.ModifiedBy).CurrentValue = null;
                }
            }
        }
    }
}
