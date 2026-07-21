import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/vendor_onboarding_model.dart';
import '../../core/theme.dart';
import '../../core/utils/media_url.dart';

class DocumentPreviewScreen extends StatefulWidget {
  final VendorDocument document;

  const DocumentPreviewScreen({super.key, required this.document});

  @override
  State<DocumentPreviewScreen> createState() => _DocumentPreviewScreenState();
}

class _DocumentPreviewScreenState extends State<DocumentPreviewScreen> {
  Uint8List? _bytes;
  bool _loading = true;
  bool _opening = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _mimeType() {
    final doc = widget.document;
    if (doc.isPdfFile) return 'application/pdf';
    if (doc.isImageFile) {
      final name = doc.displayFileName.toLowerCase();
      if (name.endsWith('.png')) return 'image/png';
      if (name.endsWith('.webp')) return 'image/webp';
      if (name.endsWith('.gif')) return 'image/gif';
      return 'image/jpeg';
    }
    return 'application/octet-stream';
  }

  String _pdfOpenHint() {
    if (kIsWeb) {
      return 'PDF opens in a new browser tab with your login session.';
    }
    return 'Opens in your device\'s PDF viewer using your logged-in download.';
  }

  Future<void> _load() async {
    final bytes = await fetchAuthenticatedFileBytes(widget.document.fileUrl);
    if (!mounted) return;
    setState(() {
      _bytes = bytes;
      _loading = false;
      _error = bytes == null ? 'Could not load document preview.' : null;
    });
  }

  Future<void> _openDocument() async {
    if (_opening) return;

    setState(() => _opening = true);
    try {
      if (_bytes != null) {
        final opened = await openDocumentBytes(
          _bytes!,
          _mimeType(),
          fileName: widget.document.displayFileName,
        );
        if (opened) return;
      }

      final url = resolveMediaUrl(widget.document.fileUrl);
      if (url == null) {
        _showOpenFailure();
        return;
      }
      final uri = Uri.tryParse(url);
      if (uri == null) {
        _showOpenFailure();
        return;
      }
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        _showOpenFailure();
      }
    } finally {
      if (mounted) {
        setState(() => _opening = false);
      }
    }
  }

  void _showOpenFailure() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Could not open document. Try again or re-download the file.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final doc = widget.document;

    return Scaffold(
      appBar: AppBar(
        title: Text(doc.documentType),
        actions: [
          IconButton(
            tooltip: 'Open document',
            onPressed: _opening ? null : _openDocument,
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.accent),
            )
          : _error != null
              ? _ErrorState(
                  message: _error!,
                  fileName: doc.displayFileName,
                  opening: _opening,
                  onOpen: _openDocument,
                  onRetry: () {
                    setState(() {
                      _loading = true;
                      _error = null;
                    });
                    _load();
                  },
                )
              : doc.isImageFile && _bytes != null
                  ? InteractiveViewer(
                      minScale: 0.5,
                      maxScale: 4,
                      child: Center(
                        child: Image.memory(
                          _bytes!,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) =>
                              _ErrorState(
                            message: 'Failed to render image.',
                            fileName: doc.displayFileName,
                            opening: _opening,
                            onOpen: _openDocument,
                            onRetry: _load,
                          ),
                        ),
                      ),
                    )
                  : _FilePreviewFallback(
                      document: doc,
                      pdfOpenHint: _pdfOpenHint(),
                      opening: _opening,
                      onOpen: _openDocument,
                    ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final String fileName;
  final bool opening;
  final VoidCallback onOpen;
  final VoidCallback onRetry;

  const _ErrorState({
    required this.message,
    required this.fileName,
    required this.opening,
    required this.onOpen,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.white.withValues(alpha: 0.35)),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 6),
            Text(
              fileName,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 12),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: opening ? null : onOpen,
              icon: opening
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.visibility_outlined),
              label: Text(opening ? 'Opening…' : 'View document'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                backgroundColor: AppTheme.accent,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: opening ? null : onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _FilePreviewFallback extends StatelessWidget {
  final VendorDocument document;
  final String pdfOpenHint;
  final bool opening;
  final VoidCallback onOpen;

  const _FilePreviewFallback({
    required this.document,
    required this.pdfOpenHint,
    required this.opening,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppTheme.accent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                document.isPdfFile ? Icons.picture_as_pdf : Icons.insert_drive_file_outlined,
                size: 44,
                color: AppTheme.accent,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              document.displayFileName,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              document.isPdfFile ? pdfOpenHint : 'Tap below to open this file.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: opening ? null : onOpen,
              icon: opening
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.visibility_outlined),
              label: Text(opening ? 'Opening…' : 'View document'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                backgroundColor: AppTheme.accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
