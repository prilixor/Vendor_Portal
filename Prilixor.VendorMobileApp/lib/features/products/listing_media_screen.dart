import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/multipart_file_util.dart';
import '../../core/theme.dart';
import '../../shared/widgets/catalog_image.dart';

const _docTypes = [
  ('spec_sheet', 'Spec sheet'),
  ('warranty', 'Warranty'),
  ('compliance', 'Compliance'),
];

class ListingMediaScreen extends StatefulWidget {
  final String listingId;
  final String listingTitle;

  const ListingMediaScreen({
    super.key,
    required this.listingId,
    required this.listingTitle,
  });

  @override
  State<ListingMediaScreen> createState() => _ListingMediaScreenState();
}

class _ListingMediaScreenState extends State<ListingMediaScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  List<VendorProductImage> _images = const [];
  List<VendorListingDocument> _documents = const [];
  bool _loading = true;
  String _docType = 'spec_sheet';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (mounted) setState(() {});
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    setState(() => _loading = true);
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final images = await provider.fetchListingImages(vendorId, widget.listingId);
    final docs = await provider.fetchListingDocuments(vendorId, widget.listingId);
    if (!mounted) return;
    setState(() {
      _images = [...images]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      _documents = docs;
      _loading = false;
    });
  }

  Future<void> _uploadImages() async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Available once your account is approved.')),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);

    final result = await FilePicker.pickFiles(
      type: FileType.image,
      allowMultiple: true,
      withData: !kIsWeb,
      withReadStream: kIsWeb,
    );
    if (result == null || result.files.isEmpty) return;
    if (!mounted) return;

    var order = _images.length;
    var hasPrimary = _images.any((i) => i.isPrimary);
    var uploadedCount = 0;
    String? lastError;

    for (final file in result.files) {
      if (platformFileNeedsBytes(file)) {
        lastError = kIsWeb
            ? 'Could not read the selected image in the browser. Try a smaller photo.'
            : 'Could not read the selected image.';
        continue;
      }
      final uploaded = await provider.uploadProductImageFile(
        vendorId: vendorId,
        file: file,
      );
      if (uploaded == null) {
        lastError = provider.error ?? 'Failed to upload image.';
        continue;
      }
      order += 1;
      final isPrimary = !hasPrimary;
      final ok = await provider.addListingImage(
        vendorId: vendorId,
        listingId: widget.listingId,
        imageUrl: uploaded.imageUrl,
        displayOrder: order,
        isPrimary: isPrimary,
        thumbnailUrl: uploaded.thumbnailUrl,
      );
      if (!ok) {
        lastError = provider.error ?? 'Failed to add image.';
        continue;
      }
      uploadedCount += 1;
      if (isPrimary) hasPrimary = true;
    }

    if (!mounted) return;
    await _load();
    if (!mounted) return;
    if (uploadedCount > 0 && lastError == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(uploadedCount == 1 ? 'Image added.' : '$uploadedCount images added.')),
      );
    } else if (uploadedCount > 0 && lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$uploadedCount added. Some failed: $lastError'),
          backgroundColor: Colors.orangeAccent,
        ),
      );
    } else if (lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(lastError), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _uploadDocument() async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Available once your account is approved.')),
      );
      return;
    }

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
      allowMultiple: false,
      withData: !kIsWeb,
      withReadStream: kIsWeb,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (platformFileNeedsBytes(file)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            kIsWeb
                ? 'Could not read the selected file in the browser.'
                : 'Could not read the selected file.',
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final uploaded = await provider.uploadListingDocumentFile(
      vendorId: vendorId,
      file: file,
    );
    if (uploaded == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Failed to upload document.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final ok = await provider.addListingDocument(
      vendorId: vendorId,
      listingId: widget.listingId,
      documentType: _docType,
      fileUrl: uploaded.fileUrl,
    );
    if (!mounted) return;
    if (ok) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Document added.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Failed to add document.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _deleteImage(VendorProductImage image) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.deleteListingImage(
      vendorId: vendorId,
      listingId: widget.listingId,
      imageId: image.id,
    );
    if (!mounted) return;
    if (ok) {
      await _load();
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _setPrimary(VendorProductImage image) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.setListingImagePrimary(
      vendorId: vendorId,
      listingId: widget.listingId,
      imageId: image.id,
    );
    if (!mounted) return;
    if (ok) {
      await _load();
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _deleteDocument(VendorListingDocument doc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: Text('Remove document?', style: TextStyle(color: context.appColors.textPrimary)),
        content: Text(
          'Remove ${_labelForType(doc.documentType)}?',
          style: TextStyle(color: context.appColors.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorCatalogProvider>(context, listen: false);
    final ok = await provider.deleteListingDocument(
      vendorId: vendorId,
      listingId: widget.listingId,
      documentId: doc.id,
    );
    if (!mounted) return;
    if (ok) {
      await _load();
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _previewDocument(VendorListingDocument doc) async {
    final url = resolveMediaUrl(doc.fileUrl);
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _labelForType(String type) {
    for (final t in _docTypes) {
      if (t.$1 == type) return t.$2;
    }
    return type;
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final pending = Provider.of<VendorProfileProvider>(context).isPending;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.listingTitle),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppTheme.accent,
          labelColor: context.appColors.textPrimary,
          unselectedLabelColor: context.appColors.textMuted,
          tabs: const [
            Tab(text: 'Images'),
            Tab(text: 'Documents'),
          ],
        ),
      ),
      floatingActionButton: pending
          ? null
          : FloatingActionButton.extended(
              onPressed: provider.saving
                  ? null
                  : () {
                      if (_tabs.index == 0) {
                        _uploadImages();
                      } else {
                        _uploadDocument();
                      }
                    },
              backgroundColor: AppTheme.accent,
              icon: Icon(_tabs.index == 0
                  ? Icons.add_photo_alternate_outlined
                  : Icons.upload_file_outlined),
              label: Text(_tabs.index == 0 ? 'Add photos' : 'Add document'),
            ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.accent),
            )
          : TabBarView(
              controller: _tabs,
              children: [
                _buildImagesTab(provider, pending),
                _buildDocumentsTab(provider, pending),
              ],
            ),
    );
  }

  Widget _buildImagesTab(VendorCatalogProvider provider, bool pending) {
    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: _load,
      child: _images.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 80),
                Icon(Icons.image_outlined, size: 48, color: context.appColors.textMuted),
                const SizedBox(height: 12),
                Text(
                  'No photos yet. Tap Add photos to upload.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.appColors.textMuted),
                ),
              ],
            )
          : GridView.builder(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1,
              ),
              itemCount: _images.length,
              itemBuilder: (context, index) {
                final image = _images[index];
                final url = resolveMediaUrl(image.displayUrl);
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: url != null
                          ? CatalogImage(url: image.displayUrl, fit: BoxFit.cover)
                          : Container(
                              color: AppTheme.card(context),
                              child: Icon(Icons.broken_image, color: context.appColors.textMuted),
                            ),
                    ),
                    if (image.isPrimary)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.accent,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'Primary',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (!image.isPrimary && !pending)
                              IconButton(
                                tooltip: 'Set primary',
                                onPressed: provider.saving ? null : () => _setPrimary(image),
                                icon: const Icon(Icons.star_outline, color: Colors.white, size: 20),
                              ),
                            if (!pending)
                              IconButton(
                                tooltip: 'Delete',
                                onPressed: provider.saving ? null : () => _deleteImage(image),
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
    );
  }

  Widget _buildDocumentsTab(VendorCatalogProvider provider, bool pending) {
    return RefreshIndicator(
      color: AppTheme.accent,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          Text(
            'Document type for next upload',
            style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _docType,
            dropdownColor: context.appColors.surface,
            style: TextStyle(color: context.appColors.textPrimary),
            decoration: InputDecoration(
              filled: true,
              fillColor: AppTheme.card(context),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: context.appColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: context.appColors.border),
              ),
            ),
            items: _docTypes
                .map((t) => DropdownMenuItem(
                      value: t.$1,
                      child: Text(t.$2, style: TextStyle(color: context.appColors.textPrimary)),
                    ))
                .toList(),
            onChanged: pending
                ? null
                : (v) {
                    if (v != null) setState(() => _docType = v);
                  },
          ),
          const SizedBox(height: 16),
          if (_documents.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(
                children: [
                  Icon(Icons.description_outlined, size: 48, color: context.appColors.textMuted),
                  const SizedBox(height: 12),
                  Text(
                    'No documents uploaded yet.',
                    style: TextStyle(color: context.appColors.textMuted),
                  ),
                ],
              ),
            )
          else
            ..._documents.map((doc) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.card(context),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.appColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.insert_drive_file_outlined, color: AppTheme.accent),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _labelForType(doc.documentType),
                            style: TextStyle(
                              color: context.appColors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            doc.verificationStatus,
                            style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Preview',
                      onPressed: () => _previewDocument(doc),
                      icon: Icon(Icons.open_in_new, color: context.appColors.textSecondary),
                    ),
                    if (!pending)
                      IconButton(
                        tooltip: 'Remove',
                        onPressed: provider.saving ? null : () => _deleteDocument(doc),
                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
