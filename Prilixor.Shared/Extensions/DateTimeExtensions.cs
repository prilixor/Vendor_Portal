using System;

namespace Prilixor.Shared.Extensions
{
    public static class DateTimeExtensions
    {
        public static DateTimeOffset ToSafeDateTimeOffset(this DateTime dateTime)
        {
            // PostgreSQL 'infinity' maps to DateTime.MaxValue
            // PostgreSQL '-infinity' maps to DateTime.MinValue
            // Default uninitialized C# DateTime is DateTime.MinValue
            
            if (dateTime <= DateTime.MinValue.AddDays(1) || dateTime >= DateTime.MaxValue.AddDays(-1))
            {
                return DateTimeOffset.UtcNow;
            }

            var utc = DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
            return new DateTimeOffset(utc, TimeSpan.Zero);
        }

        public static DateTimeOffset? ToSafeDateTimeOffset(this DateTime? dateTime)
        {
            if (dateTime == null)
            {
                return null;
            }

            return dateTime.Value.ToSafeDateTimeOffset();
        }

        public static DateTimeOffset? ToSafeDateTimeOffset(this DateTimeOffset? dateTimeOffset)
        {
            if (dateTimeOffset == null)
            {
                return null;
            }

            // For DateTimeOffset, we just check for extreme values
            if (dateTimeOffset <= DateTimeOffset.MinValue.AddDays(1) || dateTimeOffset >= DateTimeOffset.MaxValue.AddDays(-1))
            {
                return DateTimeOffset.UtcNow;
            }

            return dateTimeOffset;
        }
    }
}
