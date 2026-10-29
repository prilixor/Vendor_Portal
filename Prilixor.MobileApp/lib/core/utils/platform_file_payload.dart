import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

/// Web has no filesystem path — reading [PlatformFile.path] throws there.
String? safePlatformFilePath(PlatformFile file) => kIsWeb ? null : file.path;

Future<MultipartFile?> multipartFromPickedFile({
  required String fileName,
  String? path,
  List<int>? bytes,
}) async {
  if (bytes != null && bytes.isNotEmpty) {
    return MultipartFile.fromBytes(bytes, filename: fileName);
  }
  if (!kIsWeb && path != null && path.isNotEmpty) {
    return MultipartFile.fromFile(path, filename: fileName);
  }
  return null;
}
