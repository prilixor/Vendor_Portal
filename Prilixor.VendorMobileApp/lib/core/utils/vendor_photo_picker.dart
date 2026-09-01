import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../theme.dart';

enum VendorPhotoPickSource { camera, gallery }

/// Camera + gallery chooser (mobile). Web falls back to gallery/files only.
Future<VendorPhotoPickSource?> showVendorPhotoSourceSheet(BuildContext context) async {
  if (kIsWeb) {
    return VendorPhotoPickSource.gallery;
  }

  final colors = context.appColors;
  return showModalBottomSheet<VendorPhotoPickSource>(
    context: context,
    backgroundColor: colors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: colors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Text(
                'Add photo',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Take a new photo or choose from your gallery.',
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 12,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),
              _PhotoSourceTile(
                icon: Icons.photo_camera_outlined,
                title: 'Take photo',
                subtitle: 'Open your camera now',
                onTap: () => Navigator.pop(ctx, VendorPhotoPickSource.camera),
              ),
              const SizedBox(height: 8),
              _PhotoSourceTile(
                icon: Icons.photo_library_outlined,
                title: 'Choose from gallery',
                subtitle: 'Select one or more existing photos',
                onTap: () => Navigator.pop(ctx, VendorPhotoPickSource.gallery),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _PhotoSourceTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _PhotoSourceTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surfaceElevated.withValues(alpha: context.isDarkMode ? 0.55 : 1),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.border.withValues(alpha: 0.75)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppTheme.accent, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 11.5,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: colors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Returns platform files ready for multipart upload.
Future<List<PlatformFile>> pickVendorPhotoFiles({
  required VendorPhotoPickSource source,
  int maxCount = 1,
}) async {
  if (maxCount <= 0) return [];

  if (source == VendorPhotoPickSource.camera) {
    if (kIsWeb) return [];
    final picker = ImagePicker();
    final photo = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 2048,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (photo == null) return [];
    return [await _platformFileFromXFile(photo)];
  }

  if (!kIsWeb) {
    final picker = ImagePicker();
    if (maxCount > 1) {
      final photos = await picker.pickMultiImage(
        imageQuality: 85,
        maxWidth: 2048,
        limit: maxCount,
      );
      if (photos.isEmpty) return [];
      final files = <PlatformFile>[];
      for (final photo in photos.take(maxCount)) {
        files.add(await _platformFileFromXFile(photo));
      }
      return files;
    }

    final photo = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2048,
    );
    if (photo == null) return [];
    return [await _platformFileFromXFile(photo)];
  }

  final result = await FilePicker.pickFiles(
    type: FileType.image,
    allowMultiple: maxCount > 1,
    withData: true,
  );
  if (result == null || result.files.isEmpty) return [];
  return result.files.take(maxCount).toList();
}

Future<PlatformFile> _platformFileFromXFile(XFile file) async {
  final name = _resolvedXFileName(file);
  final path = file.path;
  if (!kIsWeb && path.isNotEmpty) {
    final length = await file.length();
    return PlatformFile(name: name, size: length, path: path);
  }

  final bytes = await file.readAsBytes();
  return PlatformFile(name: name, size: bytes.length, bytes: bytes);
}

String _resolvedXFileName(XFile file) {
  final raw = file.name.trim();
  if (raw.isNotEmpty) return raw;
  if (file.path.isNotEmpty) {
    return file.path.split('/').last;
  }
  return 'photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
}
