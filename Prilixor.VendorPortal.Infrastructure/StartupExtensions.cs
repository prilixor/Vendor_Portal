using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Infrastructure.Persistence;
using Prilixor.VendorPortal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Prilixor.VendorPortal.Infrastructure
{
    public static class StartupExtensions
    {
        public static IServiceCollection ConfigureInfrastructure(this IServiceCollection services,
            IConfiguration configuration)
        {
            services.AddOptions(configuration);

            var databaseOptions = configuration.GetSection(nameof(ApplicationOptions.DataBaseOptions))
                .Get<DataBaseOptions>();

            services.AddDbContext<ApplicationDbContext>(cfg =>
            {
                cfg.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));
                cfg.EnableDetailedErrors(databaseOptions?.EnableDetailedErrors ?? false);
            });

            services.AddScoped<IEmailService, SmtpEmailService>();

            return services;
        }

        private static IServiceCollection AddOptions(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<DataBaseOptions>(
                configuration.GetSection(nameof(ApplicationOptions.DataBaseOptions)));

            services.Configure<SmtpOptions>(
                configuration.GetSection(nameof(SmtpOptions)));

            return services;
        }
    }
}
