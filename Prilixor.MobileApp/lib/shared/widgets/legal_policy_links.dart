import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/config/app_urls.dart';
import '../../core/theme.dart';
import 'legal_document_screen.dart';

const _surface = 'customer_mobile';

Future<void> openLegalPolicy(BuildContext context, String path, {String? title}) {
  if (!context.mounted) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => LegalDocumentScreen(
        pathOrSlug: path,
        surface: _surface,
        fallbackTitle: title,
      ),
    ),
  );
}

class LegalPolicyLinkRow extends StatelessWidget {
  final List<({String label, String path})> links;
  final String? prefix;

  const LegalPolicyLinkRow({super.key, required this.links, this.prefix});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final children = <InlineSpan>[
      if (prefix != null)
        TextSpan(text: prefix, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
    ];
    for (var i = 0; i < links.length; i++) {
      if (i > 0) {
        children.add(TextSpan(text: ' · ', style: TextStyle(color: colors.textMuted, fontSize: 12)));
      }
      final link = links[i];
      children.add(
        TextSpan(
          text: link.label,
          style: TextStyle(color: colors.accent, fontSize: 12, fontWeight: FontWeight.w600),
          recognizer: TapGestureRecognizer()..onTap = () => openLegalPolicy(context, link.path, title: link.label),
        ),
      );
    }
    return Text.rich(TextSpan(children: children));
  }
}

class ProductDetailPolicyLinks extends StatelessWidget {
  const ProductDetailPolicyLinks({super.key});

  @override
  Widget build(BuildContext context) {
    return const _CmsLegalPolicyLinks(
      screen: 'product_detail',
      prefix: 'See ',
      fallback: [
        (label: 'Rental & Purchase', path: AppUrls.rentalPath),
        (label: 'Shipping & Delivery', path: AppUrls.shippingPath),
      ],
    );
  }
}

class CancellationPolicyLink extends StatelessWidget {
  const CancellationPolicyLink({super.key});

  @override
  Widget build(BuildContext context) {
    return const _CmsLegalPolicyLinks(
      screen: 'order_cancel',
      prefix: 'See ',
      fallback: [
        (label: 'Cancellation & Refund Policy', path: AppUrls.cancellationPath),
      ],
    );
  }
}

class OrderConfirmPolicyLinks extends StatelessWidget {
  const OrderConfirmPolicyLinks({super.key});

  @override
  Widget build(BuildContext context) {
    return const _CmsLegalPolicyLinks(
      screen: 'order_confirm',
      prefix: 'See ',
      fallback: [
        (label: 'Cancellation & Refund', path: AppUrls.cancellationPath),
        (label: 'Shipping & Delivery', path: AppUrls.shippingPath),
      ],
    );
  }
}

class ProfileSettingsPolicyLinks extends StatelessWidget {
  const ProfileSettingsPolicyLinks({super.key});

  @override
  Widget build(BuildContext context) {
    return const _CmsLegalPolicyLinks(
      screen: 'profile_settings',
      prefix: 'Policies: ',
      fallback: [
        (label: 'Terms of Use', path: AppUrls.termsPath),
        (label: 'Privacy Policy', path: AppUrls.privacyPath),
      ],
    );
  }
}

class SupportPolicyLinks extends StatelessWidget {
  const SupportPolicyLinks({super.key});

  @override
  Widget build(BuildContext context) {
    return const _CmsLegalPolicyLinks(
      screen: 'support',
      fallback: [
        (label: 'Grievance Redressal Policy', path: AppUrls.grievancePath),
      ],
    );
  }
}

class LegalAgreeCheckbox extends StatefulWidget {
  final String screen;
  final bool value;
  final ValueChanged<bool> onChanged;
  final String prefix;
  final Color? activeColor;

  const LegalAgreeCheckbox({
    super.key,
    required this.screen,
    required this.value,
    required this.onChanged,
    required this.prefix,
    this.activeColor,
  });

  @override
  State<LegalAgreeCheckbox> createState() => _LegalAgreeCheckboxState();
}

class _LegalAgreeCheckboxState extends State<LegalAgreeCheckbox> {
  late List<({String label, String path})> _docs;

  @override
  void initState() {
    super.initState();
    _docs = _agreeFallbacks(widget.screen);
    _load();
  }

  Future<void> _load() async {
    final parsed = await _fetchLegalDocs(widget.screen, requiredOnly: true);
    if (!mounted || parsed.isEmpty) return;
    setState(() => _docs = parsed);
  }

  @override
  Widget build(BuildContext context) {
    if (_docs.isEmpty) return const SizedBox.shrink();
    final colors = context.appColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: widget.value,
            onChanged: (next) => widget.onChanged(next == true),
            activeColor: widget.activeColor ?? colors.accent,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text.rich(
              TextSpan(
                style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.35),
                children: [
                  TextSpan(text: '${widget.prefix} '),
                  ..._joinedTitleSpans(context, _docs, colors.accent),
                  const TextSpan(text: '.'),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CmsLegalPolicyLinks extends StatefulWidget {
  final String screen;
  final List<({String label, String path})> fallback;
  final String? prefix;

  const _CmsLegalPolicyLinks({
    required this.screen,
    required this.fallback,
    this.prefix,
  });

  @override
  State<_CmsLegalPolicyLinks> createState() => _CmsLegalPolicyLinksState();
}

class _CmsLegalPolicyLinksState extends State<_CmsLegalPolicyLinks> {
  List<({String label, String path})>? _links;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final parsed = await _fetchLegalDocs(widget.screen);
    if (!mounted || parsed.isEmpty) return;
    setState(() => _links = parsed);
  }

  @override
  Widget build(BuildContext context) {
    return LegalPolicyLinkRow(
      prefix: widget.prefix,
      links: _links ?? widget.fallback,
    );
  }
}

Future<List<({String label, String path})>> _fetchLegalDocs(
  String screen, {
  bool requiredOnly = false,
}) async {
  try {
    final response = await ApiClient().dio.get(
      '/common/legal-documents',
      queryParameters: {
        'surface': _surface,
        'screen': screen,
      },
    );
    if (response.data is! List) return const [];
    final parsed = <({String label, String path, int sort})>[];
    for (final raw in response.data as List) {
      if (raw is! Map) continue;
      final map = Map<String, dynamic>.from(raw);
      final title = map['title']?.toString().trim() ?? '';
      final path = (map['publicPath'] ?? '/${map['slug'] ?? ''}').toString();
      if (title.isEmpty || path.isEmpty || path == '/') continue;
      final required = map['isRequiredToProceed'] == true;
      if (requiredOnly && !required) continue;
      parsed.add((
        label: title,
        path: path,
        sort: int.tryParse(map['sortOrder']?.toString() ?? '') ?? 0,
      ));
    }
    parsed.sort((a, b) => a.sort.compareTo(b.sort));
    return parsed.map((e) => (label: e.label, path: e.path)).toList();
  } catch (_) {
    return const [];
  }
}

List<({String label, String path})> _agreeFallbacks(String screen) {
  switch (screen) {
    case 'checkout':
      return const [
        (label: 'Rental & Purchase Policy', path: AppUrls.rentalPath),
        (label: 'Cancellation & Refund Policy', path: AppUrls.cancellationPath),
        (label: 'Shipping & Delivery Policy', path: AppUrls.shippingPath),
      ];
    case 'prescription':
      return const [
        (label: 'Privacy Policy', path: AppUrls.privacyPath),
      ];
    case 'reconsent':
    case 'register':
    default:
      return const [
        (label: 'Terms of Use', path: AppUrls.termsPath),
        (label: 'Privacy Policy', path: AppUrls.privacyPath),
      ];
  }
}

List<InlineSpan> _joinedTitleSpans(
  BuildContext context,
  List<({String label, String path})> docs,
  Color accent,
) {
  final spans = <InlineSpan>[];
  for (var i = 0; i < docs.length; i++) {
    if (i == 1 && docs.length == 2) {
      spans.add(const TextSpan(text: ' and '));
    } else if (i > 0 && i == docs.length - 1) {
      spans.add(const TextSpan(text: ', and '));
    } else if (i > 0) {
      spans.add(const TextSpan(text: ', '));
    }
    final doc = docs[i];
    spans.add(
      TextSpan(
        text: doc.label,
        style: TextStyle(color: accent, fontWeight: FontWeight.w600),
        recognizer: TapGestureRecognizer()
          ..onTap = () => openLegalPolicy(context, doc.path, title: doc.label),
      ),
    );
  }
  return spans;
}
