import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_client.dart';
import '../../core/theme.dart';
import '../../shared/widgets/legal_policy_links.dart';

/// Same public contact details as blinksmed.com/contact.
/// Phone, hours, and copy come from `/common/website-content` when available.
/// Business and support emails are fixed on the website, so they stay fixed here too.
class SupportScreen extends StatefulWidget {
  final String? orderRef;

  const SupportScreen({super.key, this.orderRef});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  static const _navy = Color(0xFF052A72);
  static const _green = Color(0xFF3FA40B);

  static const _fallbackTitle = 'We are here to';
  static const _fallbackAccent = 'help.';
  static const _fallbackSub = 'Reach our team directly. We respond quickly to every enquiry.';
  static const _fallbackPhone = '+91 8511225390';
  static const _businessEmail = 'info@blinksmed.com';
  static const _supportEmail = 'support@blinksmed.in';
  static const _fallbackHours = 'Mon – Sat, 8:00 AM – 8:00 PM IST';
  static const _fallbackNote =
      'For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly.';

  String _heroTitle = _fallbackTitle;
  String _heroAccent = _fallbackAccent;
  String _heroSub = _fallbackSub;
  String _phone = _fallbackPhone;
  String _hours = _fallbackHours;
  String _note = _fallbackNote;

  @override
  void initState() {
    super.initState();
    _loadContact();
  }

  Future<void> _loadContact() async {
    try {
      final res = await ApiClient().dio.get('/common/website-content');
      final data = res.data;
      if (data is! Map) return;
      final contact = data['contact'];
      if (contact is! Map || !mounted) return;
      setState(() {
        _heroTitle = _or(_text(contact['heroTitle']), _fallbackTitle);
        _heroAccent = _or(_text(contact['heroAccent']), _fallbackAccent);
        _heroSub = _or(_text(contact['heroSub']), _fallbackSub);
        _phone = _or(_text(contact['phone']), _fallbackPhone);
        _hours = _or(_text(contact['operatingHours']), _fallbackHours);
        _note = _or(_text(contact['institutionalNote']), _fallbackNote);
      });
    } catch (_) {
      // Keep the same fallbacks the public contact page uses.
    }
  }

  String _text(dynamic value) => value?.toString().trim() ?? '';

  String _or(String value, String fallback) => value.isEmpty ? fallback : value;

  String get _phoneTel => _phone.replaceAll(RegExp(r'\s+'), '');

  String get _phoneDigits => _phone.replaceAll(RegExp(r'\D'), '');

  Future<void> _call() async {
    await Clipboard.setData(ClipboardData(text: _phone));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Calling $_phone · Number copied')),
      );
    }
    final uri = Uri(scheme: 'tel', path: _phoneTel);
    final ok = await launchUrl(uri);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the phone app on this device')),
      );
    }
  }

  Future<void> _whatsApp() async {
    await _open(Uri.parse('https://wa.me/$_phoneDigits'));
  }

  Future<void> _email(String address) async {
    final order = widget.orderRef?.trim();
    final subject = (order != null && order.isNotEmpty)
        ? 'Support Request (Order: $order)'
        : 'Customer Support Request';
    await _open(Uri.parse('mailto:$address?subject=${Uri.encodeComponent(subject)}'));
  }

  Future<void> _open(Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open that link on this device')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final order = widget.orderRef?.trim();

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Contact us', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textPrimary),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          Text(
            'CONTACT US',
            style: const TextStyle(
              color: _green,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 28,
                fontWeight: FontWeight.w700,
                height: 1.15,
              ),
              children: [
                TextSpan(text: '$_heroTitle '),
                TextSpan(
                  text: _heroAccent,
                  style: const TextStyle(
                    color: _green,
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _heroSub,
            style: TextStyle(color: colors.textSecondary, fontSize: 15, height: 1.4),
          ),
          if (order != null && order.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.border),
              ),
              child: Text(
                'You opened this from order $order. Mention this ID when you call or email us.',
                style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.35),
              ),
            ),
          ],
          const SizedBox(height: 18),
          _card(
            context,
            icon: Icons.phone_outlined,
            title: 'Call Us',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: _call,
                  child: Text(
                    _phone,
                    style: const TextStyle(
                      color: _green,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: _navy,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: const StadiumBorder(),
                        ),
                        onPressed: _call,
                        child: const Text('Call now', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.textPrimary,
                          side: BorderSide(color: colors.border),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: const StadiumBorder(),
                        ),
                        onPressed: _whatsApp,
                        child: const Text('WhatsApp', style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            context,
            icon: Icons.mail_outline,
            title: 'Email Us',
            child: Column(
              children: [
                _emailPill(context, 'BUSINESS', _businessEmail),
                const SizedBox(height: 8),
                _emailPill(context, 'SUPPORT', _supportEmail),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _card(
            context,
            icon: Icons.schedule,
            title: 'Business Hours',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _hours,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'We reply to calls and email during these hours.',
                  style: TextStyle(color: colors.textMuted, fontSize: 13, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            _note,
            style: TextStyle(color: colors.textSecondary, fontSize: 14, height: 1.45),
          ),
          const SizedBox(height: 20),
          const SupportPolicyLinks(),
        ],
      ),
    );
  }

  Widget _emailPill(BuildContext context, String label, String email) {
    final colors = context.appColors;
    return Material(
      color: colors.surfaceElevated,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => _email(email),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Text(
                '$label: ',
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
              Expanded(
                child: Text(
                  email,
                  style: const TextStyle(
                    color: _green,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Widget child,
  }) {
    final colors = context.appColors;
    final iconColor = context.isDarkMode ? const Color(0xFF8FD15A) : _navy;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.surfaceElevated,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
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
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
