using Prilixor.Shared.Abstractions.CQRS;

namespace Prilixor.VendorPortal.Application.Support;

public record SupportTicketDto(
    string Id,
    string TicketNumber,
    string Category,
    string Subject,
    string Status,
    string? VendorEmail,
    string? VendorBusinessName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    SupportMessageDto? LatestMessage = null);

public record SupportMessageDto(
    string Id,
    string TicketId,
    string SenderId,
    string SenderType,
    string Message,
    DateTimeOffset CreatedAt,
    List<string>? AttachmentUrls = null);

public sealed record AiChatCommand(
    string VendorId,
    string Message,
    string? Category,
    string? Subject,
    bool ForceNewTicket = false,
    List<string>? AttachmentUrls = null) : ICommand<AiChatResult>;

public sealed record AiChatResult(
    SupportTicketDto Ticket,
    SupportMessageDto? AiMessage);