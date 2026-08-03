import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/vendor_chat_provider.dart';
import 'chat_detail_screen.dart';

class ChatSessionsScreen extends StatefulWidget {
  const ChatSessionsScreen({super.key});

  @override
  State<ChatSessionsScreen> createState() => _ChatSessionsScreenState();
}

class _ChatSessionsScreenState extends State<ChatSessionsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorChatProvider>(context, listen: false)
        .fetchSessions(vendorId, silent: silent);
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorChatProvider>(context);
    final q = _query.trim().toLowerCase();
    final sessions = q.isEmpty
        ? provider.sessions
        : provider.sessions.where((s) {
            final name = s.customerName.toLowerCase();
            final subject = s.subject.toLowerCase();
            final order = (s.orderNumber ?? '').toLowerCase();
            return name.contains(q) || subject.contains(q) || order.contains(q);
          }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chats'),
        actions: [
          IconButton(
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search conversations…',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white54),
                suffixIcon: q.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white54),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: const Color(0xFF6C63FF),
              onRefresh: () => _load(),
              child: provider.isLoading && provider.sessions.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(
                          child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
                        ),
                      ],
                    )
                  : provider.sessions.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 80),
                            Icon(
                              Icons.chat_bubble_outline,
                              size: 64,
                              color: Colors.white24,
                            ),
                            SizedBox(height: 16),
                            Center(
                              child: Text(
                                'No active messages.',
                                style: TextStyle(color: Colors.white70, fontSize: 16),
                              ),
                            ),
                          ],
                        )
                      : sessions.isEmpty
                          ? ListView(
                              children: const [
                                SizedBox(height: 80),
                                Center(
                                  child: Text(
                                    'No conversations match your search.',
                                    style: TextStyle(color: Colors.white54),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: sessions.length,
                              separatorBuilder: (_, _) =>
                                  const Divider(color: Colors.white10, height: 1),
                              itemBuilder: (context, index) {
                                final session = sessions[index];
                                final orderLabel = session.orderNumber != null &&
                                        session.orderNumber!.isNotEmpty
                                    ? 'Order #${session.orderNumber}'
                                    : 'Customer chat';
                                final preview = session.subject.trim().isNotEmpty
                                    ? session.subject
                                    : session.customerName;
                                return ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 8,
                                    horizontal: 4,
                                  ),
                                  leading: Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF6C63FF)
                                          .withValues(alpha: 0.2),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.chat_bubble_outline,
                                      color: Color(0xFF6C63FF),
                                    ),
                                  ),
                                  title: Text(
                                    orderLabel,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: Text(
                                    '${session.customerName} · $preview',
                                    style: const TextStyle(
                                      color: Colors.white54,
                                      fontSize: 13,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  trailing: Text(
                                    _shortTime(session.lastMessageAt),
                                    style: const TextStyle(
                                      color: Colors.white38,
                                      fontSize: 11,
                                    ),
                                  ),
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => ChatDetailScreen(
                                          sessionId: session.id,
                                          orderNumber: session.orderNumber ?? '—',
                                          customerName: session.customerName,
                                          subject: session.subject,
                                        ),
                                      ),
                                    );
                                  },
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }

  String _shortTime(DateTime dt) {
    final local = dt.toLocal();
    final now = DateTime.now();
    if (local.year == now.year &&
        local.month == now.month &&
        local.day == now.day) {
      final h = local.hour.toString().padLeft(2, '0');
      final m = local.minute.toString().padLeft(2, '0');
      return '$h:$m';
    }
    return '${local.day}/${local.month}';
  }
}
