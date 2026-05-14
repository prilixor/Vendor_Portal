using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class UpsertVendorNotificationPreferenceRequest : VendorIdRequest
{
    public bool EmailNotificationsEnabled { get; set; } = true;
    public bool PushNotificationsEnabled { get; set; } = true;
    public bool NewOrderNotifications { get; set; } = true;
}

public sealed class CreateVendorNotificationRequest : VendorIdRequest
{
    public string NotificationType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
}

public sealed class VendorNotificationReadRequest : VendorIdRequest
{
    public string NotificationId { get; set; } = string.Empty;
}

public sealed class MarkAllNotificationsReadResponse
{
    public int UpdatedCount { get; set; }
}

public sealed class UpsertVendorNotificationPreferenceEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorNotificationPreferenceRequest, Results<Ok<VendorNotificationPreferenceDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/notification-preferences");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorNotificationPreferenceDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorNotificationPreferenceRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new UpsertVendorNotificationPreferenceCommand(
            req.VendorId,
            req.EmailNotificationsEnabled,
            req.PushNotificationsEnabled,
            req.NewOrderNotifications), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorNotificationPreferenceEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<VendorNotificationPreferenceDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/notification-preferences");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorNotificationPreferenceDto>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorNotificationPreferenceQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateVendorNotificationEndpoint(IMediator mediator)
    : Endpoint<CreateVendorNotificationRequest, Results<Ok<VendorNotificationDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/notifications");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorNotificationDto>, ProblemHttpResult>> ExecuteAsync(CreateVendorNotificationRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateVendorNotificationCommand(
            req.VendorId,
            req.NotificationType,
            req.Title,
            req.Message,
            req.Channel,
            req.Status), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorNotificationsEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorNotificationDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/notifications");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorNotificationDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorNotificationsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetUnreadNotificationCountEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<int>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/notifications/unread-count");
        Group<VendorOnboardingGroup>();
        AllowAnonymous();
    }

    public override async Task<Results<Ok<int>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetUnreadNotificationCountQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class MarkVendorNotificationAsReadEndpoint(IMediator mediator)
    : Endpoint<VendorNotificationReadRequest, Results<Ok<VendorNotificationDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/notifications/{notificationId}/read");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorNotificationDto>, ProblemHttpResult>> ExecuteAsync(VendorNotificationReadRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkVendorNotificationAsReadCommand(req.VendorId, req.NotificationId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class MarkVendorNotificationAsUnreadEndpoint(IMediator mediator)
    : Endpoint<VendorNotificationReadRequest, Results<Ok<VendorNotificationDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/notifications/{notificationId}/unread");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorNotificationDto>, ProblemHttpResult>> ExecuteAsync(VendorNotificationReadRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkVendorNotificationAsUnreadCommand(req.VendorId, req.NotificationId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class MarkAllVendorNotificationsAsReadEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<MarkAllNotificationsReadResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("{vendorId}/notifications/read-all");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<MarkAllNotificationsReadResponse>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new MarkAllVendorNotificationsAsReadCommand(req.VendorId), ct);
        return result.IsSuccess
            ? TypedResults.Ok(new MarkAllNotificationsReadResponse { UpdatedCount = result.Value })
            : result.ToErrorResponse();
    }
}

// Push Subscription Endpoints

public sealed class RegisterPushSubscriptionRequest : VendorIdRequest
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256DH { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}

public sealed class RegisterPushSubscriptionEndpoint(IMediator mediator)
    : Endpoint<RegisterPushSubscriptionRequest, Results<Ok<VendorPushSubscriptionDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/push-subscription");
        Group<VendorOnboardingGroup>();
        Options(x => x.AllowAnonymous());
    }

    public override async Task<Results<Ok<VendorPushSubscriptionDto>, ProblemHttpResult>> ExecuteAsync(
        RegisterPushSubscriptionRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new RegisterPushSubscriptionCommand(
            req.VendorId,
            req.Endpoint,
            req.P256DH,
            req.Auth), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UnregisterPushSubscriptionEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<bool>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/push-subscription");
        Group<VendorOnboardingGroup>();
        Options(x => x.AllowAnonymous());
    }

    public override async Task<Results<Ok<bool>, ProblemHttpResult>> ExecuteAsync(
        VendorIdRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new UnregisterPushSubscriptionCommand(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetPushSubscriptionEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<VendorPushSubscriptionDto?>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/push-subscription");
        Group<VendorOnboardingGroup>();
        Options(x => x.AllowAnonymous());
    }

    public override async Task<Results<Ok<VendorPushSubscriptionDto?>, ProblemHttpResult>> ExecuteAsync(
        VendorIdRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new GetPushSubscriptionQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok<VendorPushSubscriptionDto?>(result.Value) : result.ToErrorResponse();
    }
}
