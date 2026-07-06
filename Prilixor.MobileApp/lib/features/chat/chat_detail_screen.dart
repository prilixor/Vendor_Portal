import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/providers/chat_provider.dart';

class ChatDetailScreen extends StatefulWidget {
  final String sessionId;
  final String orderNumber;
  final String listingTitle;

  const ChatDetailScreen({super.key, required this.sessionId, required this.orderNumber, required this.listingTitle});

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final TextEditingController _messageController = TextEditingController();
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ChatProvider>(context, listen: false).fetchMessages(widget.sessionId);
    });
    // Poll for new messages every 5 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        Provider.of<ChatProvider>(context, listen: false).fetchMessages(widget.sessionId);
      }
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.dispose();
    super.dispose();
  }

  void _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();
    final provider = Provider.of<ChatProvider>(context, listen: false);
    await provider.sendMessage(widget.sessionId, text);
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chat about this Order', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text('Order: ${widget.orderNumber} • ${widget.listingTitle}', style: const TextStyle(color: Colors.white70, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
        backgroundColor: const Color(0xFF1E293B),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: provider.isLoading && provider.messages.isEmpty
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
                : provider.messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.chat_bubble_outline, size: 48, color: Colors.white38),
                            const SizedBox(height: 16),
                            const Text('No active conversation', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            const Text('Start a direct chat with the vendor regarding this item.', style: TextStyle(color: Colors.white54, fontSize: 14), textAlign: TextAlign.center),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        reverse: true, // Show latest messages at the bottom
                        itemCount: provider.messages.length,
                        itemBuilder: (context, index) {
                      // Reverse order
                      final message = provider.messages[provider.messages.length - 1 - index];
                      final isMe = message.isMe;

                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: isMe ? const Color(0xFF6C63FF) : const Color(0xFF1E293B),
                            borderRadius: BorderRadius.only(
                              topLeft: const Radius.circular(16),
                              topRight: const Radius.circular(16),
                              bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
                              bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                            children: [
                              Text(message.text, style: const TextStyle(color: Colors.white, fontSize: 16)),
                              const SizedBox(height: 4),
                              Text(
                                '${message.sentAt.hour.toString().padLeft(2, '0')}:${message.sentAt.minute.toString().padLeft(2, '0')}',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          
          // Input Bar
          Container(
            padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom + 8, left: 16, right: 16, top: 8),
            decoration: const BoxDecoration(
              color: Color(0xFF1E293B),
              border: Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: Colors.white10,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF6C63FF),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white),
                    onPressed: _sendMessage,
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
