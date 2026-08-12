using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Prilixor.VendorPortal.Application.Support;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.API.Extensions;

namespace Prilixor.VendorPortal.API.EndPoints.Support;

public static class SupportEndpoints
{
    public static void MapSupportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/support").WithTags("Support");

        // Vendor Endpoints
        group.MapPost("tickets", CreateTicket)
            .WithName("CreateSupportTicket");

        group.MapGet("tickets/vendor/{vendorId}", GetVendorTickets)
            .WithName("GetVendorSupportTickets");

        group.MapGet("tickets/{ticketId}/messages", GetTicketMessages)
            .WithName("GetSupportTicketMessages");

        group.MapPost("tickets/{ticketId}/messages", SendMessage)
            .WithName("SendSupportMessage");

        // AI Chat Endpoint (vendor types a message, gets AI reply, ticket auto-created)
        group.MapPost("ai-chat", AiChat)
            .WithName("AiSupportChat");

        // File Upload for Support Attachments
        group.MapPost("upload", UploadSupportFile)
            .WithName("UploadSupportAttachment");

        // Admin Endpoints
        group.MapGet("admin/tickets", GetAllTickets)
            .WithName("GetAllSupportTickets");

        group.MapGet("admin/unread-count", GetAdminUnreadCount)
            .WithName("GetAdminSupportUnreadCount");

        group.MapPatch("admin/tickets/{ticketId}/status", UpdateTicketStatus)
            .WithName("UpdateSupportTicketStatus");
    }

    private static async Task<IResult> CreateTicket(
        [FromBody] CreateSupportTicketRequest request,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var command = new CreateSupportTicketCommand(request.VendorId, request.Category, request.Subject, request.Message);
        var result = await mediator.Send(command, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> GetVendorTickets(
        string vendorId,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var query = new GetVendorSupportTicketsQuery(vendorId);
        var result = await mediator.Send(query, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> GetTicketMessages(
        string ticketId,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken,
        [FromQuery] bool markReadForAdmin = false)
    {
        var query = new GetSupportTicketMessagesQuery(ticketId, markReadForAdmin);
        var result = await mediator.Send(query, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> SendMessage(
        string ticketId,
        [FromBody] SendSupportMessageRequest request,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        string? attachmentUrls = null;
        if (request.AttachmentUrls is { Count: > 0 })
        {
            attachmentUrls = System.Text.Json.JsonSerializer.Serialize(request.AttachmentUrls);
        }

        var command = new SendSupportMessageCommand(
            ticketId,
            request.SenderId,
            request.SenderType,
            request.Message,
            attachmentUrls);
        var result = await mediator.Send(command, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> AiChat(
        [FromBody] AiChatRequest request,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var command = new AiChatCommand(request.VendorId, request.Message, request.Category, request.Subject, request.ForceNewTicket, request.AttachmentUrls);
        var result = await mediator.Send(command, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> UploadSupportFile(
        HttpRequest request,
        IVendorUploadStorageService storage,
        CancellationToken cancellationToken)
    {
        // Reuse the file upload logic from Program.cs
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

        await using var readStream = file.OpenReadStream();
        var publicBase = new Uri($"{request.Scheme}://{request.Host}");
        var persist = await storage.PersistVendorUploadAsync(
            vendorId,
            file.FileName,
            file.ContentType,
            readStream,
            publicBase,
            cancellationToken,
            VendorFileFolderType.Support);

        return Results.Ok(new
        {
            fileUrl = persist.BrowserAccessibleUrl,
            fileName = Path.GetFileName(persist.StoredReference),
            originalFileName = file.FileName,
            contentType = file.ContentType,
            size = file.Length
        });
    }

    private static async Task<IResult> GetAllTickets(
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var query = new GetAllSupportTicketsQuery();
        var result = await mediator.Send(query, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }

    private static async Task<IResult> GetAdminUnreadCount(
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetAdminSupportUnreadCountQuery(), cancellationToken);
        return result.IsSuccess ? Results.Ok(new { count = result.Value }) : result.ToErrorResponse();
    }

    private static async Task<IResult> UpdateTicketStatus(
        string ticketId,
        [FromBody] UpdateTicketStatusRequest request,
        [FromServices] IMediator mediator,
        CancellationToken cancellationToken)
    {
        var command = new UpdateSupportTicketStatusCommand(ticketId, request.Status, request.AdminId);
        var result = await mediator.Send(command, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : result.ToErrorResponse();
    }
}

public record CreateSupportTicketRequest(string VendorId, string Category, string Subject, string Message);
public record SendSupportMessageRequest(
    string SenderId,
    string SenderType,
    string Message,
    List<string>? AttachmentUrls = null);
public record UpdateTicketStatusRequest(string Status, string AdminId);
public record AiChatRequest(string VendorId, string Message, string? Category, string? Subject, bool ForceNewTicket = false, List<string>? AttachmentUrls = null);
