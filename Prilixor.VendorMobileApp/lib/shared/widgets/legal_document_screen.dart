import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/theme.dart';
import 'brand_page_loader.dart';

class LegalDocumentScreen extends StatefulWidget {
  final String pathOrSlug;
  final String? fallbackTitle;
  final String surface;

  const LegalDocumentScreen({
    super.key,
    required this.pathOrSlug,
    required this.surface,
    this.fallbackTitle,
  });

  @override
  State<LegalDocumentScreen> createState() => _LegalDocumentScreenState();
}

class _LegalDocumentScreenState extends State<LegalDocumentScreen> {
  bool _loading = true;
  String? _error;
  _LegalDoc? _doc;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _key {
    var key = widget.pathOrSlug.trim();
    if (key.startsWith('/')) key = key.substring(1);
    return key;
  }

  Future<void> _openBrowser() async {
    final path = _doc?.publicPath ?? (widget.pathOrSlug.startsWith('/') ? widget.pathOrSlug : '/$_key');
    final uri = Uri.parse('${ApiClient().portalWebBaseUrl}$path');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiClient().dio.get(
        '/common/legal-documents/$_key',
        queryParameters: {'surface': widget.surface},
      );
      final map = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : null;
      if (!mounted) return;
      if (map == null) {
        setState(() {
          _loading = false;
          _error = 'This policy is not published for this app.';
        });
        return;
      }
      setState(() {
        _doc = _LegalDoc.fromJson(map);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load this policy. Check your connection and try again.';
      });
    }
  }

  Future<bool> _onTapUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    final path = uri.hasScheme ? uri.path : url;
    final host = uri.host.toLowerCase();
    final ownHost = host.isEmpty ||
        host == 'blinksmed.com' ||
        host == 'www.blinksmed.com' ||
        host == 'vendor.blinksmed.com';
    if (ownHost && path.isNotEmpty && path != '/' && !path.startsWith('/api')) {
      if (!mounted) return true;
      await Navigator.of(context).push(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => LegalDocumentScreen(
            pathOrSlug: path,
            surface: widget.surface,
          ),
        ),
      );
      return true;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final title = _doc?.title ?? widget.fallbackTitle ?? 'Policy';
    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Open in browser',
            onPressed: _openBrowser,
            icon: const Icon(Icons.open_in_new),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: BrandPageLoader(label: 'Loading policy'))
          : _error != null
              ? _ErrorState(
                  message: _error!,
                  onRetry: _load,
                  onOpenBrowser: _openBrowser,
                )
              : _DocumentBody(doc: _doc!, onTapUrl: _onTapUrl),
    );
  }
}

class _DocumentBody extends StatelessWidget {
  final _LegalDoc doc;
  final Future<bool> Function(String url) onTapUrl;

  const _DocumentBody({required this.doc, required this.onTapUrl});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final meta = [
      if (doc.effectiveFrom != null) 'Effective ${_formatStamp(doc.effectiveFrom!)}',
      if (doc.lastUpdated != null) 'Last updated ${_formatStamp(doc.lastUpdated!)}',
      if (doc.versionNumber != null) 'Version ${doc.versionNumber}',
    ].join(' · ');

    return SelectionArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(
            doc.title,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          if (meta.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(meta, style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.4)),
          ],
          if (doc.summary != null && doc.summary!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(doc.summary!, style: TextStyle(color: colors.textSecondary, fontSize: 14, height: 1.45)),
          ],
          const SizedBox(height: 22),
          HtmlWidget(
            doc.contentHtml.isEmpty ? '<p>This policy has no published content yet.</p>' : doc.contentHtml,
            textStyle: TextStyle(color: colors.textPrimary, fontSize: 15, height: 1.55),
            onTapUrl: onTapUrl,
            customStylesBuilder: (element) {
              switch (element.localName) {
                case 'a':
                  return {'color': '#6C63FF', 'text-decoration': 'underline'};
                case 'h1':
                case 'h2':
                case 'h3':
                  return {'font-weight': '700'};
                case 'li':
                case 'p':
                  return {'margin-bottom': '10px'};
                default:
                  return null;
              }
            },
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback onOpenBrowser;

  const _ErrorState({
    required this.message,
    required this.onRetry,
    required this.onOpenBrowser,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.article_outlined, size: 40, color: colors.textMuted),
          const SizedBox(height: 12),
          Text(
            'Policy not available',
            style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center, style: TextStyle(color: colors.textSecondary, height: 1.4)),
          const SizedBox(height: 20),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
          TextButton(onPressed: onOpenBrowser, child: const Text('Open in browser')),
        ],
      ),
    );
  }
}

class _LegalDoc {
  final String title;
  final String? summary;
  final String? publicPath;
  final String contentHtml;
  final int? versionNumber;
  final DateTime? effectiveFrom;
  final DateTime? lastUpdated;

  const _LegalDoc({
    required this.title,
    required this.contentHtml,
    this.summary,
    this.publicPath,
    this.versionNumber,
    this.effectiveFrom,
    this.lastUpdated,
  });

  factory _LegalDoc.fromJson(Map<String, dynamic> map) {
    return _LegalDoc(
      title: map['title']?.toString() ?? 'Policy',
      summary: map['summary']?.toString(),
      publicPath: map['publicPath']?.toString(),
      contentHtml: map['contentHtml']?.toString() ?? '',
      versionNumber: int.tryParse(map['versionNumber']?.toString() ?? ''),
      effectiveFrom: DateTime.tryParse(map['effectiveFrom']?.toString() ?? ''),
      lastUpdated: DateTime.tryParse(map['lastUpdated']?.toString() ?? ''),
    );
  }
}

String _formatStamp(DateTime value) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')} ${months[local.month - 1]} ${local.year}';
}
