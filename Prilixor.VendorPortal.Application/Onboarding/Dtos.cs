namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record VendorDto(
    string Id,
    string Email,
    bool IsEmailVerified,
    DateTimeOffset? VerificationTokenExpiryUtc,
    string AccountStatus,
    string RegistrationStage,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset? TermsAcceptedAt,
    DateTimeOffset? CreatedAt);

public sealed record VendorProfileDto(
    string Id,
    string VendorId,
    string BusinessName,
    string OwnerName,
    string? SupportPhone,
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
    bool IsActive,
    bool IsRadiusSetByAdmin = false);

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
    string BranchName,
    string IfscCode,
    string VerificationStatus,
    DateTimeOffset? VerifiedAt);

public sealed record ProductCategoryDto(
    string Id,
    string CategoryName,
    bool PrescriptionRequired,
    bool DepositRequired,
    bool InstallationRequired,
    bool IsChemical,
    bool IsActive);

public sealed record ProductDto(
    string Id,
    string CategoryId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string? ShortDescription,
    string? LongDescription,
    decimal DailyRent,
    decimal WeeklyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    decimal? BuyPrice,
    decimal VendorDailyRent,
    decimal VendorWeeklyRent,
    decimal VendorMonthlyRent,
    decimal VendorSecurityDeposit,
    decimal? VendorBuyPrice,
    decimal GstPercent,
    bool IsRentEnabled,
    bool IsBuyEnabled,
    bool IsActive,
    List<ProductImageDto> Images,
    List<ProductVariantDto> Variants,
    string? CasNumber = null,
    string? ChemicalFormula = null,
    decimal? PurityPercentage = null,
    decimal? MolecularWeight = null,
    string? BaseUnit = null,
    string? SdsDocumentUrl = null,
    string? CoaDocumentUrl = null,
    int FavoriteCount = 0,
    List<ProductRentalPricingPlanDto>? RentalPricingPlans = null,
    List<ProductDocumentDto>? Documents = null);

public sealed record ProductVariantDto(
    string Id,
    string ProductId,
    string Sku,
    decimal SizeValue,
    string SizeUnit,
    decimal VendorPrice,
    decimal BuyPrice,
    bool IsActive);

public sealed record ProductRentalPricingPlanDto(
    string Id,
    string ProductId,
    string DurationLabel,
    int DurationDays,
    decimal NormalPrice,
    string DiscountType,
    decimal DiscountValue,
    decimal FinalRentalPrice,
    bool IsRecommended,
    bool IsActive,
    int SortOrder,
    string? RentalDurationMasterId = null,
    decimal BillingCycles = 0,
    string? RentalDurationIconId = null,
    string? IconUrl = null,
    string? IconThumbnailUrl = null,
    string? ValueTier = null,
    string? IconName = null);

public sealed record RentalDurationMasterDto(
    string Id,
    string DurationLabel,
    int DurationDays,
    int SortOrder,
    bool IsActive,
    decimal BillingCycles = 0);

public sealed record RentalDurationIconDto(
    string Id,
    string Name,
    string ValueTier,
    string ImageUrl,
    string? ThumbnailUrl,
    int SortOrder,
    bool IsActive,
    /// <summary>Raw storage reference to persist on save/assign (S3 key or uploads/… path).</summary>
    string? ImageStorageKey = null,
    string? ThumbnailStorageKey = null);

public sealed record ProductImageDto(
    string Id,
    string ProductId,
    string ImageUrl,
    int DisplayOrder,
    bool IsPrimary,
    string? ThumbnailUrl = null);

public sealed record ProductDocumentDto(
    string Id,
    string ProductId,
    string DocumentType,
    string FileUrl);

public sealed record VendorProductListingDto(
    string Id,
    string VendorId,
    string ProductId,
    string ListingTitle,
    decimal DailyRent,
    decimal WeeklyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    int AvailableQuantity,
    string ListingStatus,
    int FavoriteCount = 0,
    bool IsChemical = false,
    string? PrimaryImageUrl = null,
    string? PrimaryThumbnailUrl = null);

public sealed record VendorProductImageDto(
    string Id,
    string VendorProductListingId,
    string ImageUrl,
    int DisplayOrder,
    bool IsPrimary,
    string? ThumbnailUrl = null);

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
    DateTimeOffset EventAt);

public sealed record VendorVariantInventoryDto(
    string Id,
    string VendorProductListingId,
    string ProductVariantId,
    string Sku,
    decimal SizeValue,
    string SizeUnit,
    int TotalQuantity,
    int AvailableQuantity,
    int ReservedQuantity);

public sealed record UpsertVariantInventoryItemDto(
    string ProductVariantId,
    int TotalQuantity);

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
    DateTimeOffset? LastLoginAt,
    string? RoleId = null,
    bool IsSystemUser = false,
    bool MustChangePassword = false);

public sealed record AdminAuditLogDto(
    string Id,
    string AdminId,
    string? AdminName,
    string? AdminEmail,
    string ActionType,
    string EntityType,
    string? EntityId,
    string? OldValue,
    string? NewValue,
    string? Notes,
    DateTimeOffset CreatedAt);

public sealed record AdminPasswordResetDto(
    string VendorId,
    string Message,
    DateTimeOffset UpdatedAt);

/// <summary>One-time temporary password shown to SuperAdmin after force reset. Never stored in plain text.</summary>
public sealed record ForceResetAdminPasswordDto(
    string AdminUserId,
    string Message,
    string TemporaryPassword,
    bool MustChangePassword,
    DateTimeOffset UpdatedAt);

public sealed record ExcelUploadErrorDto(
    int Row,
    string Sheet,
    string Field,
    string Message);

public sealed record ExcelUploadResponseDto(
    bool Success,
    List<ExcelUploadErrorDto> Errors,
    int CategoriesCreated,
    int ProductsCreated);

public sealed record VendorPushSubscriptionDto(
    string Id,
    string VendorId,
    string Endpoint,
    string P256DH,
    string Auth);
