using Prilixor.Shared.Abstractions.DI;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace Prilixor.Shared.Extensions
{
    public static class ServiceExtensions
    {
        public static IServiceCollection UseDependencyInjectionScan(this IServiceCollection services, Assembly[] assemblies)
        {
            return services.Scan(selector =>
                selector.FromAssemblies(assemblies)
                .AddClasses(classes => classes.AssignableTo<IScopedService>())
                .AsImplementedInterfaces()
                .WithScopedLifetime()
                .AddClasses(classes => classes.AssignableTo<ITransientService>())
                .AsImplementedInterfaces()
                .WithTransientLifetime()
                .AddClasses(classes => classes.AssignableTo<ISingletonService>())
                .AsImplementedInterfaces()
                .WithSingletonLifetime()
                .AddClasses(classes => classes.AssignableTo<ISelfScopedService>())
                .AsSelf());
        }
    }
}
