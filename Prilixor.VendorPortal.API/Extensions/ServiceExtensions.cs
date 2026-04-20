using Prilixor.VendorPortal.Application;
using Prilixor.VendorPortal.Infrastructure;
using Prilixor.Shared.Extensions;

namespace Prilixor.VendorPortal.API.Extensions
{
    public static class ServiceExtensions
    {
        public static IServiceCollection ConfigureServices(this IServiceCollection services, IConfiguration configuration)
        {
            services.UseDependencyInjectionScan([
                Application.AssemblyReference.Assembly,
                Infrastructure.AssemblyReference.Assembly
            ]);

            services.ConfigureApplication(configuration);
            services.ConfigureInfrastructure(configuration);

            return services;
        }
    }
}
