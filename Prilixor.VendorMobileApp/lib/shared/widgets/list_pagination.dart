import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Mobile-first list pagination — prev / next + page summary only.
/// Numbered page chips are omitted on phone (web TablePagination sm:hidden parity).
class ListPagination extends StatelessWidget {
  final int page;
  final int pageSize;
  final int total;
  final ValueChanged<int> onPageChange;
  final String label;

  const ListPagination({
    super.key,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.onPageChange,
    this.label = 'items',
  });

  @override
  Widget build(BuildContext context) {
    if (total <= 0) return const SizedBox.shrink();

    final colors = context.appColors;
    final totalPages = math.max(1, (total / pageSize).ceil());
    if (totalPages <= 1) return const SizedBox.shrink();

    final safePage = page.clamp(1, totalPages);
    final from = (safePage - 1) * pageSize + 1;
    final to = math.min(safePage * pageSize, total);
    final canPrev = safePage > 1;
    final canNext = safePage < totalPages;

    return Semantics(
      label: 'Pagination. Page $safePage of $totalPages. Showing $from to $to of $total $label.',
      child: Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.border.withValues(alpha: 0.75))),
        ),
        child: Row(
          children: [
            _NavButton(
              icon: Icons.chevron_left_rounded,
              tooltip: 'Previous page',
              enabled: canPrev,
              onTap: () => onPageChange(safePage - 1),
            ),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Page $safePage of $totalPages',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      height: 1.2,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$from–$to of $total',
                    style: TextStyle(
                      color: colors.textMuted,
                      fontSize: 11,
                      height: 1.2,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            _NavButton(
              icon: Icons.chevron_right_rounded,
              tooltip: 'Next page',
              enabled: canNext,
              onTap: () => onPageChange(safePage + 1),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final bool enabled;
  final VoidCallback onTap;

  const _NavButton({
    required this.icon,
    required this.tooltip,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Semantics(
      button: true,
      enabled: enabled,
      label: tooltip,
      child: Material(
        color: enabled ? colors.surfaceElevated : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: enabled
                ? colors.border.withValues(alpha: 0.85)
                : colors.border.withValues(alpha: 0.35),
          ),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(
              icon,
              size: 26,
              color: enabled
                  ? colors.textPrimary
                  : colors.textMuted.withValues(alpha: 0.5),
            ),
          ),
        ),
      ),
    );
  }
}
