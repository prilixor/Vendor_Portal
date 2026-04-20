using FastEndpoints;
using FastEndpoints.Swagger;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Domain.Options;
using Microsoft.AspNetCore.Http.Json;
using Serilog;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureServices(builder.Configuration);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddFastEndpoints()
    .SwaggerDocument();

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    var corsOptions = builder.Configuration.GetSection("CorsOptions").Get<CorsOptions>();
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOptions is null ? [] : corsOptions.Origins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.Configure<JsonOptions>(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

app.UseAuthentication()
    .UseAuthorization();

app.UseFastEndpoints(op =>
{
    op.Endpoints.RoutePrefix = "api";
}).UseSwaggerGen();

app.UseCors();
app.UseHttpsRedirection();
app.UseExceptionHandler();

app.Run();
