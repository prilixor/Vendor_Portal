using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Support;
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
            SenderId = vendorId,
            SenderType = "Vendor",
            Message = request.InitialMessage,
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.AddSupportMessageAsync(message, cancellationToken);
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
        
        var dtos = tickets.Select(t => new SupportTicketDto(
            t.Id.ToString(),
            t.TicketNumber,
            t.Category,
            t.Subject,
            t.Status,
            null,
            null,
            t.CreatedOnUtc.ToSafeDateTimeOffset(),
            t.ModifiedOnUtc.ToSafeDateTimeOffset())).ToList();

        return Result.Success(dtos);
    }
}

public sealed record GetSupportTicketMessagesQuery(string TicketId) : IQuery<List<SupportMessageDto>>;

internal sealed class GetSupportTicketMessagesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetSupportTicketMessagesQuery, List<SupportMessageDto>>
{
    public async Task<Result<List<SupportMessageDto>>> Handle(GetSupportTicketMessagesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TicketId, out var ticketId))
        {
            return Result.Failure<List<SupportMessageDto>>(new Error("tickets.invalid_id", "Invalid ticket id.", ErrorCategory.Validation));
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

        var message = new SupportMessage
        {
            TicketId = ticketId,
            SenderId = senderId,
            SenderType = request.SenderType,
            Message = request.Message,
            AttachmentUrls = request.AttachmentUrls,
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.AddSupportMessageAsync(message, cancellationToken);
        
        if (request.SenderType == "Admin" && ticket.Status == "Open")
        {
            ticket.Status = "In Progress";
        }
        
        await repository.UpdateSupportTicketAsync(ticket, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

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
        
        var dtos = tickets.Select(t =>
        {
            SupportMessageDto? latestMessage = null;
            var latestMsg = t.Messages.OrderByDescending(m => m.CreatedOnUtc).FirstOrDefault();
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

            return new SupportTicketDto(
                t.Id.ToString(),
                t.TicketNumber,
                t.Category,
                t.Subject,
                t.Status,
                t.Vendor?.Email,
                null,
                t.CreatedOnUtc.ToSafeDateTimeOffset(),
                t.ModifiedOnUtc.ToSafeDateTimeOffset(),
                latestMessage);
        }).ToList();

        return Result.Success(dtos);
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

        var vendorMessage = new SupportMessage
        {
            TicketId = ticket.Id,
            SenderId = vendorId,
            SenderType = "Vendor",
            Message = request.Message,
            AttachmentUrls = attachmentUrlsJson,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddSupportMessageAsync(vendorMessage, cancellationToken);

        // Get conversation history for context (last 10 messages)
        var allMessages = await repository.GetSupportMessagesByTicketIdAsync(ticket.Id, cancellationToken);
        var conversationHistory = allMessages
            .OrderByDescending(m => m.CreatedOnUtc)
            .Take(10)
            .OrderBy(m => m.CreatedOnUtc)
            .Select(m => new { m.SenderType, m.Message })
            .ToList();

        // Get AI response with conversation history
        var aiResponse = await aiSupportService.GenerateResponseAsync(
            request.Message,
            request.Category ?? ticket.Category,
            request.Subject ?? ticket.Subject,
            cancellationToken,
            conversationHistory.Select(m => (m.SenderType, m.Message)).ToList());

        // Save AI's response as a message
        var aiMessage = new SupportMessage
        {
            TicketId = ticket.Id,
            SenderId = Guid.Empty,
            SenderType = "AI",
            Message = aiResponse.Message,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddSupportMessageAsync(aiMessage, cancellationToken);

        // Don't overwrite admin-set status — only set "Open" for new tickets (default)
        if (activeTicket is null)
        {
            ticket.Status = "Open";
        }
        // Reopen resolved tickets when vendor sends new message (Closed tickets are never reused)
        else if (ticket.Status is "Resolved")
        {
            ticket.Status = "Open";
        }
        // If admins set it to "In Progress", keep it there

        await repository.UpdateSupportTicketAsync(ticket, cancellationToken);
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

        var aiMessageDto = new SupportMessageDto(
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