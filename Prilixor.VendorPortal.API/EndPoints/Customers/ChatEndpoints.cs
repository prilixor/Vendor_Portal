using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Customers;

// ================= CUSTOMER CHAT ENDPOINTS =================

public sealed class CreateCustomerChatSessionRequest
{
    /// <summary>Optional order/vendor context. Counterparty is always Admin.</summary>
    public Guid? VendorId { get; set; }
    public Guid? OrderId { get; set; }
    public string Subject { get; set; } = string.Empty;
}

public sealed class CreateCustomerChatSessionEndpoint(IMediator mediator)
    : Endpoint<CreateCustomerChatSessionRequest, Results<Ok<ChatSessionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/chats/sessions");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers.Chats"));
    }

    public override async Task<Results<Ok<ChatSessionDto>, ProblemHttpResult>> ExecuteAsync(CreateCustomerChatSessionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new CreateChatSessionCommand(customerId, req.VendorId, req.OrderId, req.Subject), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerChatSessionsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/chats/sessions");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers.Chats"));
    }

    public override async Task<Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerChatSessionsQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SendCustomerChatMessageRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
}

public sealed class SendCustomerChatMessageEndpoint(IMediator mediator)
    : Endpoint<SendCustomerChatMessageRequest, Results<Ok<ChatMessageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/chats/sessions/{SessionId}/messages");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers.Chats"));
    }

    public override async Task<Results<Ok<ChatMessageDto>, ProblemHttpResult>> ExecuteAsync(SendCustomerChatMessageRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new SendChatMessageCommand(sessionId, "Customer", req.MessageText), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerChatMessagesRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public sealed class GetCustomerChatMessagesEndpoint(IMediator mediator)
    : Endpoint<GetCustomerChatMessagesRequest, Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/chats/sessions/{SessionId}/messages");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers.Chats"));
    }

    public override async Task<Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>> ExecuteAsync(GetCustomerChatMessagesRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new GetChatMessagesQuery(sessionId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}


// ================= VENDOR CHAT ENDPOINTS (legacy Vendor counterparty only) =================

public sealed class VendorChatSessionRequest
{
    public Guid VendorId { get; set; }
}

public sealed class GetVendorChatSessionsEndpoint(IMediator mediator)
    : Endpoint<VendorChatSessionRequest, Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("vendors/{VendorId}/chats/sessions");
        AllowAnonymous(); // Simple direct routing for demo/onboarding ease, matching the verification/notifications endpoints
        DontAutoTag();
        Options(x => x.WithTags("Vendors.Chats"));
    }

    public override async Task<Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>> ExecuteAsync(VendorChatSessionRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorChatSessionsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorChatMessagesRequest
{
    public Guid VendorId { get; set; }
    public string SessionId { get; set; } = string.Empty;
}

public sealed class GetVendorChatMessagesEndpoint(IMediator mediator)
    : Endpoint<GetVendorChatMessagesRequest, Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("vendors/{VendorId}/chats/sessions/{SessionId}/messages");
        AllowAnonymous();
        DontAutoTag();
        Options(x => x.WithTags("Vendors.Chats"));
    }

    public override async Task<Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>> ExecuteAsync(GetVendorChatMessagesRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new GetChatMessagesQuery(sessionId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SendVendorChatMessageRequest
{
    public Guid VendorId { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
}

public sealed class SendVendorChatMessageEndpoint(IMediator mediator)
    : Endpoint<SendVendorChatMessageRequest, Results<Ok<ChatMessageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("vendors/{VendorId}/chats/sessions/{SessionId}/messages");
        AllowAnonymous();
        DontAutoTag();
        Options(x => x.WithTags("Vendors.Chats"));
    }

    public override async Task<Results<Ok<ChatMessageDto>, ProblemHttpResult>> ExecuteAsync(SendVendorChatMessageRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new SendChatMessageCommand(sessionId, "Vendor", req.MessageText), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
