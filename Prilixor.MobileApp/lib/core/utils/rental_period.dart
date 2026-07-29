/// Rental period units. Daily remains supported in API/types/pricing.
/// Toggle UI visibility here when Daily should be shown again.
typedef RentalPeriodUnit = String;

const String rentalUnitDay = 'day';
const String rentalUnitWeek = 'week';
const String rentalUnitMonth = 'month';

/// Units shown in Customer UI. Add [rentalUnitDay] to re-enable Daily.
const List<String> rentalUnitsVisibleInUi = [rentalUnitWeek, rentalUnitMonth];

const String defaultUiRentalUnit = rentalUnitWeek;

class RentalUnitLabels {
  final String singular;
  final String plural;
  final String short;
  final String per;

  const RentalUnitLabels({
    required this.singular,
    required this.plural,
    required this.short,
    required this.per,
  });
}

const Map<String, RentalUnitLabels> rentalUnitLabels = {
  rentalUnitDay: RentalUnitLabels(singular: 'Day', plural: 'Days', short: 'd', per: '/day'),
  rentalUnitWeek: RentalUnitLabels(singular: 'Week', plural: 'Weeks', short: 'w', per: '/week'),
  rentalUnitMonth: RentalUnitLabels(singular: 'Month', plural: 'Months', short: 'mo', per: '/month'),
};

String normalizeRentalUnit(String? unit) {
  final u = (unit ?? rentalUnitDay).toLowerCase();
  if (u == rentalUnitWeek || u == rentalUnitMonth || u == rentalUnitDay) return u;
  return rentalUnitDay;
}

String formatRentalDuration(int count, [String? unit]) {
  final u = normalizeRentalUnit(unit);
  final labels = rentalUnitLabels[u]!;
  final n = count < 0 ? 0 : count;
  return '$n ${n == 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()}';
}

double rateForUnit(
  String unit, {
  double dailyRent = 0,
  double weeklyRent = 0,
  double monthlyRent = 0,
}) {
  final u = normalizeRentalUnit(unit);
  if (u == rentalUnitWeek) return weeklyRent;
  if (u == rentalUnitMonth) return monthlyRent;
  return dailyRent;
}

double estimateRent(
  String unit,
  int periods,
  int quantity, {
  double dailyRent = 0,
  double weeklyRent = 0,
  double monthlyRent = 0,
}) {
  final p = periods < 1 ? 1 : periods;
  final q = quantity < 1 ? 1 : quantity;
  return rateForUnit(
        unit,
        dailyRent: dailyRent,
        weeklyRent: weeklyRent,
        monthlyRent: monthlyRent,
      ) *
      p *
      q;
}

class RentVsBuyCheck {
  final bool shouldForceBuy;
  final double rentalTotal;
  final double buyTotal;
  final String durationLabel;

  const RentVsBuyCheck({
    required this.shouldForceBuy,
    required this.rentalTotal,
    required this.buyTotal,
    required this.durationLabel,
  });
}

/// When renting long enough that rent ≥ buy price, switch order to Buy.
RentVsBuyCheck evaluateRentVsBuy({
  double? buyPrice,
  required int quantity,
  required int periods,
  required String unit,
  double dailyRent = 0,
  double weeklyRent = 0,
  double monthlyRent = 0,
}) {
  final qty = quantity < 1 ? 1 : quantity;
  final p = periods < 1 ? 1 : periods;
  final unitBuy = buyPrice ?? 0;
  final buyTotal = unitBuy > 0 ? unitBuy * qty : 0.0;
  final rentalTotal = estimateRent(
    unit,
    p,
    qty,
    dailyRent: dailyRent,
    weeklyRent: weeklyRent,
    monthlyRent: monthlyRent,
  );
  return RentVsBuyCheck(
    shouldForceBuy: buyTotal > 0 && rentalTotal >= buyTotal,
    rentalTotal: rentalTotal,
    buyTotal: buyTotal,
    durationLabel: formatRentalDuration(p, unit),
  );
}

/// Primary display rate for browse cards (first visible unit with a positive price).
({double value, String unit})? primaryDisplayRate({
  double dailyRent = 0,
  double weeklyRent = 0,
  double monthlyRent = 0,
}) {
  for (final unit in rentalUnitsVisibleInUi) {
    final value = rateForUnit(
      unit,
      dailyRent: dailyRent,
      weeklyRent: weeklyRent,
      monthlyRent: monthlyRent,
    );
    if (value > 0) return (value: value, unit: unit);
  }
  if (dailyRent > 0) return (value: dailyRent, unit: rentalUnitDay);
  return null;
}
