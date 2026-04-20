using Ardalis.Specification.EntityFrameworkCore;
using Prilixor.Shared.Abstractions.DB;
using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Base
{
    internal abstract class BaseRepository<T>(ApplicationDbContext dbContext) :
        RepositoryBase<T>(dbContext) where T : class, ISoftDelete
    {
        public override async Task<T> AddAsync(T entity, CancellationToken cancellationToken = default)
        {
            dbContext.Set<T>().Add(entity);
            return entity;
        }

        public new async Task<IEnumerable<T>> AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
        {
            await dbContext.Set<T>().AddRangeAsync(entities);
            return entities;
        }

        public new async Task<int> UpdateAsync(T entity, CancellationToken cancellationToken = default)
        {
            dbContext.Set<T>().Update(entity);
            return 1;
        }

        public new async Task<int> UpdateRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
        {
            dbContext.Set<T>().UpdateRange(entities);
            return entities.Count();
        }

        public new async Task<int> DeleteAsync(T entity, CancellationToken cancellationToken = default)
        {
            dbContext.Set<T>().Remove(entity);
            return 1;
        }

        public new async Task<int> DeleteRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default)
        {
            dbContext.Set<T>().RemoveRange(entities);
            return entities.Count();
        }

        public override async Task<T?> GetByIdAsync<TId>(TId id, CancellationToken cancellationToken = default)
        {
            return await dbContext.Set<T>()
                .Where(e => !e.IsDeleted)
                .SingleOrDefaultAsync(e => EF.Property<TId>(e, "Id").Equals(id), cancellationToken);
        }
    }
}
