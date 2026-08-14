using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.API.EndPoints.Support;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Prilixor.VendorPortal.API.EndPoints.Common;

try
{

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureServices(builder.Configuration, builder.Environment);
builder.Services.Configure<Prilixor.VendorPortal.Domain.Options.BootstrapSuperAdminOptions>(
    builder.Configuration.GetSection(Prilixor.VendorPortal.Domain.Options.BootstrapSuperAdminOptions.SectionName));
builder.Services.AddHostedService<Prilixor.VendorPortal.API.Services.BootstrapSuperAdminHostedService>();
builder.Services.AddHostedService<Prilixor.VendorPortal.API.Services.CustomerExpirationReminderHostedService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();
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
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier,
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CustomerOnly", policy =>
        policy.RequireAuthenticatedUser().RequireRole("customer"));
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireAuthenticatedUser().RequireRole("admin"));
    options.AddPolicy("VendorOnly", policy =>
        policy.RequireAuthenticatedUser().RequireRole("vendor"));

    foreach (var (code, _, _, _) in Prilixor.VendorPortal.Application.Onboarding.AdminPermissions.Catalog)
    {
        var permissionCode = code;
        options.AddPolicy($"Perm:{permissionCode}", policy =>
            policy.RequireAuthenticatedUser()
                .RequireRole("admin")
                .AddRequirements(new Prilixor.VendorPortal.API.Authorization.PermissionRequirement(permissionCode)));
    }
});
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler,
    Prilixor.VendorPortal.API.Authorization.PermissionAuthorizationHandler>();

builder.Services.AddCors(options =>
{
    var corsOptions = builder.Configuration.GetSection("CorsOptions").Get<CorsOptions>();
   options.AddDefaultPolicy(policy =>
    {
        if (corsOptions?.Origins != null && corsOptions.Origins.Length > 0)
        {
            // Flutter Web (localhost:3000/3001) uploads multipart + Authorization → preflight.
            policy.WithOrigins(corsOptions.Origins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.SetIsOriginAllowed(origin => true) // Allow all localhost ports for Flutter Web
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        }
    });
});

builder.Services.Configure<JsonOptions>(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)));

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (context.Request.PathBase.HasValue && context.Request.PathBase.Value.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
    {
        context.Request.Path = context.Request.PathBase + context.Request.Path;
        context.Request.PathBase = "";
    }
    await next();
});

app.UseRouting();

app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors();

app.UseAuthentication()
    .UseAuthorization();

app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    RequestPath = "/api"
});

var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads");
var uploadsVendorsPath = Path.Combine(uploadsPath, "vendors");

// Best-effort creation of local upload folders. Under IIS the app pool identity may not
// have write access to the content root; if so we log and continue instead of crashing the
// whole app at startup (uploads still work through the configured storage provider, e.g. S3).
try
{
    Directory.CreateDirectory(uploadsPath);
    Directory.CreateDirectory(uploadsVendorsPath);
}
catch (Exception ex)
{
    Log.Warning(ex,
        "Could not create local upload directories under {ContentRoot}. Local static file serving for uploads will be skipped; ensure the app pool identity has write access or rely on the configured storage provider.",
        builder.Environment.ContentRootPath);
}

if (Directory.Exists(uploadsVendorsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsVendorsPath),
        RequestPath = "/api/vendors"
    });
}

if (Directory.Exists(uploadsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
        RequestPath = "/api/uploads"
    });
}

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

    var thumbnailStorageKey = string.IsNullOrWhiteSpace(persist.ThumbnailStoredReference)
        ? null
        : persist.ThumbnailStoredReference.StartsWith("http", StringComparison.OrdinalIgnoreCase)
            ? null
            : persist.ThumbnailStoredReference;

    return Results.Ok(new
    {
        fileUrl = persist.BrowserAccessibleUrl,
        storageKey,
        thumbnailUrl = persist.ThumbnailBrowserAccessibleUrl,
        thumbnailStorageKey,
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
        if (relativePath.StartsWith("api/", StringComparison.OrdinalIgnoreCase))
        {
            relativePath = relativePath["api/".Length..];
        }
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

    try
    {
        using var httpClient = new HttpClient();
        using var response = await httpClient.GetAsync(parsed, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
            return Results.Json(new { detail = $"Remote server returned {(int)response.StatusCode} {response.ReasonPhrase}" }, statusCode: (int)response.StatusCode);

        var remoteContentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        var remoteFileName = Path.GetFileName(parsed.LocalPath);

        // Stream remote response into a temp file and return a FileStream with DeleteOnClose.
        var ext = Path.GetExtension(remoteFileName);
        var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ext);
        // Create file with DeleteOnClose so it is removed when the response stream is closed.
        var tempStream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 81920, FileOptions.DeleteOnClose);
        try
        {
            await response.Content.CopyToAsync(tempStream, cancellationToken);
            tempStream.Seek(0, SeekOrigin.Begin);
            // Allow inline display when embedded in an iframe/img.
            request.HttpContext.Response.Headers["Content-Disposition"] = $"inline; filename=\"{remoteFileName}\"";
            return Results.File(tempStream, remoteContentType, enableRangeProcessing: true);
        }
        catch
        {
            // Ensure we dispose tempStream and let DeleteOnClose remove the file if anything goes wrong here.
            tempStream.Dispose();
            throw;
        }
    }
    catch (HttpRequestException ex)
    {
        Log.Error(ex, "Failed to download remote file: {Url}", url);
        return Results.Json(new { detail = "Failed to fetch remote file.", error = ex.Message }, statusCode: 502);
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        return Results.StatusCode(499); // Client Closed Request
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Unexpected error while proxying file download: {Url}", url);
        return Results.Json(new { detail = "Unexpected error while fetching remote file." }, statusCode: 500);
    }
});

app.UseFastEndpoints(op =>
{
    op.Endpoints.RoutePrefix = "api";
}).UseSwaggerGen();

app.MapSupportEndpoints();
app.MapMedicalDirectoryEndpoints();

app.Run();

}
catch (Exception ex)
{
    // Record any fatal startup exception to a file next to the app so failures under IIS
    // (which otherwise surface only as opaque 500.30 / 502.5 pages) can be diagnosed.
    try
    {
        var fatalPath = Path.Combine(AppContext.BaseDirectory, "FATAL_STARTUP_ERROR.txt");
        File.WriteAllText(fatalPath, DateTimeOffset.UtcNow.ToString("o") + Environment.NewLine + ex);
    }
    catch
    {
        // Ignore secondary failures while recording the fatal error.
    }

    throw;
}
