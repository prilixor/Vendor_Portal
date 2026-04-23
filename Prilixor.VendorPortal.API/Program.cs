using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Domain.Options;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
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
var jwtOptions = builder.Configuration.GetSection("JwtOptions").Get<JwtOptions>() ?? new JwtOptions();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    var corsOptions = builder.Configuration.GetSection("CorsOptions").Get<CorsOptions>();
    options.AddDefaultPolicy(policy =>
    {
        if (corsOptions?.Origins != null && corsOptions.Origins.Length > 0)
        {
            policy.WithOrigins("https://vendor-portal-psi-amber.vercel.app/", "https://localhost:7257/api")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }

    });
});

builder.Services.Configure<JsonOptions>(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

app.UseCors();

app.UseAuthentication()
    .UseAuthorization();

app.UseStaticFiles();

app.MapPost("/api/files/upload", async (HttpRequest request, IWebHostEnvironment environment, CancellationToken cancellationToken) =>
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { detail = "Request must be multipart/form-data." });
    }

    var form = await request.ReadFormAsync(cancellationToken);
    var file = form.Files["file"] ?? form.Files.FirstOrDefault();
    var vendorId = (form["vendorId"].ToString() ?? "common").Trim();

    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { detail = "No file provided." });
    }

    var uploadsRoot = Path.Combine(environment.ContentRootPath, "wwwroot", "uploads", "vendors", string.IsNullOrWhiteSpace(vendorId) ? "common" : vendorId);
    Directory.CreateDirectory(uploadsRoot);

    var extension = Path.GetExtension(file.FileName);
    var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{extension}";
    var filePath = Path.Combine(uploadsRoot, storedFileName);

    await using (var stream = File.Create(filePath))
    {
        await file.CopyToAsync(stream, cancellationToken);
    }

    var relativeUrl = $"/uploads/vendors/{(string.IsNullOrWhiteSpace(vendorId) ? "common" : vendorId)}/{storedFileName}";
    var absoluteUrl = $"{request.Scheme}://{request.Host}{relativeUrl}";

    return Results.Ok(new
    {
        fileUrl = absoluteUrl,
        fileName = storedFileName,
        originalFileName = file.FileName,
        contentType = file.ContentType,
        size = file.Length
    });
});

app.UseFastEndpoints(op =>
{
    op.Endpoints.RoutePrefix = "api";
}).UseSwaggerGen();


app.UseHttpsRedirection();
app.UseExceptionHandler();

app.Run();
