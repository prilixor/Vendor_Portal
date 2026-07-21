import 'dart:io';
import 'dart:typed_data';

import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';

Future<bool> openDocumentBytes(
  Uint8List bytes,
  String mimeType, {
  String? fileName,
}) async {
  try {
    final dir = await getTemporaryDirectory();
    final localName = _tempFileName(fileName, mimeType);
    final file = File('${dir.path}/$localName');
    await file.writeAsBytes(bytes, flush: true);

    final result = await OpenFile.open(file.path, type: mimeType);
    return result.type == ResultType.done;
  } catch (_) {
    return false;
  }
}

String _tempFileName(String? fileName, String mimeType) {
  var name = (fileName ?? 'document').split(RegExp(r'[/\\]')).last.trim();
  if (name.isEmpty) name = 'document';

  final queryIndex = name.indexOf('?');
  if (queryIndex >= 0) {
    name = name.substring(0, queryIndex);
  }

  final ext = _extensionForMime(mimeType);
  if (!name.toLowerCase().endsWith(ext.toLowerCase())) {
    name = '$name$ext';
  }

  return '${DateTime.now().millisecondsSinceEpoch}_$name';
}

String _extensionForMime(String mimeType) {
  switch (mimeType.toLowerCase()) {
    case 'application/pdf':
      return '.pdf';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    default:
      return '';
  }
}
