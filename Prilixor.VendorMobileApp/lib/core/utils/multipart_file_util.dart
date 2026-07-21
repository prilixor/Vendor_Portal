import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http_parser/http_parser.dart';

/// Build [MultipartFile] from a [PlatformFile] on mobile (path) or web (bytes/stream).
Future<MultipartFile?> multipartFromPlatformFile(PlatformFile file) async {
  final name = _resolvedFileName(file);
  final contentType = _mediaTypeForFileName(name);

  final path = file.path;
  if (path != null && path.isNotEmpty) {
    return MultipartFile.fromFile(
      path,
      filename: name,
      contentType: contentType,
    );
  }

  final stream = file.readStream;
  if (stream != null && file.size > 0) {
    return MultipartFile.fromStream(
      () => stream,
      file.size,
      filename: name,
      contentType: contentType,
    );
  }

  final bytes = file.bytes;
  if (bytes != null && bytes.isNotEmpty) {
    return MultipartFile.fromBytes(
      bytes,
      filename: name,
      contentType: contentType,
    );
  }

  return null;
}

/// True when the picker returned a file handle but no readable payload yet.
bool platformFileNeedsBytes(PlatformFile file) =>
    (file.path == null || file.path!.isEmpty) &&
    file.readStream == null &&
    (file.bytes == null || file.bytes!.isEmpty);

String _resolvedFileName(PlatformFile file) {
  var name = file.name.trim();
  if (name.isEmpty) {
    name = 'upload';
  }

  if (!name.contains('.') && file.extension != null && file.extension!.trim().isNotEmpty) {
    name = '$name.${file.extension!.trim().toLowerCase()}';
  }

  return name;
}

MediaType? _mediaTypeForFileName(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return MediaType('application', 'pdf');
  if (lower.endsWith('.png')) return MediaType('image', 'png');
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return MediaType('image', 'jpeg');
  if (lower.endsWith('.webp')) return MediaType('image', 'webp');
  if (lower.endsWith('.gif')) return MediaType('image', 'gif');
  return null;
}

bool platformFileIsPdf(PlatformFile file) {
  final name = _resolvedFileName(file).toLowerCase();
  if (name.endsWith('.pdf')) return true;
  final ext = file.extension?.trim().toLowerCase();
  return ext == 'pdf';
}
