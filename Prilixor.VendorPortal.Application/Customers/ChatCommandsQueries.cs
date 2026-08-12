using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ChatSessionDto(
    Guid Id,
    Guid CustomerId,
    string CustomerName,
    Guid? VendorId,
    string VendorName,
    string CounterpartyType,
    string CounterpartyName,
    Guid? OrderId,
    string? OrderNumber,
    string Subject,
    DateTimeOffset LastMessageAt,
    bool IsClosed,
    int UnreadCount = 0);

public sealed record ChatMessageDto(
    Guid Id,
    Guid ChatSessionId,
    string SenderType,
    string MessageText,
    DateTimeOffset SentAt,
    bool IsRead);

internal static class ChatSessionMapping
{
    public const string AdminDisplayName = "BlinksMed Support";

    public static async Task<(string VendorName, string CounterpartyName)> ResolveNamesAsync(
        ICustomerRepository customers,
        ChatSession session,
        CancellationToken cancellationToken)
    {
        string vendorName = "Store";
        if (session.VendorId.HasValue)
            vendorName = await customers.GetVendorBusinessNameAsync(session.VendorId.Value, cancellationToken) ?? "Store";

        var counterpartyName = string.Equals(session.CounterpartyType, ChatCounterpartyTypes.Admin, StringComparison.OrdinalIgnoreCase)
            ? AdminDisplayName
            : vendorName;

        return (vendorName, counterpartyName);
    }

    public static ChatSessionDto ToDto(
        ChatSession session,
        string customerName,
        string vendorName,
        string counterpartyName,
        string? orderNumber,
        int unreadCount = 0) =>
        new(
            session.Id,
            session.CustomerId,
            customerName,
            session.VendorId,
            vendorName,
            session.CounterpartyType,
            counterpartyName,
            session.OrderId,
            orderNumber,
            session.Subject,
            session.LastMessageAt,
            session.IsClosed,
            unreadCount);
}

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
        var unreadBySession = await customers.GetUnreadChatCountsBySessionAsync(
            sessions.Select(s => s.Id).ToList(),
            "Admin",
            cancellationToken);
        var dtos = new List<ChatSessionDto>();

        foreach (var s in sessions)
        {
            var (vendorName, counterpartyName) = await ChatSessionMapping.ResolveNamesAsync(customers, s, cancellationToken);
            string? orderNumber = null;

            if (s.OrderId.HasValue)
            {
                var order = await customers.GetCustomerOrderAsync(request.CustomerId, s.OrderId.Value, cancellationToken);
                orderNumber = order?.Order.OrderNumber;
            }

            unreadBySession.TryGetValue(s.Id, out var unread);
            dtos.Add(ChatSessionMapping.ToDto(s, customer.FullName, vendorName, counterpartyName, orderNumber, unread));
        }

        return Result.Success(dtos);
    }
}

// Query: Get Vendor Chat Sessions (legacy Vendor counterparty only)
public sealed record GetVendorChatSessionsQuery(Guid VendorId) : IQuery<List<ChatSessionDto>>;

internal sealed class GetVendorChatSessionsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorChatSessionsQuery, List<ChatSessionDto>>
{
    public async Task<Result<List<ChatSessionDto>>> Handle(
        GetVendorChatSessionsQuery request,
        CancellationToken cancellationToken)
    {
        var sessions = await customers.GetVendorChatSessionsAsync(request.VendorId, cancellationToken);
        var unreadBySession = await customers.GetUnreadChatCountsBySessionAsync(
            sessions.Select(s => s.Id).ToList(),
            "Customer",
            cancellationToken);
        var dtos = new List<ChatSessionDto>();

        foreach (var s in sessions)
        {
            var customer = await customers.GetCustomerByIdAsync(s.CustomerId, cancellationToken);
            var customerName = customer?.FullName ?? "Customer";
            var (vendorName, counterpartyName) = await ChatSessionMapping.ResolveNamesAsync(customers, s, cancellationToken);
            string? orderNumber = null;

            if (s.OrderId.HasValue)
            {
                var order = await customers.GetCustomerOrderAsync(s.CustomerId, s.OrderId.Value, cancellationToken);
                orderNumber = order?.Order.OrderNumber;
            }

            unreadBySession.TryGetValue(s.Id, out var unread);
            dtos.Add(ChatSessionMapping.ToDto(s, customerName, vendorName, counterpartyName, orderNumber, unread));
        }

        return Result.Success(dtos);
    }
}

// Query: Get Admin Chat Sessions (Customer ↔ Admin)
public sealed record GetAdminChatSessionsQuery : IQuery<List<ChatSessionDto>>;

internal sealed class GetAdminChatSessionsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminChatSessionsQuery, List<ChatSessionDto>>
{
    public async Task<Result<List<ChatSessionDto>>> Handle(
        GetAdminChatSessionsQuery request,
        CancellationToken cancellationToken)
    {
        var sessions = await customers.GetAdminChatSessionsAsync(cancellationToken);
        var unreadBySession = await customers.GetUnreadChatCountsBySessionAsync(
            sessions.Select(s => s.Id).ToList(),
            "Customer",
            cancellationToken);
        var dtos = new List<ChatSessionDto>();

        foreach (var s in sessions)
        {
            var customer = await customers.GetCustomerByIdAsync(s.CustomerId, cancellationToken);
            var customerName = customer?.FullName ?? "Customer";
            var (vendorName, counterpartyName) = await ChatSessionMapping.ResolveNamesAsync(customers, s, cancellationToken);
            string? orderNumber = null;

            if (s.OrderId.HasValue)
            {
                var order = await customers.GetCustomerOrderByIdAsync(s.OrderId.Value, cancellationToken);
                orderNumber = order?.Order.OrderNumber;
            }

            unreadBySession.TryGetValue(s.Id, out var unread);
            dtos.Add(ChatSessionMapping.ToDto(s, customerName, vendorName, counterpartyName, orderNumber, unread));
        }

        return Result.Success(dtos);
    }
}

public sealed record GetAdminChatUnreadCountQuery : IQuery<int>;

internal sealed class GetAdminChatUnreadCountQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminChatUnreadCountQuery, int>
{
    public async Task<Result<int>> Handle(GetAdminChatUnreadCountQuery request, CancellationToken cancellationToken)
    {
        var count = await customers.CountUnreadAdminInboxMessagesAsync(cancellationToken);
        return Result.Success(count);
    }
}

// Command: Create Customer ↔ Admin Chat Session (order-linked)
public sealed record CreateChatSessionCommand(
    Guid CustomerId,
    Guid? VendorId,
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

        if (!request.OrderId.HasValue)
            return Result.Failure<ChatSessionDto>(new Error("chats.order_required", "Order id is required to start a support chat.", ErrorCategory.Validation));

        var orderRow = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId.Value, cancellationToken);
        if (orderRow is null)
            return Result.Failure<ChatSessionDto>(new Error("orders.not_found", "Order not found.", ErrorCategory.NotFound));

        var vendorId = orderRow.Listing?.VendorId ?? request.VendorId;
        if (vendorId.HasValue)
        {
            var vendorNameCheck = await customers.GetVendorBusinessNameAsync(vendorId.Value, cancellationToken);
            if (vendorNameCheck is null)
                return Result.Failure<ChatSessionDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var s = await customers.GetAdminChatSessionForOrderAsync(request.CustomerId, request.OrderId.Value, cancellationToken);

        if (s is null)
        {
            s = new ChatSession
            {
                Id = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                VendorId = vendorId,
                OrderId = request.OrderId,
                CounterpartyType = ChatCounterpartyTypes.Admin,
                Subject = string.IsNullOrWhiteSpace(request.Subject)
                    ? $"Chat regarding order {orderRow.Order.OrderNumber}"
                    : request.Subject.Trim(),
                LastMessageAt = DateTimeOffset.UtcNow,
                IsClosed = false,
                CreatedOnUtc = DateTime.UtcNow,
                ModifiedOnUtc = DateTime.UtcNow
            };
            await customers.AddChatSessionAsync(s, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
        }

        var (vendorName, counterpartyName) = await ChatSessionMapping.ResolveNamesAsync(customers, s, cancellationToken);

        return Result.Success(ChatSessionMapping.ToDto(
            s,
            customer.FullName,
            vendorName,
            counterpartyName,
            orderRow.Order.OrderNumber));
    }
}

// Command: Send Chat Message
public sealed record SendChatMessageCommand(
    Guid ChatSessionId,
    string SenderType,
    string MessageText) : ICommand<ChatMessageDto>;

internal sealed class SendChatMessageCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
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

        var senderType = request.SenderType.Trim();
        var isAdminSession = string.Equals(session.CounterpartyType, ChatCounterpartyTypes.Admin, StringComparison.OrdinalIgnoreCase);
        var allowed = isAdminSession
            ? senderType is "Customer" or "Admin"
            : senderType is "Customer" or "Vendor";

        if (!allowed)
            return Result.Failure<ChatMessageDto>(new Error("chats.invalid_sender", "Invalid sender type for this chat session.", ErrorCategory.Validation));

        if (string.IsNullOrWhiteSpace(request.MessageText))
            return Result.Failure<ChatMessageDto>(new Error("chats.empty_message", "Message cannot be empty.", ErrorCategory.Validation));

        var priorUnreadFromCustomer = 0;
        if (isAdminSession && senderType == "Customer")
            priorUnreadFromCustomer = await customers.CountUnreadChatMessagesAsync(session.Id, "Customer", cancellationToken);

        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ChatSessionId = request.ChatSessionId,
            SenderType = senderType,
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

        if (isAdminSession && senderType == "Customer" && priorUnreadFromCustomer == 0)
        {
            await NotifyAdminsOfCustomerChatAsync(customers, vendors, session, msg.MessageText, cancellationToken);
        }

        if (isAdminSession && senderType == "Admin")
        {
            await NotifyCustomerOfAdminReplyAsync(customers, session, msg.MessageText, cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return Result.Success(new ChatMessageDto(
            msg.Id,
            msg.ChatSessionId,
            msg.SenderType,
            msg.MessageText,
            msg.SentAt,
            msg.IsRead));
    }

    private static async Task NotifyAdminsOfCustomerChatAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        ChatSession session,
        string messageText,
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(session.CustomerId, cancellationToken);
        var customerName = customer?.FullName ?? "Customer";
        string? orderNumber = null;
        if (session.OrderId.HasValue)
        {
            var order = await customers.GetCustomerOrderByIdAsync(session.OrderId.Value, cancellationToken);
            orderNumber = order?.Order.OrderNumber;
        }

        var snippet = messageText.Length > 80 ? messageText[..80] + "…" : messageText;
        var admins = await vendors.GetAdminUsersAsync(cancellationToken);
        var systemAdmin = admins.FirstOrDefault(a => a.IsActive) ?? admins.FirstOrDefault();
        if (systemAdmin is null)
            return;

        var orderPart = orderNumber is null ? "" : $" on order {orderNumber}";
        await vendors.AddAdminAuditLogAsync(
            new AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = systemAdmin.Id,
                ActionType = "customer.chat.message",
                EntityType = "chat_session",
                EntityId = session.Id,
                NewValue =
                    $"{{\"orderId\":\"{session.OrderId}\",\"customerId\":\"{session.CustomerId}\",\"orderNumber\":\"{orderNumber}\"}}",
                Notes = $"{customerName} messaged BlinksMed support{orderPart}: \"{snippet}\"",
            },
            cancellationToken);
    }

    private static async Task NotifyCustomerOfAdminReplyAsync(
        ICustomerRepository customers,
        ChatSession session,
        string messageText,
        CancellationToken cancellationToken)
    {
        var snippet = messageText.Length > 100 ? messageText[..100] + "…" : messageText;
        string? orderNumber = null;
        if (session.OrderId.HasValue)
        {
            var order = await customers.GetCustomerOrderByIdAsync(session.OrderId.Value, cancellationToken);
            orderNumber = order?.Order.OrderNumber;
        }

        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = session.CustomerId,
                RelatedOrderId = session.OrderId,
                NotificationType = CustomerNotificationTypes.SupportChatReply,
                Title = "BlinksMed support replied",
                Body = orderNumber is null
                    ? $"Support: {snippet}"
                    : $"Regarding order {orderNumber}: {snippet}",
            },
            cancellationToken);
    }
}

// Query: Get Chat Messages (optionally mark the other party's messages as read)
public sealed record GetChatMessagesQuery(Guid ChatSessionId, string? MarkReadForReaderType = null)
    : IQuery<List<ChatMessageDto>>;

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

        if (!string.IsNullOrWhiteSpace(request.MarkReadForReaderType))
        {
            var reader = request.MarkReadForReaderType.Trim();
            // Opening the thread marks the *other* party's messages as read.
            var senderToMark = reader switch
            {
                "Admin" => "Customer",
                "Customer" => "Admin",
                "Vendor" => "Customer",
                _ => null
            };
            if (senderToMark is not null)
            {
                var marked = await customers.MarkChatMessagesReadAsync(session.Id, senderToMark, cancellationToken);
                if (marked > 0)
                    await customers.SaveChangesAsync(cancellationToken);
            }
        }

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
