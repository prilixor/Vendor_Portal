using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class TwilioSmsService(
    IOptions<TwilioOptions> options,
    ILogger<TwilioSmsService> logger) : ISmsService
{
    private readonly TwilioOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.AccountSid)
        && !string.IsNullOrWhiteSpace(_options.AuthToken)
        && !string.IsNullOrWhiteSpace(_options.FromNumberOrMessagingServiceSid);

    public async Task<SmsSendResult> SendAsync(string e164Phone, SmsMessage message, CancellationToken ct = default)
    {
        if (!IsEnabled)
        {
            logger.LogInformation("SMS skipped (Twilio disabled). To={Phone}", e164Phone);
            return new SmsSendResult(true, null, null);
        }

        // Trial accounts only accept predefined template names as Body.
        var body = _options.UseTrialSmsTemplates
            ? (string.IsNullOrWhiteSpace(message.TrialTemplateKey)
                ? _options.DefaultTrialSmsTemplate
                : message.TrialTemplateKey.Trim())
            : message.Body;

        try
        {
            TwilioClient.Init(_options.AccountSid, _options.AuthToken);

            var from = _options.FromNumberOrMessagingServiceSid.Trim();
            MessageResource sms;
            if (from.StartsWith("MG", StringComparison.OrdinalIgnoreCase))
            {
                sms = await MessageResource.CreateAsync(
                    to: new PhoneNumber(e164Phone),
                    messagingServiceSid: from,
                    body: body);
            }
            else
            {
                sms = await MessageResource.CreateAsync(
                    to: new PhoneNumber(e164Phone),
                    from: new PhoneNumber(from),
                    body: body);
            }

            logger.LogInformation(
                "Twilio SMS accepted. To={Phone} BodyOrTemplate={Body} Sid={Sid}",
                e164Phone,
                body,
                sms.Sid);

            return new SmsSendResult(true, sms.Sid, null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Twilio SMS send failed to {Phone} BodyOrTemplate={Body}", e164Phone, body);
            return new SmsSendResult(false, null, ex.Message);
        }
    }
}
