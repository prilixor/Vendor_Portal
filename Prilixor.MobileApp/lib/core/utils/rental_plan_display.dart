import '../models/rental_pricing_plan_model.dart';

/// Display helpers mirroring web `rentalDurationIcons` + `RentalPeriodPlanDropdown`.

String dayPlanTitle(int durationDays, [String? fallbackLabel]) {
  if (durationDays > 0) return '$durationDays-Day Plan';
  final fallback = fallbackLabel?.trim() ?? '';
  return fallback.isEmpty ? 'Rental plan' : fallback;
}

String formatBillingCycles(double cycles) {
  if (!(cycles > 0)) return '';
  final text = cycles == cycles.roundToDouble()
      ? cycles.toInt().toString()
      : cycles.toString();
  return cycles == 1 ? '$text Billing Cycle' : '$text Billing Cycles';
}

double planBillingCycles(RentalPricingPlanModel plan) {
  if (plan.billingCycles > 0) return plan.billingCycles;
  if (plan.durationDays > 0) {
    return (plan.durationDays / 28 * 100).round() / 100;
  }
  return 0;
}

double planSavings(RentalPricingPlanModel plan) {
  final s = plan.normalPrice - plan.finalRentalPrice;
  return s > 0 ? s : 0;
}

int planDiscountPercent(RentalPricingPlanModel plan) {
  final normal = plan.normalPrice;
  final finalPrice = plan.finalRentalPrice;
  if (!(normal > 0) || finalPrice >= normal) return 0;
  if (plan.discountType == 'percentage' && plan.discountValue > 0) {
    final pct = plan.discountValue.round();
    return pct > 100 ? 100 : pct;
  }
  final pct = (((normal - finalPrice) / normal) * 100).round();
  return pct > 100 ? 100 : pct;
}

int? planPerDay(RentalPricingPlanModel plan) {
  if (!(plan.durationDays > 0) || !(plan.finalRentalPrice > 0)) return null;
  return (plan.finalRentalPrice / plan.durationDays).round();
}

String planMetaLine(RentalPricingPlanModel plan) {
  final parts = <String>['${plan.durationDays} days'];
  final perDay = planPerDay(plan);
  if (perDay != null) parts.add('₹$perDay/day');
  final cycles = formatBillingCycles(planBillingCycles(plan));
  if (cycles.isNotEmpty) parts.add(cycles);
  return parts.join(' · ');
}

String rentalValueTierLabel(String? tier) {
  final key = (tier ?? '').toLowerCase().replaceAll('-', '_');
  switch (key) {
    case 'better':
      return 'Better';
    case 'best_value':
      return 'Best Value';
    case 'maximum_savings':
      return 'Maximum Savings';
    case 'good':
    default:
      return 'Good';
  }
}

/// Sort like web: Most Popular first, then longest → shortest.
List<RentalPricingPlanModel> sortActiveRentalPlans(Iterable<RentalPricingPlanModel> plans) {
  final list = plans.where((p) => p.isActive && p.durationDays > 0).toList();
  list.sort((a, b) {
    if (a.isRecommended != b.isRecommended) return a.isRecommended ? -1 : 1;
    final byDays = b.durationDays.compareTo(a.durationDays);
    if (byDays != 0) return byDays;
    return a.sortOrder.compareTo(b.sortOrder);
  });
  return list;
}

String? bestSavingsPlanId(Iterable<RentalPricingPlanModel> plans) {
  var bestId = '';
  var bestPct = -1;
  for (final plan in plans) {
    final pct = planDiscountPercent(plan);
    if (pct > bestPct) {
      bestPct = pct;
      bestId = plan.id;
    }
  }
  return bestPct > 0 ? bestId : null;
}
