namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record VendorDto(
    string Id,
    string Email,
    bool EmailVerified,
    string AccountStatus,
    string RegistrationStage,
    DateTimeOffset? LastLoginAt);

public sealed record VendorProfileDto(
    string Id,
    string VendorId,
    string BusinessName,
    string OwnerName,
    string SupportPhone,
    string? GstNumber,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string PostalCode,
    decimal? Latitude,
    decimal? Longitude,
    bool OnboardingCompleted);

public sealed record VendorDocumentDto(
    string Id,
    string VendorId,
    string DocumentType,
    string FileUrl,
    string? DocumentNumber,
    string VerificationStatus,
    string? RejectionReason,
    DateTimeOffset? VerifiedAt);

public sealed record VendorVerificationRequestDto(
    string Id,
    string VendorId,
    string ReviewStatus,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? ReviewedAt,
    string? ReviewedBy,
    string? RejectionReason);

public sealed record VendorServiceAreaDto(
    string Id,
    string VendorId,
    string AreaName,
    string City,
    decimal CenterLatitude,
    decimal CenterLongitude,
    decimal ServiceRadiusKm,
    bool IsActive);

public sealed record VendorWorkingHourDto(
    string Id,
    string VendorId,
    short DayOfWeek,
    bool IsOpen,
    TimeOnly? OpenTime,
    TimeOnly? CloseTime);

public sealed record VendorAvailabilityOverrideDto(
    string Id,
    string VendorId,
    DateOnly OverrideDate,
    bool IsAvailable,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Reason);

public sealed record VendorBankAccountDto(
    string Id,
    string VendorId,
    string AccountHolderName,
    string BankName,
    string AccountNumber,
    string IfscCode,
    string VerificationStatus,
    DateTimeOffset? VerifiedAt);

public sealed record ProductCategoryDto(
    string Id,
    string CategoryName,
    bool PrescriptionRequired,
    bool DepositRequired,
    bool InstallationRequired,
    bool IsActive);

public sealed record ProductDto(
    string Id,
    string CategoryId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string? ShortDescription,
    string? LongDescription,
    bool IsActive);

public sealed record VendorProductListingDto(
    string Id,
    string VendorId,
    string ProductId,
    string ListingTitle,
    decimal DailyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    int AvailableQuantity,
    string ListingStatus);

public sealed record VendorProductImageDto(
    string Id,
    string VendorProductListingId,
    string ImageUrl,
    int DisplayOrder,
    bool IsPrimary);

public sealed record VendorProductDocumentDto(
    string Id,
    string VendorProductListingId,
    string DocumentType,
    string FileUrl,
    string VerificationStatus,
    string? RejectionReason,
    DateTimeOffset? VerifiedAt);

public sealed record VendorInventoryDto(
    string Id,
    string VendorProductListingId,
    int TotalQuantity,
    int AvailableQuantity,
    int ReservedQuantity,
    int RentedQuantity,
    int BlockedQuantity);

public sealed record VendorInventoryMovementDto(
    string Id,
    string VendorInventoryId,
    string MovementType,
    int Quantity,
    string? ReferenceType,
    string? ReferenceId,
    string? Notes,
    DateTimeOffset CreatedAt);

public sealed record VendorNotificationPreferenceDto(
    string Id,
    string VendorId,
    bool EmailNotificationsEnabled,
    bool PushNotificationsEnabled,
    bool NewOrderNotifications);

public sealed record VendorNotificationDto(
    string Id,
    string VendorId,
    string NotificationType,
    string Title,
    string Message,
    string Channel,
    string Status,
    DateTimeOffset? SentAt,
    DateTimeOffset? ReadAt);

public sealed record AdminUserDto(
    string Id,
    string Email,
    string FullName,
    string Role,
    bool IsActive,
    DateTimeOffset? LastLoginAt);

public sealed record AdminAuditLogDto(
    string Id,
    string AdminUserId,
    string ActionType,
    string EntityType,
    string? EntityId,
    string? OldValue,
    string? NewValue,
    string? Notes);

public sealed record AdminPasswordResetDto(
    string VendorId,
    string Message,
    DateTimeOffset UpdatedAt);
