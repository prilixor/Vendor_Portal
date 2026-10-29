using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetAdminChatSessionsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("chats/sessions");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<List<ChatSessionDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminChatSessionsQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminChatSessionSummariesRequest
{
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 8;
    public bool UnreadOnly { get; set; }
}

public sealed class GetAdminChatSessionSummariesEndpoint(IMediator mediator)
    : Endpoint<GetAdminChatSessionSummariesRequest, Results<Ok<AdminChatSessionListResult>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("chats/sessions/summaries");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<AdminChatSessionListResult>, ProblemHttpResult>> ExecuteAsync(
        GetAdminChatSessionSummariesRequest req,
        CancellationToken ct)
    {
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize is < 1 or > 100 ? 8 : req.PageSize;
        var result = await mediator.Send(
            new GetAdminChatSessionListQuery(req.Search, page, pageSize, req.UnreadOnly), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminChatSessionEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<ChatSessionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("chats/sessions/{sessionId}");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<ChatSessionDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("sessionId");
        if (!Guid.TryParse(idStr, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new GetAdminChatSessionQuery(sessionId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AdminChatUnreadCountResponse
{
    public int Count { get; set; }
}

public sealed class GetAdminChatUnreadCountEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<AdminChatUnreadCountResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("chats/unread-count");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<AdminChatUnreadCountResponse>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminChatUnreadCountQuery(), ct);
        return result.IsSuccess
            ? TypedResults.Ok(new AdminChatUnreadCountResponse { Count = result.Value })
            : result.ToErrorResponse();
    }
}

public sealed class GetAdminChatMessagesRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public sealed class GetAdminChatMessagesEndpoint(IMediator mediator)
    : Endpoint<GetAdminChatMessagesRequest, Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("chats/sessions/{SessionId}/messages");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<List<ChatMessageDto>>, ProblemHttpResult>> ExecuteAsync(
        GetAdminChatMessagesRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new GetChatMessagesQuery(sessionId, MarkReadForReaderType: "Admin"), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SendAdminChatMessageRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
}

public sealed class SendAdminChatMessageEndpoint(IMediator mediator)
    : Endpoint<SendAdminChatMessageRequest, Results<Ok<ChatMessageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("chats/sessions/{SessionId}/messages");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.SupportManage}");
    }

    public override async Task<Results<Ok<ChatMessageDto>, ProblemHttpResult>> ExecuteAsync(
        SendAdminChatMessageRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.SessionId, out var sessionId))
            return TypedResults.Problem(title: "chats.invalid_id", detail: "Invalid session id.", statusCode: 400);

        var result = await mediator.Send(new SendChatMessageCommand(sessionId, "Admin", req.MessageText), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
