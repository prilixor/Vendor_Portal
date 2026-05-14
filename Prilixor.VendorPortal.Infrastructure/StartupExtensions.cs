using Amazon;
using Amazon.S3;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Infrastructure.Persistence;
using Prilixor.VendorPortal.Infrastructure.Services;

namespace Prilixor.VendorPortal.Infrastructure
{
    public static class StartupExtensions
    {
        public static IServiceCollection ConfigureInfrastructure(this IServiceCollection services,
            IConfiguration configuration,
            IHostEnvironment environment)
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
            services.AddScoped<IPushNotificationService, WebPushNotificationService>();
            services.Configure<WebPushOptions>(configuration.GetSection(WebPushOptions.SectionName));

            // Configure Groq AI Support
            services.Configure<GroqOptions>(configuration.GetSection(GroqOptions.SectionName));
            services.AddHttpClient("Groq", client =>
            {
                client.Timeout = TimeSpan.FromSeconds(30);
            });
            services.AddScoped<IAiSupportService, GroqSupportService>();

            RegisterVendorStorage(services, configuration, environment);

            return services;
        }

        private static void RegisterVendorStorage(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
        {
            services.Configure<S3StorageOptions>(configuration.GetSection(S3StorageOptions.SectionName));
            services.Configure<VendorPortalAssetUrlOptions>(
                configuration.GetSection(VendorPortalAssetUrlOptions.SectionName));

            var s3Startup = configuration.GetSection(S3StorageOptions.SectionName).Get<S3StorageOptions>();
            var hasExplicitCredentials = !string.IsNullOrWhiteSpace(s3Startup?.AccessKeyId)
                && !string.IsNullOrWhiteSpace(s3Startup.SecretAccessKey);
            var hasAwsEnvCredentials = !string.IsNullOrWhiteSpace(configuration["AWS_ACCESS_KEY_ID"])
                && !string.IsNullOrWhiteSpace(configuration["AWS_SECRET_ACCESS_KEY"]);
            var hasAwsProfile = !string.IsNullOrWhiteSpace(configuration["AWS_PROFILE"]);
            var allowAwsClient = s3Startup?.Enabled == true
                && !string.IsNullOrWhiteSpace(s3Startup.BucketName)
                && (!environment.IsDevelopment() || hasExplicitCredentials || hasAwsEnvCredentials || hasAwsProfile);

            if (allowAwsClient)
            {
                services.AddSingleton<IAmazonS3>(sp =>
                {
                    var opt = sp.GetRequiredService<IOptions<S3StorageOptions>>().Value;
                    var cfg = new AmazonS3Config
                    {
                        RegionEndpoint = RegionEndpoint.GetBySystemName(string.IsNullOrWhiteSpace(opt.Region) ? "us-east-1" : opt.Region)
                    };
                    if (!string.IsNullOrEmpty(opt.AccessKeyId) && !string.IsNullOrEmpty(opt.SecretAccessKey))
                    {
                        if (!string.IsNullOrEmpty(opt.SessionToken))
                            return new AmazonS3Client(opt.AccessKeyId, opt.SecretAccessKey, opt.SessionToken, cfg);
                        return new AmazonS3Client(opt.AccessKeyId, opt.SecretAccessKey, cfg);
                    }
                    return new AmazonS3Client(cfg);
                });
            }

            services.AddScoped<IVendorFileUrlResolver>(sp =>
            {
                var s3Opts = sp.GetRequiredService<IOptions<S3StorageOptions>>();
                var assetOpts = sp.GetRequiredService<IOptions<VendorPortalAssetUrlOptions>>();
                var enabled = s3Opts.Value.Enabled && !string.IsNullOrWhiteSpace(s3Opts.Value.BucketName);
                var client = enabled ? sp.GetService<IAmazonS3>() : null;
                return new VendorFileUrlResolver(s3Opts, assetOpts, client);
            });

            services.AddScoped<IVendorUploadStorageService>(sp =>
            {
                var env = sp.GetRequiredService<IWebHostEnvironment>();
                var s3Opts = sp.GetRequiredService<IOptions<S3StorageOptions>>();
                var assetOpts = sp.GetRequiredService<IOptions<VendorPortalAssetUrlOptions>>();
                var enabled = s3Opts.Value.Enabled && !string.IsNullOrWhiteSpace(s3Opts.Value.BucketName);
                var client = enabled ? sp.GetService<IAmazonS3>() : null;
                return new VendorUploadStorageService(env, s3Opts, assetOpts, client);
            });
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
