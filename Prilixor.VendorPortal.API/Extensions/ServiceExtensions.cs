using Prilixor.VendorPortal.Application;
using Prilixor.VendorPortal.Infrastructure;
using Prilixor.Shared.Extensions;
using Microsoft.Extensions.Hosting;

namespace Prilixor.VendorPortal.API.Extensions
{
    public static class ServiceExtensions
    {
        public static IServiceCollection ConfigureServices(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
        {
            services.UseDependencyInjectionScan([
                Application.AssemblyReference.Assembly,
                Infrastructure.AssemblyReference.Assembly
            ]);

            services.ConfigureApplication(configuration);
            services.ConfigureInfrastructure(configuration, environment);

            return services;
        }
    }
}
