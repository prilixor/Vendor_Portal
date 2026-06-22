using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record TriggerCustomerEngagementJobsCommand() : ICommand<int>;

internal sealed class TriggerCustomerEngagementJobsCommandHandler(
    ICustomerRepository customers,
    IEmailService emailService)
    : ICommandHandler<TriggerCustomerEngagementJobsCommand, int>
{
    public async Task<Result<int>> Handle(
        TriggerCustomerEngagementJobsCommand request, 
        CancellationToken cancellationToken)
    {
        // This is a placeholder for the engagement logic.
        // In a real scenario, this would query customers with MarketingEmailsEnabled = true,
        // iterate over their CustomerFavorites, check if there are price drops or stock alerts,
        // and send out emails.

        // For now, we will simulate the engagement run and return the number of emails sent.
        int emailsSent = 0;

        // E.g.
        // var allFavorites = await customers.GetAllFavoritesAsync(cancellationToken);
        // ... filter logic ...
        // await emailService.SendEmailAsync("customer@example.com", "Your favorite item dropped in price!", "Check it out...");
        
        return Result.Success(emailsSent);
    }
}
