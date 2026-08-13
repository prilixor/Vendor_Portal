using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerNotificationPreferenceDto(
    Guid CustomerId,
    bool OrderStatusUpdatesEnabled,
    bool ExpirationRemindersEnabled,
    bool DepositRefundsEnabled,
    bool DirectMessagesEnabled,
    bool MarketingEmailsEnabled);

public sealed record GetCustomerNotificationPreferenceQuery(Guid CustomerId) 
    : IQuery<CustomerNotificationPreferenceDto>;

internal sealed class GetCustomerNotificationPreferenceQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerNotificationPreferenceQuery, CustomerNotificationPreferenceDto>
{
    public async Task<Result<CustomerNotificationPreferenceDto>> Handle(
        GetCustomerNotificationPreferenceQuery request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<CustomerNotificationPreferenceDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var pref = await customers.GetCustomerNotificationPreferenceAsync(request.CustomerId, cancellationToken);

        if (pref is null)
        {
            return Result.Success(new CustomerNotificationPreferenceDto(
                request.CustomerId,
                OrderStatusUpdatesEnabled: true,
                ExpirationRemindersEnabled: true,
                DepositRefundsEnabled: true,
                DirectMessagesEnabled: true,
                MarketingEmailsEnabled: false));
        }

        return Result.Success(new CustomerNotificationPreferenceDto(
            pref.CustomerId,
            pref.OrderStatusUpdatesEnabled,
            pref.ExpirationRemindersEnabled,
            pref.DepositRefundsEnabled,
            pref.DirectMessagesEnabled,
            pref.MarketingEmailsEnabled));
    }
}

public sealed record UpsertCustomerNotificationPreferenceCommand(
    Guid CustomerId,
    bool OrderStatusUpdatesEnabled,
    bool ExpirationRemindersEnabled,
    bool DepositRefundsEnabled,
    bool DirectMessagesEnabled,
    bool MarketingEmailsEnabled) : ICommand<CustomerNotificationPreferenceDto>;

internal sealed class UpsertCustomerNotificationPreferenceCommandHandler(ICustomerRepository customers)
    : ICommandHandler<UpsertCustomerNotificationPreferenceCommand, CustomerNotificationPreferenceDto>
{
    public async Task<Result<CustomerNotificationPreferenceDto>> Handle(
        UpsertCustomerNotificationPreferenceCommand request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<CustomerNotificationPreferenceDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var pref = await customers.GetCustomerNotificationPreferenceAsync(request.CustomerId, cancellationToken);

        if (pref is null)
        {
            pref = new CustomerNotificationPreference
            {
                Id = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                OrderStatusUpdatesEnabled = request.OrderStatusUpdatesEnabled,
                ExpirationRemindersEnabled = request.ExpirationRemindersEnabled,
                DepositRefundsEnabled = request.DepositRefundsEnabled,
                DirectMessagesEnabled = request.DirectMessagesEnabled,
                MarketingEmailsEnabled = request.MarketingEmailsEnabled,
                CreatedOnUtc = DateTime.UtcNow,
                ModifiedOnUtc = DateTime.UtcNow
            };
            await customers.AddCustomerNotificationPreferenceAsync(pref, cancellationToken);
        }
        else
        {
            pref.OrderStatusUpdatesEnabled = request.OrderStatusUpdatesEnabled;
            pref.ExpirationRemindersEnabled = request.ExpirationRemindersEnabled;
            pref.DepositRefundsEnabled = request.DepositRefundsEnabled;
            pref.DirectMessagesEnabled = request.DirectMessagesEnabled;
            pref.MarketingEmailsEnabled = request.MarketingEmailsEnabled;
            pref.ModifiedOnUtc = DateTime.UtcNow;
            await customers.UpdateCustomerNotificationPreferenceAsync(pref, cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerNotificationPreferenceDto(
            pref.CustomerId,
            pref.OrderStatusUpdatesEnabled,
            pref.ExpirationRemindersEnabled,
            pref.DepositRefundsEnabled,
            pref.DirectMessagesEnabled,
            pref.MarketingEmailsEnabled));
    }
}
