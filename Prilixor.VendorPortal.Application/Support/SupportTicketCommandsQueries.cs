using FluentValidation;
using MediatR;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Support;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Extensions;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace Prilixor.VendorPortal.Application.Support;

#region Vendor Commands/Queries

public sealed record CreateSupportTicketCommand(string VendorId, string Category, string Subject, string InitialMessage) : ICommand<SupportTicketDto>;

public sealed class CreateSupportTicketCommandValidator : AbstractValidator<CreateSupportTicketCommand>
{
    public CreateSupportTicketCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.InitialMessage).NotEmpty().MaximumLength(2000);
    }
}

internal sealed class CreateSupportTicketCommandHandler(
    IVendorOnboardingRepository repository,
    ILogger<CreateSupportTicketCommandHandler> logger)
    : ICommandHandler<CreateSupportTicketCommand, SupportTicketDto>
{
    public async Task<Result<SupportTicketDto>> Handle(CreateSupportTicketCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<SupportTicketDto>(new Error("vendors.invalid_id", "Invalid vendor id.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<SupportTicketDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var ticketNumber = $"TK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        
        var ticket = new SupportTicket
        {
            Id = Guid.NewGuid(),
            VendorId = vendorId,
            TicketNumber = ticketNumber,
            Category = request.Category,
            Subject = request.Subject,
            Status = "Open",
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.AddSupportTicketAsync(ticket, cancellationToken);
        
        var message = new SupportMessage
        {
            TicketId = ticket.Id,
            Ticket = ticket,
            SenderId = vendorId,
            SenderType = "Vendor",
            Message = request.InitialMessage,
            IsRead = false,
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.AddSupportMessageAsync(message, cancellationToken);
        await SupportAdminAlertHelper.NotifyAdminsAsync(
            repository,
            ticket,
            vendor.Email,
            request.InitialMessage,
            "vendor.support.message",
            cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new SupportTicketDto(
            ticket.Id.ToString(),
            ticket.TicketNumber,
            ticket.Category,
            ticket.Subject,
            ticket.Status,
            vendor.Email,
            null,
            ticket.CreatedOnUtc.ToSafeDateTimeOffset(),
            ticket.ModifiedOnUtc.ToSafeDateTimeOffset()));
    }
}

public sealed record GetVendorSupportTicketsQuery(string VendorId) : IQuery<List<SupportTicketDto>>;

internal sealed class GetVendorSupportTicketsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorSupportTicketsQuery, List<SupportTicketDto>>
{
    public async Task<Result<List<SupportTicketDto>>> Handle(GetVendorSupportTicketsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<SupportTicketDto>>(new Error("vendors.invalid_id", "Invalid vendor id.", ErrorCategory.Validation));
        }

        var tickets = await repository.GetSupportTicketsByVendorIdAsync(vendorId, cancellationToken);
        
        var dtos = tickets.Select(t =>
        {
            SupportMessageDto? latestMessage = null;
            var latestMsg = t.Messages?.Where(m => !m.IsDeleted).OrderByDescending(m => m.CreatedOnUtc).FirstOrDefault();
            if (latestMsg is not null)
            {
                List<string>? attachmentUrls = null;
                if (!string.IsNullOrWhiteSpace(latestMsg.AttachmentUrls))
                {
                    try { attachmentUrls = JsonSerializer.Deserialize<List<string>>(latestMsg.AttachmentUrls); }
                    catch { /* ignore */ }
                }

                latestMessage = new SupportMessageDto(
                    latestMsg.Id.ToString(),
                    latestMsg.TicketId.ToString(),
                    latestMsg.SenderId.ToString(),
                    latestMsg.SenderType,
                    latestMsg.Message,
                    latestMsg.CreatedOnUtc.ToSafeDateTimeOffset(),
                    attachmentUrls);
            }

            return new SupportTicketDto(
                t.Id.ToString(),
                t.TicketNumber,
                t.Category,
                t.Subject,
                t.Status,
                null,
                null,
                t.CreatedOnUtc.ToSafeDateTimeOffset(),
                t.ModifiedOnUtc.ToSafeDateTimeOffset(),
                latestMessage);
        }).ToList();

        return Result.Success(dtos);
    }
}

public sealed record GetSupportTicketMessagesQuery(string TicketId, bool MarkReadForAdmin = false) : IQuery<List<SupportMessageDto>>;

internal sealed class GetSupportTicketMessagesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetSupportTicketMessagesQuery, List<SupportMessageDto>>
{
    public async Task<Result<List<SupportMessageDto>>> Handle(GetSupportTicketMessagesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TicketId, out var ticketId))
        {
            return Result.Failure<List<SupportMessageDto>>(new Error("tickets.invalid_id", "Invalid ticket id.", ErrorCategory.Validation));
        }

        if (request.MarkReadForAdmin)
        {
            var marked = await repository.MarkSupportMessagesReadForAdminAsync(ticketId, cancellationToken);
            if (marked > 0)
                await repository.SaveChangesAsync(cancellationToken);
        }

        var messages = await repository.GetSupportMessagesByTicketIdAsync(ticketId, cancellationToken);
        
        var dtos = messages.Select(m =>
        {
            List<string>? attachmentUrls = null;
            if (!string.IsNullOrWhiteSpace(m.AttachmentUrls))
            {
                try { attachmentUrls = JsonSerializer.Deserialize<List<string>>(m.AttachmentUrls); }
                catch { /* ignore parse errors */ }
            }

            return new SupportMessageDto(
                m.Id.ToString(),
                m.TicketId.ToString(),
                m.SenderId.ToString(),
                m.SenderType,
                m.Message,
                m.CreatedOnUtc.ToSafeDateTimeOffset(),
                attachmentUrls);
        }).ToList();

        return Result.Success(dtos);
    }
}

public sealed record SendSupportMessageCommand(string TicketId, string SenderId, string SenderType, string Message, string? AttachmentUrls = null) : ICommand<SupportMessageDto>;

internal sealed class SendSupportMessageCommandHandler(
    IVendorOnboardingRepository repository,
    IMediator mediator,
    ILogger<SendSupportMessageCommandHandler> logger)
    : ICommandHandler<SendSupportMessageCommand, SupportMessageDto>
{
    public async Task<Result<SupportMessageDto>> Handle(SendSupportMessageCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TicketId, out var ticketId))
        {
            return Result.Failure<SupportMessageDto>(new Error("tickets.invalid_id", "Invalid ticket id.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.SenderId, out var senderId))
        {
            return Result.Failure<SupportMessageDto>(new Error("senders.invalid_id", "Invalid sender id.", ErrorCategory.Validation));
        }

        var ticket = await repository.GetSupportTicketByIdAsync(ticketId, cancellationToken);
        if (ticket is null)
        {
            return Result.Failure<SupportMessageDto>(new Error("tickets.not_found", "Ticket not found.", ErrorCategory.NotFound));
        }

        if (ticket.Status == "Closed")
        {
            return Result.Failure<SupportMessageDto>(new Error("tickets.closed", "Cannot send messages to a closed ticket.", ErrorCategory.Validation));
        }

        var isAdmin = string.Equals(request.SenderType, "Admin", StringComparison.OrdinalIgnoreCase);
        var isVendor = string.Equals(request.SenderType, "Vendor", StringComparison.OrdinalIgnoreCase);

        var priorUnreadForAdmin = 0;
        if (isVendor)
            priorUnreadForAdmin = await repository.CountUnreadAdminSupportMessagesForTicketAsync(ticketId, cancellationToken);

        var message = new SupportMessage
        {
            TicketId = ticketId,
            SenderId = senderId,
            SenderType = request.SenderType,
            Message = request.Message,
            AttachmentUrls = request.AttachmentUrls,
            IsRead = !isVendor, // vendor → admin inbox unread; admin/AI already "seen"
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.AddSupportMessageAsync(message, cancellationToken);
        
        if (isAdmin && ticket.Status == "Open")
        {
            ticket.Status = "In Progress";
        }

        // Vendor follow-up on a Resolved ticket reopens it for the admin inbox.
        if (isVendor && string.Equals(ticket.Status, "Resolved", StringComparison.OrdinalIgnoreCase))
        {
            ticket.Status = "Open";
        }
        
        await repository.UpdateSupportTicketAsync(ticket, cancellationToken);

        if (isVendor && priorUnreadForAdmin == 0)
        {
            var vendor = await repository.GetVendorByIdAsync(ticket.VendorId, cancellationToken);
            await SupportAdminAlertHelper.NotifyAdminsAsync(
                repository,
                ticket,
                vendor?.Email ?? "Vendor",
                request.Message,
                "vendor.support.message",
                cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);

        if (isAdmin)
        {
            // Admin reply clears their inbox unread for this ticket.
            await repository.MarkSupportMessagesReadForAdminAsync(ticketId, cancellationToken);
            await repository.SaveChangesAsync(cancellationToken);

            var snippet = request.Message.Trim();
            if (snippet.Length > 100) snippet = snippet[..100] + "…";
            try
            {
                await mediator.Send(
                    new CreateVendorNotificationCommand(
                        ticket.VendorId.ToString(),
                        "support_chat_reply",
                        "BlinksMed support replied",
                        $"Ticket {ticket.TicketNumber}: {snippet}",
                        "in_app",
                        "sent"),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to notify vendor {VendorId} of support reply on ticket {TicketId}", ticket.VendorId, ticket.Id);
            }
        }

        List<string>? attachmentUrls = null;
        if (!string.IsNullOrWhiteSpace(message.AttachmentUrls))
        {
            try { attachmentUrls = JsonSerializer.Deserialize<List<string>>(message.AttachmentUrls); }
            catch { /* ignore parse errors */ }
        }

        return Result.Success(new SupportMessageDto(
            message.Id.ToString(),
            message.TicketId.ToString(),
            message.SenderId.ToString(),
            message.SenderType,
            message.Message,
            message.CreatedOnUtc.ToSafeDateTimeOffset(),
            attachmentUrls));
    }
}

#endregion

#region Admin Commands/Queries

public sealed record GetAllSupportTicketsQuery() : IQuery<List<SupportTicketDto>>;

internal sealed class GetAllSupportTicketsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAllSupportTicketsQuery, List<SupportTicketDto>>
{
    public async Task<Result<List<SupportTicketDto>>> Handle(GetAllSupportTicketsQuery request, CancellationToken cancellationToken)
    {
        var tickets = await repository.GetSupportTicketsAsync(cancellationToken);
        var unreadByTicket = await repository.GetUnreadAdminSupportCountsByTicketAsync(cancellationToken);
        
        var dtos = tickets.Select(t =>
        {
            SupportMessageDto? latestMessage = null;
            var latestMsg = t.Messages?
                .Where(m => !m.IsDeleted)
                .OrderByDescending(m => m.CreatedOnUtc)
                .FirstOrDefault();
            if (latestMsg != null)
            {
                List<string>? attachmentUrls = null;
                if (!string.IsNullOrWhiteSpace(latestMsg.AttachmentUrls))
                {
                    try { attachmentUrls = JsonSerializer.Deserialize<List<string>>(latestMsg.AttachmentUrls); }
                    catch { /* ignore parse errors */ }
                }
                latestMessage = new SupportMessageDto(
                    latestMsg.Id.ToString(),
                    latestMsg.TicketId.ToString(),
                    latestMsg.SenderId.ToString(),
                    latestMsg.SenderType,
                    latestMsg.Message,
                    latestMsg.CreatedOnUtc.ToSafeDateTimeOffset(),
                    attachmentUrls);
            }

            unreadByTicket.TryGetValue(t.Id, out var unread);

            var activityAt = latestMsg?.CreatedOnUtc.ToSafeDateTimeOffset()
                ?? t.ModifiedOnUtc.ToSafeDateTimeOffset()
                ?? t.CreatedOnUtc.ToSafeDateTimeOffset();

            return new
            {
                Dto = new SupportTicketDto(
                    t.Id.ToString(),
                    t.TicketNumber,
                    t.Category,
                    t.Subject,
                    t.Status,
                    t.Vendor?.Email,
                    t.Vendor?.Profile?.BusinessName,
                    t.CreatedOnUtc.ToSafeDateTimeOffset(),
                    activityAt,
                    latestMessage,
                    unread),
                SortAt = activityAt,
                Unread = unread
            };
        })
        .OrderByDescending(x => x.Unread > 0)
        .ThenByDescending(x => x.SortAt)
        .Select(x => x.Dto)
        .ToList();

        return Result.Success(dtos);
    }
}

public sealed record GetAdminSupportUnreadCountQuery() : IQuery<int>;

internal sealed class GetAdminSupportUnreadCountQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminSupportUnreadCountQuery, int>
{
    public async Task<Result<int>> Handle(GetAdminSupportUnreadCountQuery request, CancellationToken cancellationToken)
    {
        var count = await repository.CountUnreadAdminSupportMessagesAsync(cancellationToken);
        return Result.Success(count);
    }
}

public sealed record UpdateSupportTicketStatusCommand(string TicketId, string Status, string AdminId) : ICommand<bool>;

internal sealed class UpdateSupportTicketStatusCommandHandler(
    IVendorOnboardingRepository repository,
    ILogger<UpdateSupportTicketStatusCommandHandler> logger)
    : ICommandHandler<UpdateSupportTicketStatusCommand, bool>
{
    public async Task<Result<bool>> Handle(UpdateSupportTicketStatusCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TicketId, out var ticketId))
        {
            return Result.Failure<bool>(new Error("tickets.invalid_id", "Invalid ticket id.", ErrorCategory.Validation));
        }

        var ticket = await repository.GetSupportTicketByIdAsync(ticketId, cancellationToken);
        if (ticket is null)
        {
            return Result.Failure<bool>(new Error("tickets.not_found", "Ticket not found.", ErrorCategory.NotFound));
        }

        ticket.Status = request.Status;

        await repository.UpdateSupportTicketAsync(ticket, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}

#endregion

#region AI Chat Command

public sealed class AiChatCommandHandlerValidator : AbstractValidator<AiChatCommand>
{
    public AiChatCommandHandlerValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Message).NotEmpty().MaximumLength(2000);
    }
}

internal sealed class AiChatCommandHandler(
    IVendorOnboardingRepository repository,
    IAiSupportService aiSupportService,
    ILogger<AiChatCommandHandler> logger)
    : ICommandHandler<AiChatCommand, AiChatResult>
{
    public async Task<Result<AiChatResult>> Handle(AiChatCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<AiChatResult>(new Error("vendors.invalid_id", "Invalid vendor id.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<AiChatResult>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        // Find an active ticket for this vendor, or create a new one (unless forced new ticket)
        // Resolved tickets CAN be reopened by vendor; Closed tickets CANNOT
        SupportTicket? activeTicket = null;
        if (!request.ForceNewTicket)
        {
            var existingTickets = await repository.GetSupportTicketsByVendorIdAsync(vendorId, cancellationToken);
            activeTicket = existingTickets.FirstOrDefault(t => t.Status != "Closed");
        }

        SupportTicket ticket;
        if (activeTicket is null)
        {
            // Create a new ticket behind the scenes
            var ticketNumber = $"TK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
            ticket = new SupportTicket
            {
                Id = Guid.NewGuid(),
                VendorId = vendorId,
                TicketNumber = ticketNumber,
                Category = request.Category ?? "General",
                Subject = request.Subject ?? $"Chat: {request.Message[..Math.Min(request.Message.Length, 80)]}",
                Status = "Open",
                CreatedOnUtc = DateTime.UtcNow
            };
            await repository.AddSupportTicketAsync(ticket, cancellationToken);
        }
        else
        {
            ticket = activeTicket;
        }

        // Save the vendor's message (with attachment URLs if any)
        var attachmentUrlsJson = request.AttachmentUrls != null && request.AttachmentUrls.Count > 0
            ? JsonSerializer.Serialize(request.AttachmentUrls)
            : null;

        var priorUnreadForAdmin =
            await repository.CountUnreadAdminSupportMessagesForTicketAsync(ticket.Id, cancellationToken);

        var vendorMessage = new SupportMessage
        {
            TicketId = ticket.Id,
            Ticket = ticket,
            SenderId = vendorId,
            SenderType = "Vendor",
            Message = request.Message,
            AttachmentUrls = attachmentUrlsJson,
            IsRead = false,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddSupportMessageAsync(vendorMessage, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        var refreshedTicket = await repository.GetSupportTicketByIdAsync(ticket.Id, cancellationToken);
        if (refreshedTicket is not null)
        {
            ticket = refreshedTicket;
        }

        var orderedMessages = (await repository.GetSupportMessagesByTicketIdAsync(ticket.Id, cancellationToken))
            .OrderBy(m => m.CreatedOnUtc)
            .ToList();

        if (SupportAiReplyPolicy.IsVendorHumanThread(ticket, orderedMessages))
        {
            if (ticket.Status == "Resolved")
            {
                ticket.Status = "Open";
                await repository.UpdateSupportTicketAsync(ticket, cancellationToken);
            }

            if (priorUnreadForAdmin == 0)
            {
                await SupportAdminAlertHelper.NotifyAdminsAsync(
                    repository,
                    ticket,
                    vendor.Email,
                    request.Message,
                    "vendor.support.message",
                    cancellationToken);
            }

            await repository.SaveChangesAsync(cancellationToken);

            var humanThreadTicketDto = new SupportTicketDto(
                ticket.Id.ToString(),
                ticket.TicketNumber,
                ticket.Category,
                ticket.Subject,
                ticket.Status,
                vendor.Email,
                null,
                ticket.CreatedOnUtc.ToSafeDateTimeOffset(),
                ticket.ModifiedOnUtc.ToSafeDateTimeOffset());

            return Result.Success(new AiChatResult(humanThreadTicketDto, null));
        }

        SupportMessage? aiMessage = null;
        var escalatedToHuman = false;

        if (SupportAiReplyPolicy.ShouldGenerateAiReply(ticket, orderedMessages))
        {
            var conversationHistory = orderedMessages
                .TakeLast(10)
                .Select(m => (m.SenderType, m.Message))
                .ToList();

            var aiResponse = await aiSupportService.GenerateResponseAsync(
                request.Message,
                request.Category ?? ticket.Category,
                request.Subject ?? ticket.Subject,
                cancellationToken,
                conversationHistory);

            var replyText = SupportAiReplyPolicy.NormalizeAiReply(aiResponse.Message, aiResponse.CanAnswer);
            escalatedToHuman = !aiResponse.CanAnswer || SupportAiReplyPolicy.IsEscalationText(replyText);

            var shouldPersistAiReply = !SupportAiReplyPolicy.IsEscalationText(replyText)
                || !SupportAiReplyPolicy.HasEscalationReply(orderedMessages);

            if (shouldPersistAiReply && !string.IsNullOrWhiteSpace(replyText))
            {
                aiMessage = new SupportMessage
                {
                    TicketId = ticket.Id,
                    Ticket = ticket,
                    SenderId = Guid.Empty,
                    SenderType = "AI",
                    Message = replyText,
                    // Escalation is an admin inbox signal: vendor needs a human.
                    IsRead = !escalatedToHuman,
                    CreatedOnUtc = DateTime.UtcNow
                };
                await repository.AddSupportMessageAsync(aiMessage, cancellationToken);
            }
        }
        else
        {
            logger.LogInformation(
                "Skipping AI reply for ticket {TicketId} — human engaged or escalation already sent.",
                ticket.Id);
        }

        // Reopen resolved tickets when vendor sends new message (Closed tickets are never reused)
        if (activeTicket != null)
        {
            if (ticket.Status == "Resolved")
            {
                ticket.Status = "Open";
            }
            await repository.UpdateSupportTicketAsync(ticket, cancellationToken);
        }

        // Only alert admins when the bot hands off — normal AI Q&A should not ping Support.
        if (escalatedToHuman)
        {
            await SupportAdminAlertHelper.NotifyAdminsAsync(
                repository,
                ticket,
                vendor.Email,
                $"Vendor needs human support: \"{SupportAdminAlertHelper.TrimSnippet(request.Message)}\"",
                "vendor.support.escalation",
                cancellationToken);
        }
        else
        {
            // AI answered without escalation — do not leave admin-inbox unread noise.
            vendorMessage.IsRead = true;
        }

        await repository.SaveChangesAsync(cancellationToken);

        var ticketDto = new SupportTicketDto(
            ticket.Id.ToString(),
            ticket.TicketNumber,
            ticket.Category,
            ticket.Subject,
            ticket.Status,
            vendor.Email,
            null,
            ticket.CreatedOnUtc.ToSafeDateTimeOffset(),
            ticket.ModifiedOnUtc.ToSafeDateTimeOffset());

        var aiMessageDto = aiMessage is null
            ? null
            : new SupportMessageDto(
                aiMessage.Id.ToString(),
                aiMessage.TicketId.ToString(),
                aiMessage.SenderId.ToString(),
                aiMessage.SenderType,
                aiMessage.Message,
                aiMessage.CreatedOnUtc.ToSafeDateTimeOffset());

        return Result.Success(new AiChatResult(ticketDto, aiMessageDto));
    }
}

#endregion

internal static class SupportAdminAlertHelper
{
    public static string TrimSnippet(string message)
    {
        var snippet = message.Trim();
        return snippet.Length > 80 ? snippet[..80] + "…" : snippet;
    }

    public static async Task NotifyAdminsAsync(
        IVendorOnboardingRepository repository,
        SupportTicket ticket,
        string vendorLabel,
        string messageText,
        string actionType,
        CancellationToken cancellationToken)
    {
        var admins = await repository.GetAdminUsersAsync(cancellationToken);
        var systemAdmin = admins.FirstOrDefault(a => a.IsActive) ?? admins.FirstOrDefault();
        if (systemAdmin is null)
            return;

        var snippet = TrimSnippet(messageText);
        await repository.AddAdminAuditLogAsync(
            new AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = systemAdmin.Id,
                ActionType = actionType,
                EntityType = "support_ticket",
                EntityId = ticket.Id,
                NewValue =
                    $"{{\"ticketId\":\"{ticket.Id}\",\"ticketNumber\":\"{ticket.TicketNumber}\",\"vendorId\":\"{ticket.VendorId}\"}}",
                Notes = $"{vendorLabel} · {ticket.TicketNumber}: \"{snippet}\"",
            },
            cancellationToken);
    }
}