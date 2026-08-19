import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../core/theme/theme_provider.dart';

class AppearanceSettingsSection extends StatelessWidget {
  const AppearanceSettingsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Appearance',
          style: TextStyle(
            color: colors.textSecondary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.border.withValues(alpha: 0.7)),
          ),
          child: Column(
            children: [
              _ThemeOptionTile(
                icon: Icons.brightness_auto_rounded,
                label: 'System default',
                subtitle: 'Match device light / dark mode',
                selected: themeProvider.preference == ThemePreference.system,
                onTap: () => themeProvider.setPreference(ThemePreference.system),
              ),
              Divider(height: 1, color: colors.border.withValues(alpha: 0.6)),
              _ThemeOptionTile(
                icon: Icons.light_mode_outlined,
                label: 'Light',
                selected: themeProvider.preference == ThemePreference.light,
                onTap: () => themeProvider.setPreference(ThemePreference.light),
              ),
              Divider(height: 1, color: colors.border.withValues(alpha: 0.6)),
              _ThemeOptionTile(
                icon: Icons.dark_mode_outlined,
                label: 'Dark',
                selected: themeProvider.preference == ThemePreference.dark,
                onTap: () => themeProvider.setPreference(ThemePreference.dark),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ThemeOptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  const _ThemeOptionTile({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected ? AppTheme.accent.withValues(alpha: 0.08) : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, color: selected ? AppTheme.accent : colors.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        fontSize: 15,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: TextStyle(color: colors.textMuted, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: selected ? AppTheme.accent : colors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
