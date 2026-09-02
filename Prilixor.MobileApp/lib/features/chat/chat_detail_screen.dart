import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/chat_model.dart';
import '../../core/providers/chat_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/chat_day_label.dart';
import '../../shared/widgets/brand_page_loader.dart';

class ChatDetailScreen extends StatefulWidget {
  final String sessionId;
  final String orderNumber;
  final String listingTitle;

  const ChatDetailScreen({
    super.key,
    required this.sessionId,
    required this.orderNumber,
    required this.listingTitle,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  static const Color _accent = Color(0xFF6C63FF);

  final TextEditingController _messageController = TextEditingController();
  Timer? _pollingTimer;
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_syncCanSend);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ChatProvider>(context, listen: false).fetchMessages(widget.sessionId);
    });
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        Provider.of<ChatProvider>(context, listen: false).fetchMessages(widget.sessionId);
      }
    });
  }

  void _syncCanSend() {
    final next = _messageController.text.trim().isNotEmpty;
    if (next != _canSend && mounted) {
      setState(() => _canSend = next);
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.removeListener(_syncCanSend);
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();
    final provider = Provider.of<ChatProvider>(context, listen: false);
    await provider.sendMessage(widget.sessionId, text);
  }

  String _senderLabel(ChatMessageModel message) {
    if (message.isMe) return 'You';
    final name = message.senderName.trim();
    if (name.isNotEmpty) return name;
    return 'Support Team';
  }

  Widget _orderContextBanner(AppPalette colors) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Message support about this order.',
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Order: ${widget.orderNumber} • ${widget.listingTitle}',
            style: TextStyle(
              color: context.isDarkMode ? const Color(0xFFA78BFA) : const Color(0xFF7C3AED),
              fontSize: 12,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _daySeparator(AppPalette colors, DateTime date) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: colors.surfaceElevated.withValues(alpha: context.isDarkMode ? 0.9 : 1),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: colors.border.withValues(alpha: 0.75)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: context.isDarkMode ? 0.12 : 0.04),
                blurRadius: 6,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            formatChatDayLabel(date),
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
        ),
      ),
    );
  }

  Widget _messageBubble({
    required AppPalette colors,
    required ChatMessageModel message,
    required double maxWidth,
  }) {
    final isMe = message.isMe;
    final senderLabel = _senderLabel(message).toUpperCase();
    final timeLabel = formatChatTime(message.sentAt);

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 4, right: 4, bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      senderLabel,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      timeLabel,
                      style: TextStyle(
                        color: colors.textMuted.withValues(alpha: 0.85),
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isMe ? _accent : colors.surface,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(isMe ? 18 : 6),
                    bottomRight: Radius.circular(isMe ? 6 : 18),
                  ),
                  border: isMe ? null : Border.all(color: colors.border),
                  boxShadow: [
                    BoxShadow(
                      color: (isMe ? _accent : Colors.black).withValues(
                        alpha: isMe ? 0.18 : (context.isDarkMode ? 0.18 : 0.06),
                      ),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  message.text,
                  style: TextStyle(
                    color: isMe ? Colors.white : colors.textPrimary,
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _emptyState(AppPalette colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: _accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.chat_bubble_outline_rounded, size: 34, color: _accent.withValues(alpha: 0.9)),
            ),
            const SizedBox(height: 18),
            Text(
              'No active conversation',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Start a chat with BlinksMed support about this order.',
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 13,
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputBar(AppPalette colors) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, bottomInset + 10),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              style: TextStyle(color: colors.textPrimary, fontSize: 15),
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              minLines: 1,
              maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: 'Type a message...',
                hintStyle: TextStyle(color: colors.textMuted),
                filled: true,
                fillColor: colors.background,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(color: colors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: const BorderSide(color: _accent, width: 1.2),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(22),
                  borderSide: BorderSide(color: colors.border),
                ),
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 10),
          Material(
            color: _canSend ? _accent : _accent.withValues(alpha: 0.45),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _canSend ? _sendMessage : null,
              child: const SizedBox(
                width: 46,
                height: 46,
                child: Icon(Icons.send_rounded, color: Colors.white, size: 21),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final colors = context.appColors;
    final maxBubbleWidth = MediaQuery.sizeOf(context).width * 0.78;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Chat with BlinksMed support',
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        iconTheme: IconThemeData(color: colors.textPrimary),
        elevation: 0,
        scrolledUnderElevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: colors.border),
        ),
      ),
      body: Column(
        children: [
          _orderContextBanner(colors),
          Expanded(
            child: provider.isLoading && provider.messages.isEmpty
                ? const BrandPageLoader()
                : provider.messages.isEmpty
                    ? _emptyState(colors)
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                        reverse: true,
                        itemCount: provider.messages.length,
                        itemBuilder: (context, index) {
                          final messages = provider.messages;
                          final chronologicalIndex = messages.length - 1 - index;
                          final message = messages[chronologicalIndex];
                          final previous = chronologicalIndex > 0
                              ? messages[chronologicalIndex - 1]
                              : null;
                          final showDay = previous == null ||
                              !isSameChatDay(previous.sentAt, message.sentAt);

                          return Column(
                            children: [
                              if (showDay) _daySeparator(colors, message.sentAt),
                              _messageBubble(
                                colors: colors,
                                message: message,
                                maxWidth: maxBubbleWidth,
                              ),
                            ],
                          );
                        },
                      ),
          ),
          _inputBar(colors),
        ],
      ),
    );
  }
}
