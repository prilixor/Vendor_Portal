namespace Prilixor.VendorPortal.Application.Security;

/// <summary>
/// In-memory counters for one API process. Live BlinksMed runs a single API service, so the counters do not need a shared store.
/// </summary>
public sealed class ApiRateLimitGate
{
    private readonly object _sync = new();
    private readonly Dictionary<string, WindowSlot> _windows = new(StringComparer.Ordinal);
    private readonly Dictionary<string, FailureSlot> _failures = new(StringComparer.Ordinal);

    public bool TryConsume(string key, int limit, TimeSpan window, DateTimeOffset utcNow, out TimeSpan retryAfter)
    {
        if (limit < 1) throw new ArgumentOutOfRangeException(nameof(limit));
        if (window <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(window));

        lock (_sync)
        {
            Prune(utcNow);
            if (!_windows.TryGetValue(key, out var slot) || utcNow >= slot.WindowEnd)
            {
                _windows[key] = new WindowSlot(utcNow.Add(window), 1);
                retryAfter = TimeSpan.Zero;
                return true;
            }

            if (slot.Count >= limit)
            {
                retryAfter = Positive(slot.WindowEnd - utcNow);
                return false;
            }

            slot.Count++;
            retryAfter = TimeSpan.Zero;
            return true;
        }
    }

    /// <summary>Gives back a reservation when no text was sent, such as a reload during the resend wait.</summary>
    public void Refund(string key, DateTimeOffset utcNow)
    {
        lock (_sync)
        {
            if (!_windows.TryGetValue(key, out var slot) || utcNow >= slot.WindowEnd)
                return;
            if (slot.Count <= 1)
                _windows.Remove(key);
            else
                slot.Count--;
        }
    }

    public bool IsLocked(string key, DateTimeOffset utcNow, out TimeSpan retryAfter)
    {
        lock (_sync)
        {
            Prune(utcNow);
            if (_failures.TryGetValue(key, out var slot) && slot.LockedUntil is DateTimeOffset until && utcNow < until)
            {
                retryAfter = Positive(until - utcNow);
                return true;
            }

            retryAfter = TimeSpan.Zero;
            return false;
        }
    }

    public void RecordFailure(string key, int failuresBeforeLock, TimeSpan lockFor, DateTimeOffset utcNow)
    {
        if (failuresBeforeLock < 1) throw new ArgumentOutOfRangeException(nameof(failuresBeforeLock));
        if (lockFor <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(lockFor));

        lock (_sync)
        {
            Prune(utcNow);
            if (!_failures.TryGetValue(key, out var slot) || (slot.LockedUntil is null && utcNow >= slot.WindowEnd))
            {
                slot = new FailureSlot { WindowEnd = utcNow.Add(lockFor) };
                _failures[key] = slot;
            }

            if (slot.LockedUntil is DateTimeOffset until && utcNow < until)
            {
                slot.LockedUntil = utcNow.Add(lockFor);
                return;
            }

            slot.Count++;
            if (slot.Count >= failuresBeforeLock)
                slot.LockedUntil = utcNow.Add(lockFor);
        }
    }

    public void Clear(string key)
    {
        lock (_sync)
        {
            _failures.Remove(key);
        }
    }

    private void Prune(DateTimeOffset utcNow)
    {
        if (_windows.Count + _failures.Count < 500)
            return;

        List<string>? expiredWindows = null;
        foreach (var pair in _windows)
        {
            if (utcNow >= pair.Value.WindowEnd)
                (expiredWindows ??= []).Add(pair.Key);
        }

        if (expiredWindows is not null)
        {
            foreach (var key in expiredWindows)
                _windows.Remove(key);
        }

        List<string>? expiredFailures = null;
        foreach (var pair in _failures)
        {
            var slot = pair.Value;
            var lockGone = slot.LockedUntil is null || utcNow >= slot.LockedUntil;
            if (lockGone && utcNow >= slot.WindowEnd)
                (expiredFailures ??= []).Add(pair.Key);
        }

        if (expiredFailures is not null)
        {
            foreach (var key in expiredFailures)
                _failures.Remove(key);
        }
    }

    private static TimeSpan Positive(TimeSpan value) => value < TimeSpan.Zero ? TimeSpan.Zero : value;

    private sealed class WindowSlot(DateTimeOffset windowEnd, int count)
    {
        public DateTimeOffset WindowEnd { get; } = windowEnd;
        public int Count { get; set; } = count;
    }

    private sealed class FailureSlot
    {
        public int Count { get; set; }
        public DateTimeOffset WindowEnd { get; set; }
        public DateTimeOffset? LockedUntil { get; set; }
    }
}
