using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Configurations;

public class LegalDocumentConfiguration : IEntityTypeConfiguration<LegalDocument>
{
    public void Configure(EntityTypeBuilder<LegalDocument> builder)
    {
        builder.ToTable("legal_documents");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        builder.Property(x => x.DocumentType).HasColumnName("document_type").HasMaxLength(80).IsRequired();
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Audience).HasColumnName("audience").HasMaxLength(32).IsRequired();
        builder.Property(x => x.Summary).HasColumnName("summary");
        builder.Property(x => x.PublicPath).HasColumnName("public_path").HasMaxLength(255);
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsRequiredAcceptance).HasColumnName("is_required_acceptance");

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.CreatedBy).HasColumnName("created_by");
        builder.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");
        builder.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        builder.Property(x => x.DeletedBy).HasColumnName("deleted_by");

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Versions)
            .WithOne(v => v.Document)
            .HasForeignKey(v => v.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Placements)
            .WithOne(p => p.Document)
            .HasForeignKey(p => p.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Acceptances)
            .WithOne(a => a.Document)
            .HasForeignKey(a => a.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class LegalDocumentVersionConfiguration : IEntityTypeConfiguration<LegalDocumentVersion>
{
    public void Configure(EntityTypeBuilder<LegalDocumentVersion> builder)
    {
        builder.ToTable("legal_document_versions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.DocumentId).HasColumnName("document_id");
        builder.Property(x => x.VersionNumber).HasColumnName("version_number");
        builder.Property(x => x.ContentHtml).HasColumnName("content_html").IsRequired();
        builder.Property(x => x.ContentMarkdown).HasColumnName("content_markdown");
        builder.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
        builder.Property(x => x.ChangeSummary).HasColumnName("change_summary");
        builder.Property(x => x.IsMaterialChange).HasColumnName("is_material_change");
        builder.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        builder.Property(x => x.PublishedAt).HasColumnName("published_at");
        builder.Property(x => x.PublishedBy).HasColumnName("published_by");

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.CreatedBy).HasColumnName("created_by");
        builder.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");
        builder.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        builder.Property(x => x.DeletedBy).HasColumnName("deleted_by");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LegalDocumentPlacementConfiguration : IEntityTypeConfiguration<LegalDocumentPlacement>
{
    public void Configure(EntityTypeBuilder<LegalDocumentPlacement> builder)
    {
        builder.ToTable("legal_document_placements");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.DocumentId).HasColumnName("document_id");
        builder.Property(x => x.Surface).HasColumnName("surface").HasMaxLength(40).IsRequired();
        builder.Property(x => x.Screen).HasColumnName("screen").HasMaxLength(40).IsRequired();
        builder.Property(x => x.IsVisible).HasColumnName("is_visible");
        builder.Property(x => x.IsRequiredToProceed).HasColumnName("is_required_to_proceed");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.CreatedBy).HasColumnName("created_by");
        builder.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");
        builder.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        builder.Property(x => x.DeletedBy).HasColumnName("deleted_by");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class LegalAcceptanceConfiguration : IEntityTypeConfiguration<LegalAcceptance>
{
    public void Configure(EntityTypeBuilder<LegalAcceptance> builder)
    {
        builder.ToTable("legal_acceptances");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.ActorType).HasColumnName("actor_type").HasMaxLength(20).IsRequired();
        builder.Property(x => x.ActorId).HasColumnName("actor_id");
        builder.Property(x => x.DocumentId).HasColumnName("document_id");
        builder.Property(x => x.VersionId).HasColumnName("version_id");
        builder.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
        builder.Property(x => x.SourceSurface).HasColumnName("source_surface").HasMaxLength(40).IsRequired();
        builder.Property(x => x.SourceScreen).HasColumnName("source_screen").HasMaxLength(40).IsRequired();
        builder.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
        builder.Property(x => x.UserAgent).HasColumnName("user_agent");
        builder.Property(x => x.SignedName).HasColumnName("signed_name").HasMaxLength(200);

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.CreatedBy).HasColumnName("created_by");
        builder.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");
        builder.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        builder.Property(x => x.DeletedBy).HasColumnName("deleted_by");

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasOne(x => x.Version)
            .WithMany()
            .HasForeignKey(x => x.VersionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
