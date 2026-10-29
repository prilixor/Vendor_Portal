import 'package:flutter/material.dart';

/// Semantic colors for Customer Mobile (aligned with Vendor Mobile).
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color border;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color primarySoft;
  final Color success;
  final Color successSoft;
  final Color successBorder;
  final Color warning;
  final Color warningSoft;
  final Color warningBorder;
  final Color info;
  final Color infoSoft;
  final Color infoBorder;
  final Color danger;
  final Color dangerSoft;
  final Color dangerBorder;

  const AppPalette({
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.border,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.primarySoft,
    required this.success,
    required this.successSoft,
    required this.successBorder,
    required this.warning,
    required this.warningSoft,
    required this.warningBorder,
    required this.info,
    required this.infoSoft,
    required this.infoBorder,
    required this.danger,
    required this.dangerSoft,
    required this.dangerBorder,
  });

  static const accentSeed = Color(0xFF6C63FF);
  static const successDark = Color(0xFF34D399);
  static const successLight = Color(0xFF047857);

  static const dark = AppPalette(
    background: Color(0xFF0F172A),
    surface: Color(0xFF1E293B),
    surfaceElevated: Color(0xFF334155),
    border: Color(0xFF334155),
    textPrimary: Color(0xFFF8FAFC),
    textSecondary: Color(0xFFCBD5E1),
    textMuted: Color(0xFF94A3B8),
    accent: accentSeed,
    primarySoft: Color(0xFF312E81),
    success: successDark,
    successSoft: Color(0x2434D399),
    successBorder: Color(0x4734D399),
    warning: Color(0xFFFBBF24),
    warningSoft: Color(0x24FBBF24),
    warningBorder: Color(0x59FBBF24),
    info: Color(0xFF60A5FA),
    infoSoft: Color(0x2460A5FA),
    infoBorder: Color(0x4760A5FA),
    danger: Color(0xFFFB7185),
    dangerSoft: Color(0x24FB7185),
    dangerBorder: Color(0x47FB7185),
  );

  static const light = AppPalette(
    background: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFF1F5F9),
    border: Color(0xFFE2E8F0),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF475569),
    textMuted: Color(0xFF64748B),
    accent: accentSeed,
    primarySoft: Color(0xFFEEF2FF),
    success: successLight,
    successSoft: Color(0xFFD1FAE5),
    successBorder: Color(0xFF6EE7B7),
    warning: Color(0xFFB45309),
    warningSoft: Color(0xFFFEF3C7),
    warningBorder: Color(0xFFFCD34D),
    info: Color(0xFF1D4ED8),
    infoSoft: Color(0xFFDBEAFE),
    infoBorder: Color(0xFF93C5FD),
    danger: Color(0xFFB91C1C),
    dangerSoft: Color(0xFFFEE2E2),
    dangerBorder: Color(0xFFFCA5A5),
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? surface,
    Color? surfaceElevated,
    Color? border,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? accent,
    Color? primarySoft,
    Color? success,
    Color? successSoft,
    Color? successBorder,
    Color? warning,
    Color? warningSoft,
    Color? warningBorder,
    Color? info,
    Color? infoSoft,
    Color? infoBorder,
    Color? danger,
    Color? dangerSoft,
    Color? dangerBorder,
  }) {
    return AppPalette(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      border: border ?? this.border,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      accent: accent ?? this.accent,
      primarySoft: primarySoft ?? this.primarySoft,
      success: success ?? this.success,
      successSoft: successSoft ?? this.successSoft,
      successBorder: successBorder ?? this.successBorder,
      warning: warning ?? this.warning,
      warningSoft: warningSoft ?? this.warningSoft,
      warningBorder: warningBorder ?? this.warningBorder,
      info: info ?? this.info,
      infoSoft: infoSoft ?? this.infoSoft,
      infoBorder: infoBorder ?? this.infoBorder,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      dangerBorder: dangerBorder ?? this.dangerBorder,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      border: Color.lerp(border, other.border, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      successBorder: Color.lerp(successBorder, other.successBorder, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      warningBorder: Color.lerp(warningBorder, other.warningBorder, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoSoft: Color.lerp(infoSoft, other.infoSoft, t)!,
      infoBorder: Color.lerp(infoBorder, other.infoBorder, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      dangerBorder: Color.lerp(dangerBorder, other.dangerBorder, t)!,
    );
  }
}

extension AppPaletteContext on BuildContext {
  AppPalette get appColors => Theme.of(this).extension<AppPalette>() ?? AppPalette.dark;

  bool get isDarkMode => Theme.of(this).brightness == Brightness.dark;
}
