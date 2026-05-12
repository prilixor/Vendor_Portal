using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureServices(builder.Configuration, builder.Environment);

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
            policy.WithOrigins(corsOptions.Origins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        }
        else
        {
            policy.WithOrigins(
                "http://localhost:5173",
                "https://vendor-portal-psi-amber.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
        }
    });
});

builder.Services.Configure<JsonOptions>(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors();

app.UseAuthentication()
    .UseAuthorization();

app.UseStaticFiles();

app.MapPost("/api/files/upload", async (HttpRequest request, IVendorUploadStorageService storage, CancellationToken cancellationToken) =>
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { detail = "Request must be multipart/form-data." });
    }

    var form = await request.ReadFormAsync(cancellationToken);
    var file = form.Files["file"] ?? form.Files.FirstOrDefault();
    var vendorId = (form["vendorId"].ToString() ?? "common").Trim();
    var folderTypeStr = (form["folderType"].ToString() ?? "Documents").Trim();
    
    // Parse folder type
    var folderType = Enum.TryParse<VendorFileFolderType>(folderTypeStr, true, out var parsed) 
        ? parsed 
        : VendorFileFolderType.Documents;

    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { detail = "No file provided." });
    }

    await using var readStream = file.OpenReadStream();
    var publicBase = new Uri($"{request.Scheme}://{request.Host}");
    var persist = await storage.PersistVendorUploadAsync(
        vendorId,
        file.FileName,
        file.ContentType,
        readStream,
        publicBase,
        cancellationToken,
        folderType);

    var storageKey = persist.StoredReference.StartsWith("http", StringComparison.OrdinalIgnoreCase)
        ? null
        : persist.StoredReference;

    return Results.Ok(new
    {
        fileUrl = persist.BrowserAccessibleUrl,
        storageKey,
        fileName = Path.GetFileName(persist.StoredReference),
        originalFileName = file.FileName,
        contentType = file.ContentType,
        size = file.Length
    });
});

app.MapGet("/api/files/download", async (
    HttpRequest request,
    IWebHostEnvironment environment,
    string url,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(url))
        return Results.BadRequest(new { detail = "File url is required." });

    if (!Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out var parsed))
        return Results.BadRequest(new { detail = "Invalid file url." });

    if (!parsed.IsAbsoluteUri)
    {
        var relativePath = parsed.OriginalString.TrimStart('/', '\\').Replace('\\', '/');
        var uploadsRoot = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "wwwroot"));
        var combined = Path.Combine(environment.ContentRootPath, "wwwroot", relativePath.Replace('/', Path.DirectorySeparatorChar));
        var fullPath = Path.GetFullPath(combined);
        if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(fullPath))
            return Results.NotFound();

            var localFileName = Path.GetFileName(fullPath);
            var localContentType = "application/octet-stream";
            // Prefer inline disposition for previewing in-browser (images, PDFs).
            request.HttpContext.Response.Headers["Content-Disposition"] = $"inline; filename=\"{localFileName}\"";
            return Results.File(fullPath, localContentType, enableRangeProcessing: true);
    }

    using var httpClient = new HttpClient();
    using var response = await httpClient.GetAsync(parsed, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    if (!response.IsSuccessStatusCode)
        return Results.StatusCode((int)response.StatusCode);

    var remoteContentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
    var remoteFileName = Path.GetFileName(parsed.LocalPath);
    var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    // Allow inline display when embedded in an iframe/img.
    request.HttpContext.Response.Headers["Content-Disposition"] = $"inline; filename=\"{remoteFileName}\"";
    return Results.File(stream, remoteContentType, enableRangeProcessing: true);
});

app.UseFastEndpoints(op =>
{
    op.Endpoints.RoutePrefix = "api";
}).UseSwaggerGen();

app.Run();
