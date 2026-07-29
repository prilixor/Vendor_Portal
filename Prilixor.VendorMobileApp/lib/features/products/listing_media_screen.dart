import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_catalog_model.dart';
import '../../core/providers/vendor_catalog_provider.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/multipart_file_util.dart';

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

class _ListingMediaScreenState extends State<ListingMediaScreen> {
  List<VendorProductImage> _images = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    setState(() => _loading = true);
    final images = await Provider.of<VendorCatalogProvider>(context,
            listen: false)
        .fetchListingImages(vendorId, widget.listingId);
    if (!mounted) return;
    setState(() {
      _images = images..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      _loading = false;
    });
  }

  Future<void> _uploadImages() async {
    final pending =
        Provider.of<VendorProfileProvider>(context, listen: false).isPending;
    if (pending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Available once your account is approved.'),
        ),
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
      // Web: stream images instead of loading all bytes (same pattern as onboarding docs).
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
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(lastError ?? 'Failed to upload image.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _deleteImage(VendorProductImage image) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Delete image?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'This image will be removed from the listing.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

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
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _setPrimary(VendorProductImage image) async {
    if (image.isPrimary) return;
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
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorCatalogProvider>(context);
    final pending = Provider.of<VendorProfileProvider>(context).isPending;

    return Scaffold(
      appBar: AppBar(title: Text('Photos · ${widget.listingTitle}')),
      floatingActionButton: pending
          ? null
          : FloatingActionButton.extended(
              onPressed: provider.saving ? null : _uploadImages,
              backgroundColor: const Color(0xFF6C63FF),
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Add photos'),
            ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
            )
          : RefreshIndicator(
              color: const Color(0xFF6C63FF),
              onRefresh: _load,
              child: _images.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 80),
                        Icon(Icons.image_outlined, size: 48, color: Colors.white24),
                        SizedBox(height: 12),
                        Text(
                          'No photos yet. Tap Add photos to upload.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white54),
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
                                  ? Image.network(url, fit: BoxFit.cover)
                                  : Container(
                                      color: const Color(0xFF1E293B),
                                      child: const Icon(Icons.broken_image,
                                          color: Colors.white24),
                                    ),
                            ),
                            if (image.isPrimary)
                              Positioned(
                                top: 8,
                                left: 8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF6C63FF),
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
                                        onPressed: provider.saving
                                            ? null
                                            : () => _setPrimary(image),
                                        icon: const Icon(Icons.star_outline,
                                            color: Colors.white, size: 20),
                                      ),
                                    if (!pending)
                                      IconButton(
                                        tooltip: 'Delete',
                                        onPressed: provider.saving
                                            ? null
                                            : () => _deleteImage(image),
                                        icon: const Icon(Icons.delete_outline,
                                            color: Colors.redAccent, size: 20),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),
    );
  }
}
