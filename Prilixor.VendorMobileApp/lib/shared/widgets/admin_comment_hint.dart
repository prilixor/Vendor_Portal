import 'package:flutter/material.dart';

/// Highlights admin rejection notes on rejected verification items.
class AdminCommentHint extends StatelessWidget {
  final String? comment;
  final String? itemLabel;
  final String fallbackMessage;
  final EdgeInsetsGeometry? margin;

  const AdminCommentHint({
    super.key,
    this.comment,
    this.itemLabel,
    this.fallbackMessage = 'Rejected by admin — please upload a corrected file.',
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final hasComment = comment != null && comment!.trim().isNotEmpty;
    final text = hasComment ? comment!.trim() : fallbackMessage;

    return Container(
      margin: margin,
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.redAccent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.admin_panel_settings_outlined,
                size: 14,
                color: Colors.redAccent.withValues(alpha: 0.9),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  hasComment
                      ? (itemLabel != null
                          ? '$itemLabel · Admin comment'
                          : 'Admin comment')
                      : 'Rejected',
                  style: TextStyle(
                    color: Colors.redAccent.withValues(alpha: 0.95),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            text,
            style: TextStyle(
              color: Colors.redAccent.withValues(alpha: 0.95),
              fontSize: 11,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
