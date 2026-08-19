import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/chat_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import 'chat_detail_screen.dart';

class ChatSessionsScreen extends StatefulWidget {
  const ChatSessionsScreen({super.key});

  @override
  State<ChatSessionsScreen> createState() => _ChatSessionsScreenState();
}

class _ChatSessionsScreenState extends State<ChatSessionsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ChatProvider>(context, listen: false).fetchSessions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Messages', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textPrimary),
        elevation: 0,
      ),
      body: provider.isLoading && provider.sessions.isEmpty
          ? const BrandPageLoader()
          : provider.sessions.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 64, color: colors.textMuted),
                      const SizedBox(height: 16),
                      Text('No active messages.', style: TextStyle(color: colors.textSecondary, fontSize: 16)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.sessions.length,
                  separatorBuilder: (context, index) => Divider(color: colors.border, height: 1),
                  itemBuilder: (context, index) {
                    final session = provider.sessions[index];
                    // Customer UI must not reveal vendor/store names — title by order only.
                    final orderLabel = session.relatedOrderNumber != null
                        ? 'Order #${session.relatedOrderNumber}'
                        : 'Order support';
                    final preview = session.subject?.trim().isNotEmpty == true
                        ? session.subject!
                        : 'No messages yet';
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                      leading: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Icon(Icons.chat_bubble_outline, color: Color(0xFF6C63FF), size: 22),
                        ),
                      ),
                      title: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              orderLabel,
                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _formatDate(session.lastMessageAt),
                            style: TextStyle(color: colors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: colors.textSecondary),
                        ),
                      ),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatDetailScreen(
                              sessionId: session.sessionId,
                              orderNumber: session.relatedOrderNumber ?? 'Unknown Order',
                              // Prefer subject (order/product context); never fall back to vendor name.
                              listingTitle: session.subject ?? 'Order chat',
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);
    if (difference.inDays == 0) {
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d';
    } else {
      return '${date.day}/${date.month}';
    }
  }
}
