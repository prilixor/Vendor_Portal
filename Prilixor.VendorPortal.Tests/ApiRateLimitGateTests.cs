using Prilixor.VendorPortal.Application.Security;

namespace Prilixor.VendorPortal.Tests;

public class ApiRateLimitGateTests
{
    [Fact]
    public void TryConsume_blocks_the_call_after_the_limit_until_the_window_ends()
    {
        var gate = new ApiRateLimitGate();
        var start = DateTimeOffset.Parse("2026-10-20T05:00:00Z");

        for (var i = 0; i < 5; i++)
            Assert.True(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start, out _));

        Assert.False(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start.AddMinutes(3), out var retry));
        Assert.True(retry > TimeSpan.FromMinutes(6));
        Assert.True(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start.AddMinutes(10), out _));
    }

    [Fact]
    public void Refund_drops_a_reservation_that_did_not_send_a_text()
    {
        var gate = new ApiRateLimitGate();
        var start = DateTimeOffset.Parse("2026-10-20T05:00:00Z");

        Assert.True(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start, out _));
        gate.Refund("phone", start.AddSeconds(1));

        for (var i = 0; i < 5; i++)
            Assert.True(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start.AddMinutes(1), out _));

        Assert.False(gate.TryConsume("phone", 5, TimeSpan.FromMinutes(10), start.AddMinutes(2), out _));
    }

    [Fact]
    public void RecordFailure_locks_after_five_failures_and_clear_removes_the_lock()
    {
        var gate = new ApiRateLimitGate();
        var now = DateTimeOffset.Parse("2026-10-20T05:00:00Z");

        for (var i = 0; i < 4; i++)
            gate.RecordFailure("phone", 5, TimeSpan.FromMinutes(15), now);

        Assert.False(gate.IsLocked("phone", now, out _));
        gate.RecordFailure("phone", 5, TimeSpan.FromMinutes(15), now.AddMinutes(1));
        Assert.True(gate.IsLocked("phone", now.AddMinutes(2), out var retry));
        Assert.True(retry > TimeSpan.FromMinutes(10));

        gate.Clear("phone");
        Assert.False(gate.IsLocked("phone", now.AddMinutes(2), out _));
    }

    [Fact]
    public void Classify_keeps_login_separate_from_otp_send()
    {
        Assert.Equal(AuthLimitKind.OtpSend, AuthEndpointRateRules.Classify("/api/auth/login/sms/send-otp"));
        Assert.Equal(AuthLimitKind.OtpVerify, AuthEndpointRateRules.Classify("/api/auth/login/sms/verify-otp/"));
        Assert.Equal(AuthLimitKind.PasswordLogin, AuthEndpointRateRules.Classify("/api/auth/login"));
        Assert.Equal(AuthLimitKind.AccountRecovery, AuthEndpointRateRules.Classify("/api/auth/forgot-password"));
        Assert.Equal(AuthLimitKind.None, AuthEndpointRateRules.Classify("/api/auth/refresh"));
        Assert.Equal(AuthLimitKind.None, AuthEndpointRateRules.Classify("/api/customers/me/orders/quote"));
    }
}
