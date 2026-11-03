import 'package:flutter/material.dart';

import '../../core/theme.dart';

const _placedAccent = Color(0xFF6C63FF);

ThemeData _placedDatePickerTheme(BuildContext context) {
  final colors = context.appColors;
  final dark = Theme.of(context).brightness == Brightness.dark;
  final rangeFill = dark ? colors.primarySoft : _placedAccent.withValues(alpha: 0.16);
  final scheme = Theme.of(context).colorScheme.copyWith(
    primary: _placedAccent,
    onPrimary: Colors.white,
    secondary: _placedAccent,
    onSecondary: colors.textPrimary,
    secondaryContainer: rangeFill,
    onSecondaryContainer: colors.textPrimary,
  );
  return Theme.of(context).copyWith(
    colorScheme: scheme,
    datePickerTheme: DatePickerThemeData(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: colors.surface,
      headerForegroundColor: colors.textPrimary,
      rangePickerBackgroundColor: colors.surface,
      rangePickerSurfaceTintColor: Colors.transparent,
      rangePickerHeaderBackgroundColor: colors.surface,
      rangePickerHeaderForegroundColor: colors.textPrimary,
      rangeSelectionBackgroundColor: rangeFill,
      weekdayStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.w600),
      dayStyle: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w500),
      dayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) return colors.textMuted.withValues(alpha: 0.4);
        if (states.contains(WidgetState.selected)) return Colors.white;
        return colors.textPrimary;
      }),
      dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return _placedAccent;
        return null;
      }),
      todayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return Colors.white;
        return _placedAccent;
      }),
      todayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return _placedAccent;
        return null;
      }),
      todayBorder: const BorderSide(color: _placedAccent),
      confirmButtonStyle: TextButton.styleFrom(foregroundColor: _placedAccent),
      cancelButtonStyle: TextButton.styleFrom(foregroundColor: colors.textMuted),
    ),
  );
}

const placedPresetOptions = <(String id, String label)>[
  ('any', 'Any time'),
  ('today', 'Today'),
  ('yesterday', 'Yesterday'),
  ('7d', 'Last 7 days'),
  ('30d', 'Last 30 days'),
  ('month', 'This month'),
  ('custom', 'Custom range'),
];

class PlacedOrderRange {
  final String preset;
  final DateTime? fromLocal;
  final DateTime? toLocal;

  const PlacedOrderRange({
    this.preset = 'any',
    this.fromLocal,
    this.toLocal,
  });

  bool get isActive => fromLocal != null || toLocal != null;

  String? get fromUtcIso => fromLocal?.toUtc().toIso8601String();
  String? get toUtcIso => toLocal?.toUtc().toIso8601String();

  String get chipLabel {
    final named = placedPresetOptions
        .where((option) => option.$1 == preset && option.$1 != 'any' && option.$1 != 'custom')
        .map((option) => option.$2);
    if (named.isNotEmpty) return named.first;
    return formatPlacedSummary(fromLocal, toLocal);
  }

  static PlacedOrderRange forPreset(String id) {
    if (id == 'any' || id == 'custom') return PlacedOrderRange(preset: id);
    final now = DateTime.now();
    late DateTime start;
    var end = now;
    if (id == 'yesterday') {
      start = now.subtract(const Duration(days: 1));
      end = start;
    } else if (id == '7d') {
      start = now.subtract(const Duration(days: 6));
    } else if (id == '30d') {
      start = now.subtract(const Duration(days: 29));
    } else if (id == 'month') {
      start = DateTime(now.year, now.month, 1);
    } else {
      start = now;
    }
    return PlacedOrderRange(
      preset: id,
      fromLocal: DateTime(start.year, start.month, start.day),
      toLocal: DateTime(end.year, end.month, end.day, 23, 59),
    );
  }

  PlacedOrderRange withDates(DateTime from, DateTime to, {bool wholeDay = true}) {
    var start = from;
    var end = to;
    if (start.isAfter(end)) {
      final sameDay = start.year == end.year && start.month == end.month && start.day == end.day;
      if (sameDay) {
        end = start;
      } else {
        final swap = start;
        start = end;
        end = swap;
      }
    }
    if (wholeDay) {
      start = DateTime(start.year, start.month, start.day);
      end = DateTime(end.year, end.month, end.day, 23, 59);
    }
    return PlacedOrderRange(preset: 'custom', fromLocal: start, toLocal: end);
  }
}

bool orderMatchesPlacedRange(DateTime? createdUtc, PlacedOrderRange range) {
  if (!range.isActive) return true;
  if (createdUtc == null) return true;
  final created = createdUtc.toUtc();
  final from = range.fromLocal?.toUtc();
  final to = range.toLocal?.toUtc();
  if (from != null && created.isBefore(from)) return false;
  if (to != null && !created.isBefore(to.add(const Duration(minutes: 1)))) return false;
  return true;
}

String formatPlacedSummary(DateTime? from, DateTime? to) {
  if (from == null && to == null) return 'Any time';
  if (from != null && to != null) {
    final whole = _isStartOfDay(from) && _isEndOfDay(to);
    final same = from.year == to.year && from.month == to.month && from.day == to.day;
    if (whole && same) return _formatDay(from);
    if (whole) return '${_formatDay(from)} – ${_formatDay(to)}';
    if (same) return '${_formatDay(from)}, ${_formatClock(from)} – ${_formatClock(to)}';
    return '${_formatDay(from)}, ${_formatClock(from)} – ${_formatDay(to)}, ${_formatClock(to)}';
  }
  if (from != null) return 'From ${_formatDay(from)}';
  return 'Until ${_formatDay(to!)}';
}

bool _isStartOfDay(DateTime value) => value.hour == 0 && value.minute == 0;
bool _isEndOfDay(DateTime value) => value.hour == 23 && value.minute == 59;

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _formatDay(DateTime value) => '${value.day} ${_months[value.month - 1]} ${value.year}';

String _formatClock(DateTime value) {
  final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
  final minute = value.minute.toString().padLeft(2, '0');
  final period = value.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

bool _sameDay(DateTime? from, DateTime? to) {
  if (from == null || to == null) return true;
  return from.year == to.year && from.month == to.month && from.day == to.day;
}

int _minutesOf(DateTime value) => value.hour * 60 + value.minute;

DateTime _atMinutes(DateTime day, int minutes) {
  final clamped = minutes.clamp(0, 23 * 60 + 59);
  return DateTime(day.year, day.month, day.day, clamped ~/ 60, clamped % 60);
}

class PlacedOrderRangeSection extends StatefulWidget {
  final PlacedOrderRange value;
  final ValueChanged<PlacedOrderRange> onChanged;

  const PlacedOrderRangeSection({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  State<PlacedOrderRangeSection> createState() => _PlacedOrderRangeSectionState();
}

class _PlacedOrderRangeSectionState extends State<PlacedOrderRangeSection> {
  late bool _wholeDay;

  @override
  void initState() {
    super.initState();
    _wholeDay = _rangeIsWholeDay(widget.value);
  }

  @override
  void didUpdateWidget(covariant PlacedOrderRangeSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value.preset != 'custom') _wholeDay = true;
  }

  bool _rangeIsWholeDay(PlacedOrderRange range) {
    final from = range.fromLocal;
    final to = range.toLocal;
    if (from == null || to == null) return true;
    return _isStartOfDay(from) && _isEndOfDay(to);
  }

  Future<void> _pickDates() async {
    final now = DateTime.now();
    final initialStart = widget.value.fromLocal ?? now;
    final initialEnd = widget.value.toLocal ?? initialStart;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024, 1, 1),
      lastDate: DateTime(now.year, now.month, now.day),
      initialDateRange: DateTimeRange(
        start: DateTime(initialStart.year, initialStart.month, initialStart.day),
        end: DateTime(initialEnd.year, initialEnd.month, initialEnd.day),
      ),
      helpText: 'Order placed',
      saveText: 'Done',
      builder: (context, child) => Theme(
        data: _placedDatePickerTheme(context),
        child: child!,
      ),
    );
    if (picked == null) return;
    widget.onChanged(widget.value.withDates(picked.start, picked.end, wholeDay: _wholeDay));
  }

  void _setTime({required bool start, required DateTime next}) {
    final from = start ? next : (widget.value.fromLocal ?? next);
    final to = start ? (widget.value.toLocal ?? next) : next;
    widget.onChanged(widget.value.withDates(from, to, wholeDay: false));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final value = widget.value;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'ORDER PLACED',
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final option in placedPresetOptions)
                _PresetChip(
                  label: option.$2,
                  selected: value.preset == option.$1,
                  onTap: () {
                    if (option.$1 == 'custom') {
                      widget.onChanged(PlacedOrderRange(
                        preset: 'custom',
                        fromLocal: value.fromLocal,
                        toLocal: value.toLocal,
                      ));
                      return;
                    }
                    setState(() => _wholeDay = true);
                    widget.onChanged(PlacedOrderRange.forPreset(option.$1));
                  },
                ),
            ],
          ),
          if (value.preset == 'custom') ...[
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _pickDates,
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.textPrimary,
                side: BorderSide(color: colors.border),
                minimumSize: const Size.fromHeight(44),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _RangeSummary(from: value.fromLocal, to: value.toLocal),
            ),
            if (value.fromLocal != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('All day', style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                          Text('12:00 AM – 11:59 PM', style: TextStyle(color: colors.textMuted, fontSize: 11)),
                        ],
                      ),
                    ),
                    Switch(
                      value: _wholeDay,
                      activeThumbColor: _placedAccent,
                      onChanged: (on) {
                        setState(() => _wholeDay = on);
                        final from = value.fromLocal;
                        final to = value.toLocal ?? from;
                        if (from == null || to == null) return;
                        if (on) widget.onChanged(value.withDates(from, to, wholeDay: true));
                      },
                    ),
                  ],
                ),
              ),
            ],
            if (value.fromLocal != null && !_wholeDay) ...[
              const SizedBox(height: 8),
              _PlacedClock(
                label: 'Start',
                time: value.fromLocal!,
                onChanged: (next) => _setTime(start: true, next: next),
              ),
              const SizedBox(height: 8),
              _PlacedClock(
                label: 'End',
                time: value.toLocal ?? value.fromLocal!,
                minMinutes: _sameDay(value.fromLocal, value.toLocal) ? _minutesOf(value.fromLocal!) : null,
                onChanged: (next) => _setTime(start: false, next: next),
              ),
            ],
          ] else if (value.isActive) ...[
            const SizedBox(height: 8),
            Text(
              formatPlacedSummary(value.fromLocal, value.toLocal),
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}

class _RangeSummary extends StatelessWidget {
  final DateTime? from;
  final DateTime? to;

  const _RangeSummary({required this.from, required this.to});

  @override
  Widget build(BuildContext context) {
    const dateStyle = TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.25);
    final timeStyle = TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.25, color: context.appColors.textMuted);
    if (from == null) return const Text('Choose dates', style: dateStyle);
    final end = to ?? from!;
    final whole = _isStartOfDay(from!) && _isEndOfDay(end);
    final dates = _sameDay(from, end) ? _formatDay(from!) : '${_formatDay(from!)} – ${_formatDay(end)}';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(dates, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: dateStyle),
        if (!whole)
          Text(
            '${_formatClock(from!)} – ${_formatClock(end)}',
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: timeStyle,
          ),
      ],
    );
  }
}

class _PresetChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PresetChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? _placedAccent : context.appColors.background,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: selected ? _placedAccent : context.appColors.border),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : context.appColors.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _PlacedClock extends StatelessWidget {
  final String label;
  final DateTime time;
  final int? minMinutes;
  final ValueChanged<DateTime> onChanged;

  const _PlacedClock({
    required this.label,
    required this.time,
    required this.onChanged,
    this.minMinutes,
  });

  bool _blocked(int next) => next < 0 || next > 23 * 60 + 59 || (minMinutes != null && next < minMinutes!);

  void _apply(int next) {
    if (_blocked(next)) return;
    onChanged(_atMinutes(time, next));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final total = _minutesOf(time);
    final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
    final isPm = time.hour >= 12;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _ClockStep(
                      caption: 'Hour',
                      value: '$hour',
                      downEnabled: !_blocked(total - 60),
                      upEnabled: !_blocked(total + 60),
                      onDown: () => _apply(total - 60),
                      onUp: () => _apply(total + 60),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Text(':', style: TextStyle(color: colors.textMuted, fontSize: 18, fontWeight: FontWeight.w700)),
                    ),
                    _ClockStep(
                      caption: 'Minute',
                      value: time.minute.toString().padLeft(2, '0'),
                      downEnabled: !_blocked(total - 1),
                      upEnabled: !_blocked(total + 1),
                      onDown: () => _apply(total - 1),
                      onUp: () => _apply(total + 1),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _PeriodSwitch(
            isPm: isPm,
            amEnabled: !_blocked(isPm ? total - 12 * 60 : total),
            pmEnabled: !_blocked(isPm ? total : total + 12 * 60),
            onAm: () => _apply(isPm ? total - 12 * 60 : total),
            onPm: () => _apply(isPm ? total : total + 12 * 60),
          ),
        ],
      ),
    );
  }
}

class _ClockStep extends StatelessWidget {
  final String caption;
  final String value;
  final bool downEnabled;
  final bool upEnabled;
  final VoidCallback onDown;
  final VoidCallback onUp;

  const _ClockStep({
    required this.caption,
    required this.value,
    required this.downEnabled,
    required this.upEnabled,
    required this.onDown,
    required this.onUp,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _TickButton(icon: Icons.remove, enabled: downEnabled, onTap: onDown),
            SizedBox(
              width: 26,
              child: Text(
                value,
                textAlign: TextAlign.center,
                style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            _TickButton(icon: Icons.add, enabled: upEnabled, onTap: onUp),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          caption.toUpperCase(),
          style: TextStyle(color: colors.textMuted, fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 0.3),
        ),
      ],
    );
  }
}

class _TickButton extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  const _TickButton({required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: enabled ? colors.surface : colors.surface.withValues(alpha: 0.4),
      shape: CircleBorder(side: BorderSide(color: colors.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: enabled ? onTap : null,
        child: SizedBox(
          width: 28,
          height: 28,
          child: Icon(icon, size: 14, color: enabled ? colors.textPrimary : colors.textMuted.withValues(alpha: 0.4)),
        ),
      ),
    );
  }
}

class _PeriodSwitch extends StatelessWidget {
  final bool isPm;
  final bool amEnabled;
  final bool pmEnabled;
  final VoidCallback onAm;
  final VoidCallback onPm;

  const _PeriodSwitch({
    required this.isPm,
    required this.amEnabled,
    required this.pmEnabled,
    required this.onAm,
    required this.onPm,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    Widget period(String label, bool selected, bool enabled, VoidCallback onTap) {
      return InkWell(
        onTap: enabled ? onTap : null,
        child: Container(
          width: 48,
          height: 32,
          alignment: Alignment.center,
          color: selected ? _placedAccent : colors.background,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : colors.textMuted.withValues(alpha: enabled ? 1 : 0.35),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            period('AM', !isPm, amEnabled, onAm),
            Container(height: 1, width: 48, color: colors.border),
            period('PM', isPm, pmEnabled, onPm),
          ],
        ),
      ),
    );
  }
}
