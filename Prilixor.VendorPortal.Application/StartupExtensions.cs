using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Behaviours;
using Prilixor.VendorPortal.Application.Services;
using Mapster;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace Prilixor.VendorPortal.Application
{
    public static class StartupExtensions
    {
        public static IServiceCollection ConfigureApplication(this IServiceCollection services, IConfiguration configuration)
        {
            var currentAssembly = Assembly.GetExecutingAssembly();

            services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblies(currentAssembly));

            TypeAdapterConfig.GlobalSettings.Scan(Assembly.GetExecutingAssembly());

            services.AddScoped(typeof(IPipelineBehavior<,>), typeof(LoggingBehaviour<,>));
            services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));

            services.AddValidatorsFromAssembly(currentAssembly);

            services.AddHttpContextAccessor();

            // Configure SMTP options
            services.Configure<SmtpOptions>(configuration.GetSection("SmtpOptions"));
            services.AddTransient<IEmailService, SmtpEmailService>();

            return services;
        }
    }
}
