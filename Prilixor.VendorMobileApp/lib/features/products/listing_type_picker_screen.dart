import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'create_listing_screen.dart';

/// Step 1 of add listing — choose Equipment (rent) or Chemical (buy).
class ListingTypePickerScreen extends StatelessWidget {
  /// When opened from Products tab, pre-highlight the matching type.
  final bool? suggestedChemical;

  const ListingTypePickerScreen({super.key, this.suggestedChemical});

  Future<void> _openForm(BuildContext context, {required bool isChemical}) async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => CreateListingScreen(isChemical: isChemical),
      ),
    );
    if (result != null && context.mounted) {
      Navigator.of(context).pop(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add listing')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'What are you listing?',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Choose listing type',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Equipment is rented by day/month. Chemicals are sold by packaging size with buy pricing set by Admin.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          _TypeCard(
            title: 'Equipment',
            subtitle: 'Rent medical devices & durable goods',
            detail: 'Daily / monthly rent · deposit · quantity stock',
            icon: Icons.medical_services_outlined,
            accent: const Color(0xFF60A5FA),
            highlighted: suggestedChemical == false,
            onTap: () => _openForm(context, isChemical: false),
          ),
          const SizedBox(height: 14),
          _TypeCard(
            title: 'Chemical',
            subtitle: 'Sell lab / industrial chemicals',
            detail: 'Per packaging size (1L, 5L…) · buy price · variant stock',
            icon: Icons.science_outlined,
            accent: const Color(0xFF34D399),
            highlighted: suggestedChemical == true,
            onTap: () => _openForm(context, isChemical: true),
          ),
        ],
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String detail;
  final IconData icon;
  final Color accent;
  final bool highlighted;
  final VoidCallback onTap;

  const _TypeCard({
    required this.title,
    required this.subtitle,
    required this.detail,
    required this.icon,
    required this.accent,
    required this.highlighted,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.card(context),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: highlighted
                  ? accent.withValues(alpha: 0.65)
                  : Colors.white.withValues(alpha: 0.08),
              width: highlighted ? 1.5 : 1,
            ),
            gradient: highlighted
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      accent.withValues(alpha: 0.12),
                      AppTheme.card(context),
                    ],
                  )
                : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: accent, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (highlighted) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: accent.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Suggested',
                              style: TextStyle(
                                color: accent,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      detail,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.48),
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 16,
                color: Colors.white.withValues(alpha: 0.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
