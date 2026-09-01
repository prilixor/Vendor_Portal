import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';

typedef PaginationItemValue = Object; // int page number or 'ellipsis'

/// Truncated page numbers — web [getPaginationItems] parity.
List<PaginationItemValue> getPaginationItems(
  int current,
  int total, {
  int siblingCount = 1,
}) {
  final totalPages = math.max(1, total);
  final page = current.clamp(1, totalPages);

  List<int> range(int start, int end) =>
      List.generate(math.max(0, end - start + 1), (i) => start + i);

  final maxVisible = siblingCount * 2 + 5;
  if (totalPages <= maxVisible) return range(1, totalPages);

  final leftSibling = math.max(page - siblingCount, 1);
  final rightSibling = math.min(page + siblingCount, totalPages);
  final showLeftEllipsis = leftSibling > 2;
  final showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    final leftCount = 3 + siblingCount * 2;
    return [...range(1, leftCount), 'ellipsis', totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    final rightCount = 3 + siblingCount * 2;
    return [1, 'ellipsis', ...range(totalPages - rightCount + 1, totalPages)];
  }

  return [
    1,
    'ellipsis',
    ...range(leftSibling, rightSibling),
    'ellipsis',
    totalPages,
  ];
}

/// Client-side list pagination footer (Vendor Web TablePagination mobile parity).
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
    final safePage = page.clamp(1, totalPages);
    final from = (safePage - 1) * pageSize + 1;
    final to = math.min(safePage * pageSize, total);
    final canPrev = safePage > 1;
    final canNext = safePage < totalPages;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border.withValues(alpha: 0.75))),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _NavButton(
                icon: Icons.chevron_left_rounded,
                tooltip: 'Previous page',
                enabled: canPrev,
                onTap: () => onPageChange(safePage - 1),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      'Page $safePage of $totalPages',
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
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
          if (totalPages > 1) ...[
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (final item in getPaginationItems(safePage, totalPages)) ...[
                    if (item == 'ellipsis')
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text('…', style: TextStyle(color: colors.textMuted)),
                      )
                    else
                      _PageChip(
                        pageNumber: item as int,
                        selected: item == safePage,
                        onTap: () => onPageChange(item),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ],
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
    return IconButton(
      tooltip: tooltip,
      onPressed: enabled ? onTap : null,
      icon: Icon(
        icon,
        color: enabled ? context.appColors.textPrimary : context.appColors.textMuted,
      ),
    );
  }
}

class _PageChip extends StatelessWidget {
  final int pageNumber;
  final bool selected;
  final VoidCallback onTap;

  const _PageChip({
    required this.pageNumber,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Material(
        color: selected ? AppTheme.accent.withValues(alpha: 0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: selected ? AppTheme.accent : colors.border.withValues(alpha: 0.6),
              ),
            ),
            child: Text(
              '$pageNumber',
              style: TextStyle(
                color: selected ? AppTheme.accent : colors.textSecondary,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                fontSize: 12,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
