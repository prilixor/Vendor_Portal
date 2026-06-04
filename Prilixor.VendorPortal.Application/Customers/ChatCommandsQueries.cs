using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ChatSessionDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    Guid VendorId,
    string VendorName,
    Guid? OrderId,
    string? OrderNumber,
    string Subject,
    DateTimeOffset LastMessageAt,
    bool IsClosed);

public sealed record ChatMessageDto(
    Guid Id,
    Guid ChatSessionId,
    string SenderType,
    string MessageText,
    DateTimeOffset SentAt,
    bool IsRead);

// Query: Get Customer Chat Sessions
public sealed record GetCustomerChatSessionsQuery(Guid CustomerId) : IQuery<List<ChatSessionDto>>;

internal sealed class GetCustomerChatSessionsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerChatSessionsQuery, List<ChatSessionDto>>
{
    public async Task<Result<List<ChatSessionDto>>> Handle(
        GetCustomerChatSessionsQuery request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<List<ChatSessionDto>>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var sessions = await customers.GetCustomerChatSessionsAsync(request.CustomerId, cancellationToken);
        var dtos = new List<ChatSessionDto>();

        foreach (var s in sessions)
        {
            var vendorName = await customers.GetVendorBusinessNameAsync(s.VendorId, cancellationToken) ?? "Store";
            string? orderNumber = null;

            if (s.OrderId.HasValue)
            {
                var order = await customers.GetCustomerOrderAsync(request.CustomerId, s.OrderId.Value, cancellationToken);
                orderNumber = order?.Order.OrderNumber;
            }

            dtos.Add(new ChatSessionDto(
                s.Id,
                s.CustomerId,
                customer.FullName,
                s.VendorId,
                vendorName,
                s.OrderId,
                orderNumber,
                s.Subject,
                s.LastMessageAt,
                s.IsClosed));
        }

        return Result.Success(dtos);
    }
}

// Query: Get Vendor Chat Sessions
public sealed record GetVendorChatSessionsQuery(Guid VendorId) : IQuery<List<ChatSessionDto>>;

internal sealed class GetVendorChatSessionsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorChatSessionsQuery, List<ChatSessionDto>>
{
    public async Task<Result<List<ChatSessionDto>>> Handle(
        GetVendorChatSessionsQuery request, 
        CancellationToken cancellationToken)
    {
        var sessions = await customers.GetVendorChatSessionsAsync(request.VendorId, cancellationToken);
        var dtos = new List<ChatSessionDto>();

        foreach (var s in sessions)
        {
            var customer = await customers.GetCustomerByIdAsync(s.CustomerId, cancellationToken);
            var customerName = customer?.FullName ?? "Customer";
            var vendorName = await customers.GetVendorBusinessNameAsync(s.VendorId, cancellationToken) ?? "Store";
            string? orderNumber = null;

            if (s.OrderId.HasValue)
            {
                var order = await customers.GetCustomerOrderAsync(s.CustomerId, s.OrderId.Value, cancellationToken);
                orderNumber = order?.Order.OrderNumber;
            }

            dtos.Add(new ChatSessionDto(
                s.Id,
                s.CustomerId,
                customerName,
                s.VendorId,
                vendorName,
                s.OrderId,
                orderNumber,
                s.Subject,
                s.LastMessageAt,
                s.IsClosed));
        }

        return Result.Success(dtos);
    }
}

// Command: Create Chat Session
public sealed record CreateChatSessionCommand(
    Guid CustomerId,
    Guid VendorId,
    Guid? OrderId,
    string Subject) : ICommand<ChatSessionDto>;

internal sealed class CreateChatSessionCommandHandler(ICustomerRepository customers)
    : ICommandHandler<CreateChatSessionCommand, ChatSessionDto>
{
    public async Task<Result<ChatSessionDto>> Handle(
        CreateChatSessionCommand request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<ChatSessionDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var vendorName = await customers.GetVendorBusinessNameAsync(request.VendorId, cancellationToken);
        if (vendorName is null)
            return Result.Failure<ChatSessionDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));

        var s = await customers.GetChatSessionAsync(request.CustomerId, request.VendorId, request.OrderId, cancellationToken);

        if (s is null)
        {
            s = new ChatSession
            {
                Id = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                VendorId = request.VendorId,
                OrderId = request.OrderId,
                Subject = string.IsNullOrWhiteSpace(request.Subject) ? "Chat Session" : request.Subject.Trim(),
                LastMessageAt = DateTimeOffset.UtcNow,
                IsClosed = false,
                CreatedOnUtc = DateTime.UtcNow,
                ModifiedOnUtc = DateTime.UtcNow
            };
            await customers.AddChatSessionAsync(s, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
        }

        string? orderNumber = null;
        if (s.OrderId.HasValue)
        {
            var order = await customers.GetCustomerOrderAsync(request.CustomerId, s.OrderId.Value, cancellationToken);
            orderNumber = order?.Order.OrderNumber;
        }

        return Result.Success(new ChatSessionDto(
            s.Id,
            s.CustomerId,
            customer.FullName,
            s.VendorId,
            vendorName,
            s.OrderId,
            orderNumber,
            s.Subject,
            s.LastMessageAt,
            s.IsClosed));
    }
}

// Command: Send Chat Message
public sealed record SendChatMessageCommand(
    Guid ChatSessionId,
    string SenderType,
    string MessageText) : ICommand<ChatMessageDto>;

internal sealed class SendChatMessageCommandHandler(ICustomerRepository customers)
    : ICommandHandler<SendChatMessageCommand, ChatMessageDto>
{
    public async Task<Result<ChatMessageDto>> Handle(
        SendChatMessageCommand request, 
        CancellationToken cancellationToken)
    {
        var session = await customers.GetChatSessionByIdAsync(request.ChatSessionId, cancellationToken);
        if (session is null)
            return Result.Failure<ChatMessageDto>(new Error("chats.session_not_found", "Chat session not found.", ErrorCategory.NotFound));

        if (session.IsClosed)
            return Result.Failure<ChatMessageDto>(new Error("chats.session_closed", "This chat session is closed.", ErrorCategory.Validation));

        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ChatSessionId = request.ChatSessionId,
            SenderType = request.SenderType,
            MessageText = request.MessageText.Trim(),
            SentAt = DateTimeOffset.UtcNow,
            IsRead = false,
            CreatedOnUtc = DateTime.UtcNow,
            ModifiedOnUtc = DateTime.UtcNow
        };

        await customers.AddChatMessageAsync(msg, cancellationToken);
        
        session.LastMessageAt = msg.SentAt;
        session.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateChatSessionAsync(session, cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new ChatMessageDto(
            msg.Id,
            msg.ChatSessionId,
            msg.SenderType,
            msg.MessageText,
            msg.SentAt,
            msg.IsRead));
    }
}

// Query: Get Chat Messages
public sealed record GetChatMessagesQuery(Guid ChatSessionId) : IQuery<List<ChatMessageDto>>;

internal sealed class GetChatMessagesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetChatMessagesQuery, List<ChatMessageDto>>
{
    public async Task<Result<List<ChatMessageDto>>> Handle(
        GetChatMessagesQuery request, 
        CancellationToken cancellationToken)
    {
        var session = await customers.GetChatSessionByIdAsync(request.ChatSessionId, cancellationToken);
        if (session is null)
            return Result.Failure<List<ChatMessageDto>>(new Error("chats.session_not_found", "Chat session not found.", ErrorCategory.NotFound));

        var messages = await customers.GetChatMessagesAsync(request.ChatSessionId, cancellationToken);
        var dtos = messages.ConvertAll(m => new ChatMessageDto(
            m.Id,
            m.ChatSessionId,
            m.SenderType,
            m.MessageText,
            m.SentAt,
            m.IsRead));

        return Result.Success(dtos);
    }
}
