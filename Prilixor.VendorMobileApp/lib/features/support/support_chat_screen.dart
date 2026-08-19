import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/support_model.dart';
import '../../core/providers/vendor_support_provider.dart';
import '../../core/utils/chat_day_label.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/multipart_file_util.dart';
import '../../core/utils/support_chat_routing.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';

enum SupportView { welcome, chat, tickets }

/// BlinksMed Support — AI assistant + admin tickets (Vendor Web SupportChat parity).
class SupportChatScreen extends StatefulWidget {
  final String? initialCategory;
  final String? initialMessage;
  /// When true (e.g. from Alerts / FAB badge), open the ticket list first.
  final bool openTicketsInitially;
  /// Optional ticket number from notification body (`Ticket TK-...`).
  final String? initialTicketNumber;

  const SupportChatScreen({
    super.key,
    this.initialCategory,
    this.initialMessage,
    this.openTicketsInitially = false,
    this.initialTicketNumber,
  });

  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  late SupportView _view;
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _pollTimer;
  bool _handledInitialPrompt = false;
  bool _handledInitialTicket = false;

  @override
  void initState() {
    super.initState();
    final openTickets = widget.openTicketsInitially ||
        (widget.initialTicketNumber?.trim().isNotEmpty ?? false);
    _view = openTickets ? SupportView.tickets : SupportView.welcome;
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      if (_view == SupportView.chat) {
        final vendorId =
            Provider.of<AuthProvider>(context, listen: false).vendorId;
        final provider =
            Provider.of<VendorSupportProvider>(context, listen: false);
        if (vendorId != null) {
          provider.refreshActiveConversation(vendorId);
          provider.markActiveTicketRead(vendorId);
        }
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (openTickets) {
        _openTicketsAndMaybeSelect();
      }
      _maybeStartInitialPrompt();
    });
  }

  Future<void> _maybeStartInitialPrompt() async {
    if (_handledInitialPrompt) return;
    final prompt = widget.initialMessage?.trim();
    if (prompt == null || prompt.isEmpty) return;
    _handledInitialPrompt = true;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorSupportProvider>(context, listen: false);
    setState(() => _view = SupportView.chat);
    await provider.sendAiMessage(
      vendorId: vendorId,
      text: prompt,
      category: widget.initialCategory ?? 'Documents',
      forceNewTicket: true,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send({String? category}) async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorSupportProvider>(context, listen: false);
    if (provider.isTicketClosed) return;

    _messageController.clear();
    setState(() => _view = SupportView.chat);

    final ok = await provider.sendAiMessage(
      vendorId: vendorId,
      text: text,
      category: category,
      forceNewTicket:
          provider.activeTicketId == null && provider.messages.isEmpty,
    );
    if (!mounted) return;
    if (!ok && provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error!),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
    _scrollToBottom();
  }

  Future<void> _pickAndUpload() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;

    final provider =
        Provider.of<VendorSupportProvider>(context, listen: false);
    if (provider.sending || provider.isTicketClosed) return;

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'pdf',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'txt',
      ],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (platformFileNeedsBytes(file)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not read the selected file.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final upload = await provider.uploadFile(
      vendorId: vendorId,
      file: file,
    );
    if (!mounted || upload == null) return;

    setState(() => _view = SupportView.chat);
    await provider.sendAiMessage(
      vendorId: vendorId,
      text: '📎 Attached: ${upload.originalFileName}',
      attachmentUrls: [upload.fileUrl],
      forceNewTicket:
          provider.activeTicketId == null && provider.messages.isEmpty,
    );
    _scrollToBottom();
  }

  Future<void> _openTickets() async {
    await _openTicketsAndMaybeSelect();
  }

  Future<void> _openTicketsAndMaybeSelect() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    setState(() => _view = SupportView.tickets);
    final provider =
        Provider.of<VendorSupportProvider>(context, listen: false);
    await provider.fetchTickets(vendorId);
    if (!mounted || _handledInitialTicket) return;

    final wanted = widget.initialTicketNumber?.trim().toUpperCase();
    if (wanted == null || wanted.isEmpty) return;
    _handledInitialTicket = true;

    SupportTicket? match;
    for (final ticket in provider.tickets) {
      if (ticket.ticketNumber.toUpperCase() == wanted) {
        match = ticket;
        break;
      }
    }
    if (match == null) return;

    final ok = await provider.openTicket(match, vendorId: vendorId);
    if (!mounted || !ok) return;
    setState(() => _view = SupportView.chat);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorSupportProvider>(context);
    final title = switch (_view) {
      SupportView.tickets => 'My Tickets',
      _ => 'BlinksMed Support',
    };

    return Scaffold(
      backgroundColor: AppTheme.bg(context),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_view != SupportView.welcome) {
              setState(() => _view = SupportView.welcome);
            } else {
              Navigator.of(context).maybePop();
            }
          },
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF6C63FF), Color(0xFF5A52E0)],
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            if (_view != SupportView.tickets)
              const Text(
                'We typically reply instantly',
                style: TextStyle(fontSize: 11, color: Colors.white70),
              ),
          ],
        ),
        actions: [
          if (_view == SupportView.welcome)
            IconButton(
              icon: const Icon(Icons.confirmation_number_outlined),
              tooltip: 'My tickets',
              onPressed: _openTickets,
            ),
          if (_view == SupportView.chat) ...[
            IconButton(
              icon: const Icon(Icons.confirmation_number_outlined),
              tooltip: 'My tickets',
              onPressed: _openTickets,
            ),
            IconButton(
              icon: const Icon(Icons.add_comment_outlined),
              tooltip: 'New conversation',
              onPressed: () {
                provider.startNewConversation();
                setState(() => _view = SupportView.welcome);
              },
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: switch (_view) {
              SupportView.tickets => _TicketsView(
                  onBack: () => setState(() => _view = SupportView.welcome),
                  onOpenTicket: (ticket) async {
                    final vendorId =
                        Provider.of<AuthProvider>(context, listen: false).vendorId;
                    final ok = await provider.openTicket(
                      ticket,
                      vendorId: vendorId,
                    );
                    if (!mounted) return;
                    if (ok) {
                      setState(() => _view = SupportView.chat);
                      _scrollToBottom();
                    }
                  },
                  onNewConversation: () {
                    provider.startNewConversation();
                    setState(() => _view = SupportView.welcome);
                  },
                ),
              SupportView.welcome => _WelcomeView(
                  onQuickReply: (qr) async {
                    provider.startNewConversation();
                    setState(() => _view = SupportView.chat);
                    final vendorId =
                        Provider.of<AuthProvider>(context, listen: false).vendorId;
                    if (vendorId == null) return;
                    await provider.sendAiMessage(
                      vendorId: vendorId,
                      text: qr.label,
                      category: qr.category,
                      forceNewTicket: true,
                    );
                    _scrollToBottom();
                  },
                ),
              SupportView.chat => _ChatView(
                  scrollController: _scrollController,
                  onScroll: _scrollToBottom,
                ),
            },
          ),
          if (_view == SupportView.welcome || _view == SupportView.chat)
            _InputBar(
              controller: _messageController,
              sending: provider.sending,
              locked: provider.isTicketClosed,
              ticketStatus: provider.activeTicketStatus,
              onSend: () => _send(),
              onAttach: _pickAndUpload,
            ),
        ],
      ),
    );
  }
}

class _WelcomeView extends StatelessWidget {
  final ValueChanged<SupportQuickReply> onQuickReply;

  const _WelcomeView({required this.onQuickReply});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.smart_toy_outlined,
                  size: 18, color: Color(0xFF6C63FF)),
            ),
            const SizedBox(width: 8),
            Text(
              'BLINKSMED ASSISTANT',
              style: TextStyle(
                color: context.appColors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.card(context),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
              bottomRight: Radius.circular(16),
            ),
            border: Border.all(color: context.appColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '👋 Hi! I\'m BlinksMed Support Assistant.',
                style: TextStyle(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'How can I help you today? Choose a topic below or type your question.',
                style: TextStyle(color: context.appColors.textSecondary, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: supportQuickReplies
              .map(
                (qr) => ActionChip(
                  label: Text('${qr.icon} ${qr.label}'),
                  backgroundColor: AppTheme.card(context),
                  labelStyle: TextStyle(color: context.appColors.textPrimary, fontSize: 12),
                  side: BorderSide(color: context.appColors.border),
                  onPressed: () => onQuickReply(qr),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _ChatView extends StatefulWidget {
  final ScrollController scrollController;
  final VoidCallback onScroll;

  const _ChatView({
    required this.scrollController,
    required this.onScroll,
  });

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  @override
  void initState() {
    super.initState();
    widget.onScroll();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorSupportProvider>(context);

    if (provider.messagesLoading && provider.messages.isEmpty) {
      return const BrandPageLoader();
    }

    return ListView.builder(
      controller: widget.scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: provider.messages.length +
          (provider.awaitingAi ? 1 : 0) +
          (provider.activeTicketStatus != null ? 1 : 0) +
          (isWaitingForHumanSupport(
                messages: provider.messages,
                sending: provider.sending,
              )
              ? 1
              : 0),
      itemBuilder: (context, index) {
        final waiting = isWaitingForHumanSupport(
          messages: provider.messages,
          sending: provider.sending,
        );
        final statusIndex = provider.messages.length +
            (provider.awaitingAi ? 1 : 0) +
            (waiting ? 1 : 0);

        if (provider.activeTicketStatus != null && index == statusIndex) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Center(
              child: Text(
                'Ticket status: ${provider.activeTicketStatus}',
                style: TextStyle(color: context.appColors.textMuted, fontSize: 11),
              ),
            ),
          );
        }

        if (waiting && index == provider.messages.length + (provider.awaitingAi ? 1 : 0)) {
          return Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Center(
              child: Text(
                'Message received · waiting for support team',
                style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
              ),
            ),
          );
        }

        if (provider.awaitingAi && index == provider.messages.length) {
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
                Text('Assistant is thinking…', style: TextStyle(color: context.appColors.textMuted)),
              ],
            ),
          );
        }

        final msg = provider.messages[index];
        final prev = index > 0 ? provider.messages[index - 1] : null;
        final showDay =
            prev == null || !isSameChatDay(prev.createdAt, msg.createdAt);
        return Column(
          children: [
            if (showDay)
              Padding(
                padding: const EdgeInsets.only(bottom: 10, top: 4),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.card(context),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: Text(
                      formatChatDayLabel(msg.createdAt),
                      style: TextStyle(
                        color: context.appColors.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            _MessageBubble(message: msg),
          ],
        );
      },
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final SupportMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isMe = message.isVendor;
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  message.senderLabel.toUpperCase(),
                  style: TextStyle(
                    color: context.appColors.textMuted,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  formatChatTime(message.createdAt),
                  style: TextStyle(color: context.appColors.textMuted, fontSize: 9),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isMe
                    ? AppTheme.accent
                    : AppTheme.card(context),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(14),
                  topRight: const Radius.circular(14),
                  bottomLeft: isMe ? const Radius.circular(14) : Radius.zero,
                  bottomRight: isMe ? Radius.zero : const Radius.circular(14),
                ),
                border: isMe
                    ? null
                    : Border.all(
                        color: message.isAdmin
                            ? Colors.amber.withValues(alpha: 0.4)
                            : context.appColors.border,
                      ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.message,
                    style: TextStyle(
                      color: isMe ? Colors.white : context.appColors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                  ...message.attachmentUrls.map(_AttachmentPreview.new),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentPreview extends StatelessWidget {
  final String url;
  const _AttachmentPreview(this.url);

  @override
  Widget build(BuildContext context) {
    final resolved = resolveMediaUrl(url) ?? url;
    final clean = resolved.split('?').first;
    final isImage = RegExp(r'\.(jpg|jpeg|png|gif|webp|svg|bmp)$', caseSensitive: false)
        .hasMatch(clean);

    Future<void> openAttachment() async {
      final uri = Uri.tryParse(resolved);
      if (uri == null) return;
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }

    if (isImage) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: GestureDetector(
          onTap: openAttachment,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(
              resolved,
              height: 120,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Text(
                'Image attachment',
                style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: GestureDetector(
        onTap: openAttachment,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.attach_file, size: 14, color: context.appColors.textSecondary),
            const SizedBox(width: 4),
            Text(
              'Download attachment',
              style: TextStyle(
                color: context.appColors.textSecondary,
                fontSize: 12,
                decoration: TextDecoration.underline,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TicketsView extends StatelessWidget {
  final VoidCallback onBack;
  final ValueChanged<SupportTicket> onOpenTicket;
  final VoidCallback onNewConversation;

  const _TicketsView({
    required this.onBack,
    required this.onOpenTicket,
    required this.onNewConversation,
  });

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<VendorSupportProvider>(context);

    if (provider.ticketsLoading) {
      return const BrandPageLoader();
    }

    if (provider.tickets.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.confirmation_number_outlined,
                  size: 48, color: context.appColors.textMuted),
              const SizedBox(height: 12),
              Text('No tickets yet.', style: TextStyle(color: context.appColors.textPrimary)),
              const SizedBox(height: 4),
              Text(
                'Start a conversation to create one.',
                style: TextStyle(color: context.appColors.textMuted),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onNewConversation,
                icon: const Icon(Icons.add),
                label: const Text('New conversation'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: provider.tickets.length,
      separatorBuilder: (context, index) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final ticket = provider.tickets[index];
        return Material(
          color: AppTheme.card(context),
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => onOpenTicket(ticket),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.appColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        ticket.ticketNumber,
                        style: TextStyle(
                          color: context.appColors.textMuted,
                          fontFamily: 'monospace',
                          fontSize: 11,
                        ),
                      ),
                      const Spacer(),
                      _StatusChip(status: ticket.status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    ticket.subject,
                    style: TextStyle(
                      color: context.appColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    ticket.category,
                    style: TextStyle(color: context.appColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  Color get _color {
    switch (status.toLowerCase()) {
      case 'open':
        return Colors.green;
      case 'in progress':
        return Colors.orange;
      case 'resolved':
        return Colors.blue;
      case 'closed':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(color: _color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final bool locked;
  final String? ticketStatus;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  const _InputBar({
    required this.controller,
    required this.sending,
    required this.locked,
    required this.ticketStatus,
    required this.onSend,
    required this.onAttach,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        12,
        MediaQuery.of(context).padding.bottom + 8,
      ),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        border: Border(top: BorderSide(color: context.appColors.border)),
      ),
      child: Column(
        children: [
          if (locked)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.bg(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.appColors.border, style: BorderStyle.solid),
              ),
              child: Text(
                'This ticket is ${ticketStatus?.toLowerCase() ?? 'closed'}. Start a new conversation for further help.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
              ),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: sending ? null : onAttach,
                  icon: Icon(Icons.attach_file, color: context.appColors.textMuted),
                ),
                Expanded(
                  child: TextField(
                    controller: controller,
                    enabled: !sending,
                    keyboardType: TextInputType.multiline,
                    textInputAction: TextInputAction.newline,
                    minLines: 1,
                    maxLines: 4,
                    style: TextStyle(color: context.appColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Type your question…',
                      hintStyle: TextStyle(color: context.appColors.textMuted),
                      filled: true,
                      fillColor: AppTheme.bg(context),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: context.appColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: context.appColors.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton.filled(
                  onPressed: sending ? null : onSend,
                  style: IconButton.styleFrom(
                    backgroundColor: AppTheme.accent,
                  ),
                  icon: sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          const SizedBox(height: 6),
          Text(
            'Powered by AI · For urgent issues, admin will respond',
            style: TextStyle(color: context.appColors.textMuted, fontSize: 10),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
