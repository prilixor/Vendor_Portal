using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.API.Services;

public sealed class LegalDocumentSeedHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<LegalDocumentSeedHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ILegalDocumentRepository>();
            await repository.EnsureSeededAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Legal document seed skipped.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
