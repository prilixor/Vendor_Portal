import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/chat_provider.dart';
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

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Messages', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: provider.isLoading && provider.sessions.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
          : provider.sessions.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 64, color: Colors.white24),
                      SizedBox(height: 16),
                      Text('No active messages.', style: TextStyle(color: Colors.white70, fontSize: 16)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: provider.sessions.length,
                  separatorBuilder: (context, index) => const Divider(color: Colors.white10, height: 1),
                  itemBuilder: (context, index) {
                    final session = provider.sessions[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                      leading: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            session.participantName.isNotEmpty ? session.participantName[0].toUpperCase() : 'V',
                            style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold, fontSize: 20),
                          ),
                        ),
                      ),
                      title: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(session.participantName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          Text(
                            _formatDate(session.lastMessageAt),
                            style: const TextStyle(color: Colors.white38, fontSize: 12),
                          ),
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (session.relatedOrderNumber != null)
                            Text('Order #${session.relatedOrderNumber}', style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            session.subject ?? 'No messages yet',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white70),
                          ),
                        ],
                      ),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatDetailScreen(
                              sessionId: session.sessionId,
                              orderNumber: session.relatedOrderNumber ?? 'Unknown Order',
                              listingTitle: session.subject ?? session.participantName,
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
