import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_urls.dart';

class SupportScreen extends StatelessWidget {
  final String? orderRef;

  const SupportScreen({super.key, this.orderRef});

  static const _supportEmail = 'support@blinksmed.com';
  static const _supportPhone = '+91 9876543210';
  static const _supportPhoneTel = '+919876543210';

  Future<void> _copyEmail(BuildContext context) async {
    await Clipboard.setData(const ClipboardData(text: _supportEmail));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Support email copied'), backgroundColor: Colors.green),
      );
    }
  }

  Future<void> _callSupport() async {
    final uri = Uri(scheme: 'tel', path: _supportPhoneTel);
    await launchUrl(uri);
  }

  Future<void> _openContactPage() async {
    final uri = Uri.parse('${AppUrls.portalWebBaseUrl}${AppUrls.contactPath}');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Support', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Get help with rentals, orders, or your account.',
            style: TextStyle(color: Colors.white54, fontSize: 14),
          ),
          if (orderRef != null && orderRef!.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white10,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Text(
                'You opened this from order $orderRef. Mention this ID when you contact us.',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          ],
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.support_agent, color: Color(0xFF6C63FF)),
                    SizedBox(width: 8),
                    Text('Contact us', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Email or call our support team for account help and general inquiries.',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
                const SizedBox(height: 12),
                SelectableText(
                  _supportEmail,
                  style: const TextStyle(color: Color(0xFFA5B4FC), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                SelectableText(
                  _supportPhone,
                  style: const TextStyle(color: Color(0xFFA5B4FC), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Hours: Mon–Sat, 9:00 AM – 6:00 PM IST',
                  style: TextStyle(color: Colors.white38, fontSize: 12),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
                    onPressed: () => _copyEmail(context),
                    icon: const Icon(Icons.copy, color: Colors.white),
                    label: const Text('Copy support email', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white70,
                      side: const BorderSide(color: Colors.white24),
                    ),
                    onPressed: _callSupport,
                    icon: const Icon(Icons.phone_outlined),
                    label: const Text('Call support'),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white70,
                      side: const BorderSide(color: Colors.white24),
                    ),
                    onPressed: _openContactPage,
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Open contact page'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: Colors.white38, size: 18),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Order-specific chat is available from Order details. Platform support handles account and billing questions.',
                    style: TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
