import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/providers/favorite_provider.dart';
import '../../core/providers/cart_provider.dart';
import '../../core/models/cart_model.dart';
import '../../core/models/product_model.dart';
import '../../core/models/product_detail_model.dart';
import '../../core/models/product_variant_model.dart';
import '../../core/models/rental_pricing_plan_model.dart';
import '../../core/utils/media_url.dart';
import '../../core/utils/rental_period.dart';
import '../../core/utils/rental_plan_display.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../../shared/widgets/browse_product_card.dart';
import '../../shared/widgets/catalog_image.dart';
import '../../shared/widgets/required_field_ux.dart';
import '../../shared/widgets/rent_exceeds_buy_dialog.dart';
import '../../shared/widgets/struck_price.dart';
import '../../shared/utils/require_auth.dart';
import '../dashboard/customer_dashboard.dart';
import 'product_image_viewer_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String listingId;

  const ProductDetailScreen({super.key, required this.listingId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;
  String _orderType = 'rent';
  int _periodCount = 1;
  String _periodUnit = defaultUiRentalUnit;
  String? _selectedVariantId;
  String? _selectedPlanId;
  bool _orderTypeInitialized = false;
  int _imageIndex = 0;
  final PageController _imagePageController = PageController();
  List<ProductModel> _relatedProducts = [];
  ProductDetailModel? _localDetail;
  bool _loadingDetail = true;
  String? _detailError;

  @override
  void dispose() {
    _imagePageController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchData();
    });
  }

  @override
  void didUpdateWidget(covariant ProductDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.listingId != widget.listingId) {
      _orderTypeInitialized = false;
      _imageIndex = 0;
      _selectedVariantId = null;
      _selectedPlanId = null;
      _relatedProducts = [];
      _localDetail = null;
      _loadingDetail = true;
      _detailError = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _fetchData();
      });
    }
  }

  void _fetchData() {
    final checkout = Provider.of<CheckoutProvider>(context, listen: false);
    setState(() {
      _loadingDetail = true;
      _detailError = null;
    });
    checkout.fetchProductDetailModel(widget.listingId).then((detail) {
      if (!mounted) return;
      setState(() {
        _localDetail = detail;
        _loadingDetail = false;
        if (detail == null) {
          _detailError = checkout.errorMessage ?? 'Product not found.';
        }
      });
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isAuthenticated) {
      Provider.of<FavoriteProvider>(context, listen: false).fetchFavorites();
    }
    checkout.fetchRelatedProducts(widget.listingId, limit: 6).then((related) {
      if (mounted) {
        setState(() => _relatedProducts = related);
      }
    });
  }

  void _syncOrderTypeFromDetail(ProductDetailModel detail) {
    if (_orderTypeInitialized) return;
    _orderTypeInitialized = true;

    if (detail.canBuy && !detail.canRent) {
      // Buy-only product → buy mode
      _orderType = 'buy';
    } else if (detail.canRent && !detail.canBuy) {
      // Rent-only product → rent mode
      _orderType = 'rent';
    } else if (detail.canRent && detail.canBuy && !detail.hasActiveRentalPlans) {
      // Can both rent and buy, but NO rental plans configured → default to buy
      // so the Add to Cart button is immediately enabled.
      _orderType = 'buy';
    }
    // else: both rent+buy with plans → keep default 'rent' (user selects plan)

    if (detail.activeVariants.isNotEmpty && _selectedVariantId == null) {
      _selectedVariantId = detail.activeVariants.first.id;
    }
    if (detail.hasActiveRentalPlans && _selectedPlanId == null) {
      // Auto-select the recommended/default plan so the button is immediately enabled
      _selectedPlanId = detail.defaultRentalPlan?.id ??
          (detail.activeRentalPlans.isNotEmpty ? detail.activeRentalPlans.first.id : null);
    }
  }

  String? _planIconUrl(RentalPricingPlanModel plan) {
    return resolveRentalIconUrlFromPlan(
      iconUrl: plan.iconUrl,
      iconThumbnailUrl: plan.iconThumbnailUrl,
    );
  }

  /// Match web [RentalPeriodPlanDropdown] legend + trigger icon chips.
  Widget? _planIconAvatar(RentalPricingPlanModel? plan, {double size = 40}) {
    final url = plan == null ? null : _planIconUrl(plan);
    if (url == null || url.isEmpty) return null;
    final colors = context.appColors;
    final iconSize = size * 0.72;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.surfaceElevated,
        border: Border.all(color: colors.border),
      ),
      alignment: Alignment.center,
      child: CatalogImage(
        key: ValueKey(url),
        url: url,
        width: iconSize,
        height: iconSize,
        fit: BoxFit.contain,
      ),
    );
  }

  Widget _mostPopularBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 11, color: Colors.white),
          SizedBox(width: 3),
          Text(
            'MOST POPULAR',
            style: TextStyle(
              color: Colors.white,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bestDealBadge() {
    final isDark = context.isDarkMode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
            : const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark
              ? const Color(0xFFF59E0B).withValues(alpha: 0.35)
              : const Color(0xFFFCD34D),
        ),
      ),
      child: Text(
        'BEST DEAL',
        style: TextStyle(
          color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _pctOffBadge(int pct) {
    final isDark = context.isDarkMode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF10B981).withValues(alpha: 0.14)
            : const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark
              ? const Color(0xFF10B981).withValues(alpha: 0.3)
              : const Color(0xFF86EFAC),
        ),
      ),
      child: Text(
        '$pct% OFF',
        style: TextStyle(
          color: isDark ? const Color(0xFF34D399) : const Color(0xFF15803D),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _saveAmountLabel(double amount) {
    final isDark = context.isDarkMode;
    final color = isDark ? const Color(0xFF34D399) : const Color(0xFF15803D);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.local_offer_outlined, size: 12, color: color),
        const SizedBox(width: 3),
        Text(
          'Save ${formatPlanInr(amount)}',
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
  List<({String tier, String label, String url})> _tierLegend(List<RentalPricingPlanModel> plans) {
    const order = ['good', 'better', 'best_value', 'maximum_savings'];
    final byTier = <String, ({String label, String url})>{};
    for (final plan in plans) {
      final tier = (plan.valueTier ?? '').toLowerCase().replaceAll('-', '_');
      final url = _planIconUrl(plan);
      if (tier.isEmpty || url == null || url.isEmpty || byTier.containsKey(tier)) continue;
      byTier[tier] = (label: rentalValueTierLabel(tier), url: url);
    }
    return [
      for (final t in order)
        if (byTier[t] != null) (tier: t, label: byTier[t]!.label, url: byTier[t]!.url),
    ];
  }

  RentalPricingPlanModel? _selectedPlan(ProductDetailModel detail) {
    if (!detail.hasActiveRentalPlans) return null;
    final plans = detail.activeRentalPlans;
    for (final p in plans) {
      if (p.id == _selectedPlanId) return p;
    }
    return detail.defaultRentalPlan;
  }

  @override
  Widget build(BuildContext context) {
    final favoriteProvider = Provider.of<FavoriteProvider>(context);
    final detail = _localDetail;
    final isFavorite = favoriteProvider.isFavorite(widget.listingId);

    if (detail != null && !_orderTypeInitialized) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _orderTypeInitialized) return;
        setState(() => _syncOrderTypeFromDetail(detail));
      });
    }

    final activeVariants = detail?.activeVariants ?? [];
    ProductVariantModel? selectedVariant;
    for (final v in activeVariants) {
      if (v.id == _selectedVariantId) {
        selectedVariant = v;
        break;
      }
    }
    final currentQty = detail == null
        ? 0
        : detail.availableForVariant(_selectedVariantId);
    final actualOrderType = detail == null
        ? _orderType
        : (detail.canRent && detail.canBuy
            ? _orderType
            : (detail.canBuy ? 'buy' : 'rent'));
    final unitBuyPrice = selectedVariant?.buyPrice ?? detail?.buyPrice ?? 0;
    final rentRatesDaily = detail?.dailyRent ?? 0;
    final rentRatesWeekly = detail?.weeklyRent ?? 0;
    final rentRatesMonthly = detail?.monthlyRent ?? 0;
    final selectedPlan = detail == null ? null : _selectedPlan(detail);
    final estimate = actualOrderType == 'buy'
        ? unitBuyPrice * _quantity
        : (selectedPlan != null
            ? selectedPlan.finalRentalPrice * _quantity
            : estimateRent(
                _periodUnit,
                _periodCount,
                _quantity,
                dailyRent: rentRatesDaily,
                weeklyRent: rentRatesWeekly,
                monthlyRent: rentRatesMonthly,
              ));
    final badge = detail?.getAvailabilityBadge(qtyOverride: currentQty);
    final canAdd = detail != null && currentQty > 0;
    final cannotFulfill = selectedVariant != null && _quantity > currentQty;
    final List<ProductVariantModel> altVariants = [];
    if (selectedVariant != null && detail != null) {
      final d = detail;
      final sel = selectedVariant;
      altVariants.addAll(
        activeVariants.where((v) => v.id != sel.id && d.variantStockOf(v.id) > 0),
      );
      altVariants.sort((a, b) {
        final aFits = d.variantStockOf(a.id) >= _quantity ? 0 : 1;
        final bFits = d.variantStockOf(b.id) >= _quantity ? 0 : 1;
        if (aFits != bFits) return aFits - bFits;
        return d.variantStockOf(b.id) - d.variantStockOf(a.id);
      });
    }

    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        title: Text(
          detail?.title ?? 'Product',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: colors.textPrimary, size: 20),
          onPressed: () => Navigator.maybePop(context),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Material(
              color: colors.textPrimary.withValues(alpha: 0.1),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () async {
                  final ok = await ensureAuthenticated(
                    context,
                    message: 'Sign in to save favorites.',
                  );
                  if (!ok || !context.mounted) return;
                  await favoriteProvider.toggleFavorite(widget.listingId);
                },
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(
                    isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    color: isFavorite ? Colors.redAccent : colors.textSecondary,
                    size: 20,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: _loadingDetail && detail == null
          ? const BrandPageLoader()
          : _detailError != null
              ? Center(child: Text(_detailError!, style: const TextStyle(color: Colors.redAccent)))
              : detail == null
                  ? Center(child: Text('Product not found.', style: TextStyle(color: colors.textPrimary)))
                  : SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                            child: Column(
                              children: [
                                Container(
                                  height: 280,
                                  width: double.infinity,
                                  decoration: BoxDecoration(
                                    color: colors.surface,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: colors.border),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      detail.imageUrls.isEmpty
                                          ? const Center(
                                              child: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.image_not_supported_outlined, color: Colors.white24, size: 44),
                                                  SizedBox(height: 8),
                                                  Text(
                                                    'No product image',
                                                    style: TextStyle(color: Colors.white38, fontSize: 13),
                                                  ),
                                                ],
                                              ),
                                            )
                                          : GestureDetector(
                                              onTap: () {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (_) => ProductImageViewerScreen(
                                                      imageUrls: detail.imageUrls,
                                                      initialIndex: _imageIndex,
                                                      title: detail.title,
                                                    ),
                                                  ),
                                                );
                                              },
                                              child: PageView.builder(
                                                controller: _imagePageController,
                                                itemCount: detail.imageUrls.length,
                                                onPageChanged: (i) => setState(() => _imageIndex = i),
                                                itemBuilder: (_, i) => Padding(
                                                  padding: const EdgeInsets.all(16),
                                                  child: CatalogImage(
                                                    url: detail.imageUrls[i],
                                                    fit: BoxFit.contain,
                                                  ),
                                                ),
                                              ),
                                            ),
                                      if (detail.imageUrls.isNotEmpty)
                                        Positioned(
                                          right: 12,
                                          bottom: detail.imageUrls.length > 1 ? 28 : 12,
                                          child: IgnorePointer(
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withValues(alpha: 0.55),
                                                borderRadius: BorderRadius.circular(999),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.zoom_in_rounded, color: Colors.white, size: 14),
                                                  SizedBox(width: 4),
                                                  const Text(
                                                    'View & zoom',
                                                    style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      if (detail.imageUrls.length > 1)
                                        Positioned(
                                          left: 0,
                                          right: 0,
                                          bottom: 12,
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: List.generate(detail.imageUrls.length, (i) {
                                              final selected = i == _imageIndex;
                                              return AnimatedContainer(
                                                duration: const Duration(milliseconds: 180),
                                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                                width: selected ? 18 : 6,
                                                height: 6,
                                                decoration: BoxDecoration(
                                                  color: selected ? const Color(0xFF6C63FF) : colors.border,
                                                  borderRadius: BorderRadius.circular(999),
                                                ),
                                              );
                                            }),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (detail.imageUrls.length > 1)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: SizedBox(
                                      height: 68,
                                      child: ListView.separated(
                                        scrollDirection: Axis.horizontal,
                                        itemCount: detail.imageUrls.length,
                                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                                        itemBuilder: (_, i) {
                                          final selected = i == _imageIndex;
                                          return GestureDetector(
                                            onTap: () {
                                              setState(() => _imageIndex = i);
                                              _imagePageController.animateToPage(
                                                i,
                                                duration: const Duration(milliseconds: 220),
                                                curve: Curves.easeOut,
                                              );
                                            },
                                            child: AnimatedContainer(
                                              duration: const Duration(milliseconds: 180),
                                              width: 68,
                                              decoration: BoxDecoration(
                                                borderRadius: BorderRadius.circular(12),
                                                border: Border.all(
                                                  color: selected ? const Color(0xFF6C63FF) : colors.border,
                                                  width: selected ? 2 : 1,
                                                ),
                                                color: colors.surface,
                                              ),
                                              clipBehavior: Clip.antiAlias,
                                              child: Padding(
                                                padding: const EdgeInsets.all(6),
                                                child: CatalogImage(url: detail.imageUrls[i], fit: BoxFit.contain),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(20.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        detail.title,
                                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: colors.textPrimary),
                                      ),
                                    ),
                                    if (detail.isChemical)
                                      Container(
                                        margin: const EdgeInsets.only(left: 8),
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: context.isDarkMode
                                              ? const Color(0xFF38BDF8).withValues(alpha: 0.15)
                                              : const Color(0xFFE0F2FE),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: context.isDarkMode
                                                ? const Color(0xFF38BDF8).withValues(alpha: 0.35)
                                                : const Color(0xFFBAE6FD),
                                          ),
                                        ),
                                        child: Text(
                                          'Chemical',
                                          style: TextStyle(
                                            color: context.isDarkMode
                                                ? const Color(0xFF38BDF8)
                                                : const Color(0xFF0369A1),
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                if (badge != null && badge['label'] != 'Available') ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Color(badge['color']),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      badge['label'],
                                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                ] else
                                  const SizedBox(height: 16),
                                // Pricing / packaging sizes
                                _sectionCard(
                                  title: 'Pricing',
                                  child: activeVariants.isNotEmpty
                                      ? Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text('Available Packaging Sizes', style: TextStyle(color: colors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
                                            const SizedBox(height: 10),
                                            Wrap(
                                              spacing: 8,
                                              runSpacing: 8,
                                              children: activeVariants.map((v) {
                                                final stock = detail.variantStockOf(v.id);
                                                final selected = v.id == _selectedVariantId;
                                                final out = stock <= 0;
                                                return GestureDetector(
                                                  onTap: () => setState(() => _selectedVariantId = v.id),
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                                    decoration: BoxDecoration(
                                                      color: selected ? const Color(0xFF6C63FF) : colors.surfaceElevated,
                                                      borderRadius: BorderRadius.circular(10),
                                                      border: Border.all(
                                                        color: selected
                                                            ? const Color(0xFF6C63FF)
                                                            : colors.border,
                                                        style: out ? BorderStyle.solid : BorderStyle.solid,
                                                      ),
                                                    ),
                                                    child: Column(
                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                      children: [
                                                        Text(v.sizeLabel, style: TextStyle(color: selected ? Colors.white : colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
                                                        Text(
                                                          out ? 'Out of stock' : '$stock in stock',
                                                          style: TextStyle(
                                                            color: selected
                                                                ? Colors.white70
                                                                : (out ? Colors.redAccent : colors.textMuted),
                                                            fontSize: 11,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                );
                                              }).toList(),
                                            ),
                                            const SizedBox(height: 12),
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  'Price (${selectedVariant?.sizeLabel ?? ''})',
                                                  style: TextStyle(color: colors.textSecondary),
                                                ),
                                                Text(
                                                  formatPlanInr(selectedVariant?.buyPrice ?? 0),
                                                  style: const TextStyle(color: Color(0xFF34D399), fontSize: 18, fontWeight: FontWeight.bold),
                                                ),
                                              ],
                                            ),
                                            if (cannotFulfill) ...[
                                              const SizedBox(height: 12),
                                              Container(
                                                width: double.infinity,
                                                padding: const EdgeInsets.all(12),
                                                decoration: BoxDecoration(
                                                  color: Colors.amber.withValues(alpha: 0.12),
                                                  borderRadius: BorderRadius.circular(10),
                                                  border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      '${selectedVariant.sizeLabel} \u00d7 $_quantity isn\'t available${currentQty > 0 ? ' (only $currentQty in stock)' : ' (out of stock)'}.',
                                                      style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.w600, fontSize: 12),
                                                    ),
                                                    if (altVariants.isNotEmpty) ...[
                                                      const SizedBox(height: 8),
                                                      const Text('Try another packaging size:', style: TextStyle(color: Colors.amber, fontSize: 12)),
                                                      const SizedBox(height: 6),
                                                      Wrap(
                                                        spacing: 6,
                                                        runSpacing: 6,
                                                        children: altVariants.map((v) {
                                                          final stock = detail.variantStockOf(v.id);
                                                          return ActionChip(
                                                            label: Text('${v.sizeLabel} · ${formatPlanInr(v.buyPrice)} · $stock'),
                                                            onPressed: () => setState(() => _selectedVariantId = v.id),
                                                            backgroundColor: Colors.amber.withValues(alpha: 0.15),
                                                            labelStyle: const TextStyle(color: Colors.amber, fontSize: 11),
                                                          );
                                                        }).toList(),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ],
                                        )
                                      : Column(
                                          children: [
                                            // Web compact strip: deposit + buy only (plans pick the rent price).
                                            if (detail.canRent)
                                              _priceRow(
                                                'Security deposit',
                                                formatPlanInr(detail.securityDeposit),
                                              ),
                                            if (detail.canBuy)
                                              _priceRow(
                                                'Buy price',
                                                '${formatPlanInr(detail.buyPrice ?? 0)}${detail.baseUnit != null ? ' / ${detail.baseUnit}' : ' / Unit'}',
                                                highlight: true,
                                              ),
                                          ],
                                        ),
                                ),

                                if (detail.prescriptionRequired) ...[
                                  const SizedBox(height: 12),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: context.isDarkMode
                                          ? Colors.amber.withValues(alpha: 0.1)
                                          : const Color(0xFFFFFBEB),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: context.isDarkMode
                                            ? Colors.amber.withValues(alpha: 0.35)
                                            : const Color(0xFFFDE68A),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.medical_information,
                                          color: context.isDarkMode ? Colors.amber : const Color(0xFFD97706),
                                          size: 18,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            'Doctor Unique ID can be added optionally at checkout.',
                                            style: TextStyle(
                                              color: context.isDarkMode ? Colors.amber : const Color(0xFF92400E),
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],

                                if (detail.hasChemSpecs) ...[
                                  const SizedBox(height: 16),
                                  _sectionCard(
                                    title: 'Chemical Specifications',
                                    child: Wrap(
                                      spacing: 16,
                                      runSpacing: 12,
                                      children: [
                                        if (detail.casNumber != null) _specItem('CAS Number', detail.casNumber!),
                                        if (detail.chemicalFormula != null) _specItem('Formula', detail.chemicalFormula!),
                                        if (detail.purityPercentage != null)
                                          _specItem('Purity', '${detail.purityPercentage}%'),
                                        if (detail.molecularWeight != null)
                                          _specItem('Molecular Weight', '${detail.molecularWeight} g/mol'),
                                      ],
                                    ),
                                  ),
                                ],

                                const SizedBox(height: 16),
                                Text('Description', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary)),
                                const SizedBox(height: 8),
                                Text(
                                  detail.description.isNotEmpty
                                      ? detail.description
                                      : 'No description provided for this product.',
                                  style: TextStyle(color: colors.textSecondary, fontSize: 15, height: 1.5),
                                ),

                                if (detail.documents.isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  _documentsInline(detail.documents),
                                ],

                                const SizedBox(height: 24),
                                Text('Order Options', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary)),
                                const SizedBox(height: 8),
                                const RequiredFieldsNote(padding: EdgeInsets.only(bottom: 12)),

                                if (detail.canRent && detail.canBuy)
                                  Row(
                                    children: [
                                      Expanded(child: _buildTypeOption('rent', 'Rent')),
                                      const SizedBox(width: 12),
                                      Expanded(child: _buildTypeOption('buy', 'Buy')),
                                    ],
                                  )
                                else
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF6C63FF).withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: const Color(0xFF6C63FF)),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      actualOrderType == 'buy' ? 'Buy only' : 'Rent only',
                                      style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.bold),
                                    ),
                                  ),

                                if (actualOrderType == 'rent') ...[
                                  const SizedBox(height: 16),
                                  if (detail.hasActiveRentalPlans) ...[
                                    Builder(
                                      builder: (context) {
                                        final colors = context.appColors;
                                        final plans = detail.activeRentalPlans;
                                        final bestId = bestSavingsPlanId(plans);
                                        final selectedSavings =
                                            selectedPlan == null ? 0.0 : planSavings(selectedPlan);
                                        final selectedPct =
                                            selectedPlan == null ? 0 : planDiscountPercent(selectedPlan);
                                        final selectedIsBestDeal = selectedPlan != null &&
                                            bestId == selectedPlan.id &&
                                            selectedPct > 0;
                                        final legend = _tierLegend(plans);

                                        final isDark = context.isDarkMode;
                                        final recommended = selectedPlan?.isRecommended == true;
                                        final borderColor = recommended
                                            ? const Color(0xFF3B82F6)
                                            : (isDark ? colors.border : const Color(0xFFE5E7EB));
                                        final priceColor = recommended
                                            ? (isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB))
                                            : colors.textPrimary;
                                        final cardBg = recommended
                                            ? (isDark ? const Color(0xFF1E3A5F).withValues(alpha: 0.35) : const Color(0xFFEFF6FF))
                                            : colors.surface;

                                        return Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            RequiredLabel(
                                              'Rental period',
                                              required: true,
                                              style: TextStyle(
                                                color: colors.textPrimary,
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            const Text(
                                              'More days, more savings',
                                              style: TextStyle(
                                                color: Color(0xFFA78BFA),
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            if (legend.isNotEmpty) ...[
                                              const SizedBox(height: 8),
                                              SingleChildScrollView(
                                                scrollDirection: Axis.horizontal,
                                                child: Row(
                                                  children: [
                                                    for (var i = 0; i < legend.length; i++) ...[
                                                      if (i > 0) const SizedBox(width: 6),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 5,
                                                        ),
                                                        decoration: BoxDecoration(
                                                          color: colors.surfaceElevated,
                                                          borderRadius: BorderRadius.circular(999),
                                                          border: Border.all(color: colors.border),
                                                        ),
                                                        child: Row(
                                                          mainAxisSize: MainAxisSize.min,
                                                          children: [
                                                            CatalogImage(
                                                              url: legend[i].url,
                                                              width: 18,
                                                              height: 18,
                                                              fit: BoxFit.contain,
                                                            ),
                                                            const SizedBox(width: 5),
                                                            Text(
                                                              legend[i].label,
                                                              style: TextStyle(
                                                                color: colors.textSecondary,
                                                                fontSize: 11,
                                                                fontWeight: FontWeight.w600,
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              ),
                                            ],
                                            const SizedBox(height: 10),
                                            InkWell(
                                              onTap: () => _openRentalPeriodSheet(
                                                detail: detail,
                                                unitBuyPrice: unitBuyPrice,
                                              ),
                                              borderRadius: BorderRadius.circular(16),
                                              child: Container(
                                                width: double.infinity,
                                                padding: const EdgeInsets.all(14),
                                                decoration: BoxDecoration(
                                                  color: cardBg,
                                                  borderRadius: BorderRadius.circular(16),
                                                  border: Border.all(color: borderColor, width: 1.5),
                                                ),
                                                child: Row(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Wrap(
                                                            crossAxisAlignment: WrapCrossAlignment.center,
                                                            spacing: 6,
                                                            runSpacing: 4,
                                                            children: [
                                                              Text(
                                                                selectedPlan == null
                                                                    ? 'Choose a rental plan'
                                                                    : dayPlanTitle(
                                                                        selectedPlan.durationDays,
                                                                        selectedPlan.durationLabel,
                                                                      ),
                                                                style: TextStyle(
                                                                  color: colors.textPrimary,
                                                                  fontWeight: FontWeight.w800,
                                                                  fontSize: 15,
                                                                ),
                                                              ),
                                                              if (recommended) _mostPopularBadge(),
                                                              if (selectedIsBestDeal) _bestDealBadge(),
                                                            ],
                                                          ),
                                                          if (selectedPlan != null) ...[
                                                            const SizedBox(height: 4),
                                                            Text(
                                                              planTriggerMetaLine(selectedPlan),
                                                              style: TextStyle(
                                                                color: colors.textMuted,
                                                                fontSize: 12,
                                                                fontWeight: FontWeight.w500,
                                                              ),
                                                            ),
                                                            if (selectedPct > 0 || selectedSavings > 0) ...[
                                                              const SizedBox(height: 8),
                                                              Wrap(
                                                                crossAxisAlignment: WrapCrossAlignment.center,
                                                                spacing: 8,
                                                                runSpacing: 4,
                                                                children: [
                                                                  if (selectedPct > 0) _pctOffBadge(selectedPct),
                                                                  if (selectedSavings > 0)
                                                                    _saveAmountLabel(selectedSavings),
                                                                ],
                                                              ),
                                                            ],
                                                          ],
                                                        ],
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                      children: [
                                                        Column(
                                                          crossAxisAlignment: CrossAxisAlignment.end,
                                                          children: [
                                                            Text(
                                                              selectedPlan != null
                                                                  ? formatPlanInr(selectedPlan.finalRentalPrice)
                                                                  : '\u2014',
                                                              style: TextStyle(
                                                                color: priceColor,
                                                                fontWeight: FontWeight.w800,
                                                                fontSize: 18,
                                                                height: 1.1,
                                                              ),
                                                            ),
                                                            if (selectedSavings > 0) ...[
                                                              const SizedBox(height: 4),
                                                              StruckPrice(
                                                                formatPlanInr(selectedPlan!.normalPrice),
                                                                style: const TextStyle(
                                                                  fontSize: 12,
                                                                  fontWeight: FontWeight.w600,
                                                                ),
                                                              ),
                                                            ],
                                                          ],
                                                        ),
                                                        if (_planIconAvatar(selectedPlan, size: 48)
                                                            case final icon?) ...[
                                                          const SizedBox(width: 8),
                                                          icon,
                                                        ],
                                                        const SizedBox(width: 2),
                                                        Padding(
                                                          padding: const EdgeInsets.only(top: 2),
                                                          child: Icon(
                                                            Icons.keyboard_arrow_down_rounded,
                                                            color: colors.textMuted,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            const Row(
                                              children: [
                                                Icon(Icons.local_shipping_outlined,
                                                    size: 14, color: Color(0xFFA78BFA)),
                                                SizedBox(width: 6),
                                                Text(
                                                  'Starts when the order is delivered',
                                                  style: TextStyle(
                                                    color: Color(0xFFA78BFA),
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            if (selectedPlan != null) ...[
                                              const SizedBox(height: 12),
                                              Container(
                                                width: double.infinity,
                                                decoration: BoxDecoration(
                                                  color: colors.surfaceElevated,
                                                  borderRadius: BorderRadius.circular(16),
                                                  border: Border.all(color: colors.border),
                                                ),
                                                child: Column(
                                                  children: [
                                                    Padding(
                                                      padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
                                                      child: Row(
                                                        children: [
                                                          Expanded(
                                                            child: Column(
                                                              crossAxisAlignment: CrossAxisAlignment.start,
                                                              children: [
                                                                RequiredLabel(
                                                                  'Quantity',
                                                                  required: true,
                                                                  style: TextStyle(
                                                                    color: colors.textPrimary,
                                                                    fontSize: 14,
                                                                    fontWeight: FontWeight.w800,
                                                                  ),
                                                                ),
                                                                const SizedBox(height: 2),
                                                                Text(
                                                                  _availableStockCaption(
                                                                    currentQty: currentQty,
                                                                    selectedVariant: selectedVariant,
                                                                    isChemical: detail.isChemical,
                                                                  ),
                                                                  style: TextStyle(
                                                                    color: colors.textMuted,
                                                                    fontSize: 12,
                                                                    fontWeight: FontWeight.w500,
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                          Row(
                                                            children: [
                                                              IconButton(
                                                                icon: Icon(
                                                                  Icons.remove_circle_outline,
                                                                  color: _quantity > 1
                                                                      ? colors.textPrimary
                                                                      : colors.textMuted,
                                                                ),
                                                                onPressed: _quantity > 1
                                                                    ? () async {
                                                                        final next = _quantity - 1;
                                                                        final blocked =
                                                                            await _promptRentToBuyIfNeeded(
                                                                          detail: detail,
                                                                          unitBuyPrice: unitBuyPrice,
                                                                          nextQty: next,
                                                                        );
                                                                        if (blocked || !mounted) return;
                                                                        setState(() => _quantity = next);
                                                                      }
                                                                    : null,
                                                              ),
                                                              Text(
                                                                '$_quantity',
                                                                style: TextStyle(
                                                                  color: colors.textPrimary,
                                                                  fontSize: 16,
                                                                  fontWeight: FontWeight.bold,
                                                                ),
                                                              ),
                                                              IconButton(
                                                                icon: Icon(
                                                                  Icons.add_circle_outline,
                                                                  color: _quantity <
                                                                          (currentQty > 0 ? currentQty : 1)
                                                                      ? colors.textPrimary
                                                                      : colors.textMuted,
                                                                ),
                                                                onPressed: _quantity <
                                                                        (currentQty > 0 ? currentQty : 1)
                                                                    ? () async {
                                                                        final next = _quantity + 1;
                                                                        final blocked =
                                                                            await _promptRentToBuyIfNeeded(
                                                                          detail: detail,
                                                                          unitBuyPrice: unitBuyPrice,
                                                                          nextQty: next,
                                                                        );
                                                                        if (blocked || !mounted) return;
                                                                        setState(() => _quantity = next);
                                                                      }
                                                                    : null,
                                                              ),
                                                            ],
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    Container(
                                                      width: double.infinity,
                                                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                                                      decoration: BoxDecoration(
                                                        color: colors.background,
                                                        border: Border(
                                                          top: BorderSide(color: colors.border),
                                                        ),
                                                      ),
                                                      child: Column(
                                                        children: [
                                                          Container(
                                                            padding: const EdgeInsets.symmetric(
                                                              horizontal: 12,
                                                              vertical: 12,
                                                            ),
                                                            decoration: BoxDecoration(
                                                              color: colors.surface,
                                                              borderRadius: BorderRadius.circular(12),
                                                              border: Border.all(color: colors.border),
                                                            ),
                                                            child: Row(
                                                              children: [
                                                                const Icon(
                                                                  Icons.verified_user_outlined,
                                                                  size: 18,
                                                                  color: Color(0xFF34D399),
                                                                ),
                                                                const SizedBox(width: 8),
                                                                Expanded(
                                                                  child: Text(
                                                                    'Refundable deposit',
                                                                    style: TextStyle(
                                                                      color: colors.textPrimary,
                                                                      fontSize: 13,
                                                                      fontWeight: FontWeight.w700,
                                                                    ),
                                                                  ),
                                                                ),
                                                                Text(
                                                                  formatPlanInr(
                                                                    detail.securityDeposit * _quantity,
                                                                  ),
                                                                  style: TextStyle(
                                                                    color: colors.textPrimary,
                                                                    fontSize: 15,
                                                                    fontWeight: FontWeight.w800,
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                          const SizedBox(height: 12),
                                                          Row(
                                                            crossAxisAlignment: CrossAxisAlignment.end,
                                                            children: [
                                                              Expanded(
                                                                child: Column(
                                                                  crossAxisAlignment:
                                                                      CrossAxisAlignment.start,
                                                                  children: [
                                                                    Text(
                                                                      'You pay for rent',
                                                                      style: TextStyle(
                                                                        color: colors.textPrimary,
                                                                        fontSize: 14,
                                                                        fontWeight: FontWeight.w800,
                                                                      ),
                                                                    ),
                                                                    const SizedBox(height: 4),
                                                                    Text(
                                                                      _quantity > 1
                                                                          ? '${formatPlanInr(selectedPlan.finalRentalPrice)} \u00d7 $_quantity units'
                                                                          : 'Excludes deposit & delivery',
                                                                      style: TextStyle(
                                                                        color: colors.textMuted,
                                                                        fontSize: 12,
                                                                        fontWeight: FontWeight.w500,
                                                                      ),
                                                                    ),
                                                                  ],
                                                                ),
                                                              ),
                                                              Text(
                                                                formatPlanInr(
                                                                  selectedPlan.finalRentalPrice *
                                                                      _quantity,
                                                                ),
                                                                style: TextStyle(
                                                                  color: priceColor,
                                                                  fontSize: 24,
                                                                  fontWeight: FontWeight.w800,
                                                                  height: 1,
                                                                ),
                                                              ),
                                                            ],
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ],
                                        );
                                      },
                                    ),
                                  ] else ...[
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        color: context.isDarkMode
                                            ? const Color(0xFFF59E0B).withValues(alpha: 0.12)
                                            : const Color(0xFFFFFBEB),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: context.isDarkMode
                                              ? const Color(0xFFF59E0B).withValues(alpha: 0.45)
                                              : const Color(0xFFFDE68A),
                                        ),
                                      ),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Icon(
                                            Icons.info_outline,
                                            color: context.isDarkMode ? const Color(0xFFFBBF24) : const Color(0xFFD97706),
                                            size: 18,
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'Rental plans not configured',
                                                  style: TextStyle(
                                                    color: context.isDarkMode ? const Color(0xFFFBBF24) : const Color(0xFFD97706),
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 14,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  'This product cannot be rented until an admin adds rental pricing plans.',
                                                  style: TextStyle(
                                                    color: context.isDarkMode ? Colors.white70 : const Color(0xFF92400E),
                                                    fontSize: 12,
                                                    height: 1.35,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],

                                 // Quantity lives inside the rent checkout strip when plans exist.
                                 if (!(actualOrderType == 'rent' &&
                                     detail.hasActiveRentalPlans &&
                                     selectedPlan != null)) ...[
                                   const SizedBox(height: 12),
                                   Container(
                                     width: double.infinity,
                                     decoration: BoxDecoration(
                                       color: colors.surfaceElevated,
                                       borderRadius: BorderRadius.circular(16),
                                       border: Border.all(color: colors.border),
                                     ),
                                     child: Padding(
                                       padding: const EdgeInsets.fromLTRB(16, 14, 10, 14),
                                       child: Row(
                                         children: [
                                           Expanded(
                                             child: Column(
                                               crossAxisAlignment: CrossAxisAlignment.start,
                                               children: [
                                                 RequiredLabel(
                                                   'Quantity',
                                                   required: true,
                                                   style: TextStyle(
                                                     color: colors.textPrimary,
                                                     fontSize: 14,
                                                     fontWeight: FontWeight.w800,
                                                   ),
                                                 ),
                                                 const SizedBox(height: 2),
                                                 Text(
                                                   _availableStockCaption(
                                                     currentQty: currentQty,
                                                     selectedVariant: selectedVariant,
                                                     isChemical: detail.isChemical,
                                                   ),
                                                   style: TextStyle(
                                                     color: colors.textMuted,
                                                     fontSize: 12,
                                                     fontWeight: FontWeight.w500,
                                                   ),
                                                 ),
                                               ],
                                             ),
                                           ),
                                           Row(
                                             children: [
                                               IconButton(
                                                 icon: Icon(
                                                   Icons.remove_circle_outline,
                                                   color: _quantity > 1
                                                       ? colors.textPrimary
                                                       : colors.textMuted,
                                                 ),
                                                 onPressed: _quantity > 1
                                                     ? () async {
                                                         final next = _quantity - 1;
                                                         if (actualOrderType == 'rent') {
                                                           final blocked =
                                                               await _promptRentToBuyIfNeeded(
                                                             detail: detail,
                                                             unitBuyPrice: unitBuyPrice,
                                                             nextQty: next,
                                                           );
                                                           if (blocked || !mounted) return;
                                                         }
                                                         setState(() => _quantity = next);
                                                       }
                                                     : null,
                                               ),
                                               Text(
                                                 '$_quantity',
                                                 style: TextStyle(
                                                   color: colors.textPrimary,
                                                   fontSize: 16,
                                                   fontWeight: FontWeight.bold,
                                                 ),
                                               ),
                                               IconButton(
                                                 icon: Icon(
                                                   Icons.add_circle_outline,
                                                   color: _quantity <
                                                           (currentQty > 0 ? currentQty : 1)
                                                       ? colors.textPrimary
                                                       : colors.textMuted,
                                                 ),
                                                 onPressed: _quantity <
                                                         (currentQty > 0 ? currentQty : 1)
                                                     ? () async {
                                                         final next = _quantity + 1;
                                                         if (actualOrderType == 'rent') {
                                                           final blocked =
                                                               await _promptRentToBuyIfNeeded(
                                                             detail: detail,
                                                             unitBuyPrice: unitBuyPrice,
                                                             nextQty: next,
                                                           );
                                                           if (blocked || !mounted) return;
                                                         }
                                                         setState(() => _quantity = next);
                                                       }
                                                     : null,
                                               ),
                                             ],
                                           ),
                                         ],
                                       ),
                                     ),
                                   ),
                                   const SizedBox(height: 8),
                                   Text(
                                     'Estimated ${actualOrderType == 'buy' ? 'buy amount' : 'rent'}: ${formatPlanInr(estimate)}',
                                     style: TextStyle(color: colors.textMuted, fontSize: 13),
                                   ),
                                 ],
                                if (_relatedProducts.isNotEmpty) ...[
                                  const SizedBox(height: 24),
                                  Text(
                                    'Related Products',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: colors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  GridView.builder(
                                    physics: const NeverScrollableScrollPhysics(),
                                    shrinkWrap: true,
                                    padding: EdgeInsets.zero,
                                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 2,
                                      mainAxisSpacing: 14,
                                      crossAxisSpacing: 12,
                                      mainAxisExtent: kBrowseProductCardExtent,
                                    ),
                                    itemCount: _relatedProducts.length,
                                    itemBuilder: (context, index) {
                                      final product = _relatedProducts[index];
                                      return BrowseProductCard(
                                        product: product,
                                        dimWhenInactive: true,
                                        onTap: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => ProductDetailScreen(listingId: product.id),
                                            ),
                                          );
                                        },
                                      );
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  SizedBox(
                                    width: double.infinity,
                                    height: 46,
                                    child: OutlinedButton(
                                      onPressed: () {
                                        Navigator.popUntil(context, (route) => route.isFirst);
                                      },
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(color: Color(0xFF6C63FF), width: 1.5),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      ),
                                      child: const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            'View More',
                                            style: TextStyle(
                                              color: Color(0xFF6C63FF),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          SizedBox(width: 6),
                                          Icon(Icons.arrow_forward_rounded, color: Color(0xFF6C63FF), size: 18),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 100),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
      bottomSheet: detail != null
          ? Consumer<CartProvider>(
              builder: (context, cart, _) {
                final inCart = cart.hasLine(
                  detail.id,
                  productVariantId: _selectedVariantId,
                );
                final addBlocked = !canAdd ||
                    cannotFulfill ||
                    (actualOrderType == 'rent' &&
                        (!detail.hasActiveRentalPlans || selectedPlan == null));

                return SafeArea(
                  top: false,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      border: Border(top: BorderSide(color: colors.border)),
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: inCart
                              ? const Color(0xFF10B981)
                              : const Color(0xFF6C63FF),
                          disabledBackgroundColor: colors.border,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        onPressed: inCart
                            ? () => CustomerDashboard.openCartTab(context)
                            : addBlocked
                                ? null
                                : () async {
                                    if (_quantity < 1 ||
                                        (actualOrderType == 'rent' &&
                                            (!detail.hasActiveRentalPlans ||
                                                selectedPlan == null))) {
                                      showRequiredFieldsBlocked(
                                        context,
                                        message: detail.hasActiveRentalPlans
                                            ? 'Please select a rental period and quantity.'
                                            : 'Rental plans are not configured for this product.',
                                      );
                                      return;
                                    }
                                    if (_quantity > currentQty) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            'Only $currentQty unit(s) available in stock.',
                                          ),
                                        ),
                                      );
                                      return;
                                    }

                                    if (actualOrderType == 'rent') {
                                      final blocked = await _promptRentToBuyIfNeeded(
                                        detail: detail,
                                        unitBuyPrice: unitBuyPrice,
                                      );
                                      if (!mounted || blocked) return;
                                    }

                                    final displayTitle = selectedVariant != null
                                        ? '${detail.title} (${selectedVariant.sizeLabel})'
                                        : detail.title;

                                    final finalType = detail.canRent && detail.canBuy
                                        ? _orderType
                                        : (detail.canBuy ? 'buy' : 'rent');

                                    cart.addLine(
                                      CartLineModel(
                                        listingId: detail.id,
                                        title: displayTitle,
                                        vendorName: detail.vendorName,
                                        primaryImageUrl: detail.primaryImageUrl ??
                                            resolveItemImageUrl(
                                              imageUrls: detail.imageUrls,
                                            ),
                                        dailyRent: detail.dailyRent,
                                        weeklyRent: detail.weeklyRent,
                                        monthlyRent: detail.monthlyRent,
                                        securityDeposit: detail.securityDeposit,
                                        quantity: _quantity,
                                        rentalDays: finalType == 'buy'
                                            ? 0
                                            : (selectedPlan?.durationDays ?? 0),
                                        rentalPeriodUnit: rentalUnitDay,
                                        orderType: finalType,
                                        prescriptionRequired: detail.prescriptionRequired,
                                        productVariantId: _selectedVariantId,
                                        buyPrice: unitBuyPrice > 0
                                            ? unitBuyPrice
                                            : detail.buyPrice,
                                        isBuyEnabled: detail.canBuy,
                                        isRentEnabled: detail.isRentEnabled,
                                        isChemical: detail.isChemical,
                                        rentalPricingPlanId: finalType == 'rent'
                                            ? selectedPlan?.id
                                            : null,
                                        rentalDurationLabel: finalType == 'rent' &&
                                                selectedPlan != null
                                            ? dayPlanTitle(
                                                selectedPlan.durationDays,
                                                selectedPlan.durationLabel,
                                              )
                                            : null,
                                        rentalDurationDays: finalType == 'rent'
                                            ? selectedPlan?.durationDays
                                            : null,
                                        rentalNormalPrice: finalType == 'rent'
                                            ? selectedPlan?.normalPrice
                                            : null,
                                        rentalDiscountType: finalType == 'rent'
                                            ? selectedPlan?.discountType
                                            : null,
                                        rentalDiscountValue: finalType == 'rent'
                                            ? selectedPlan?.discountValue
                                            : null,
                                        rentalFinalPrice: finalType == 'rent'
                                            ? selectedPlan?.finalRentalPrice
                                            : null,
                                      ),
                                    );
                                  },
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              inCart
                                  ? Icons.shopping_cart_outlined
                                  : Icons.add_shopping_cart_outlined,
                              size: 20,
                              color: canAdd || inCart
                                  ? Colors.white
                                  : colors.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              !canAdd
                                  ? 'Out of stock'
                                  : inCart
                                      ? 'Go to cart'
                                      : (actualOrderType == 'buy'
                                          ? 'Add to cart \u2014 Buy'
                                          : 'Add to cart \u2014 Rent'),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: canAdd || inCart
                                    ? Colors.white
                                    : colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            )
          : null,
    );
  }

  Future<void> _openRentalPeriodSheet({
    required ProductDetailModel detail,
    required double unitBuyPrice,
  }) async {
    final plans = detail.activeRentalPlans;
    if (plans.isEmpty) return;
    final currentId = _selectedPlan(detail)?.id;
    final bestId = bestSavingsPlanId(plans);

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: context.appColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.85,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.appColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Choose a rental plan',
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'More days, more savings',
                      style: TextStyle(
                        color: context.appColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                    itemCount: plans.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, index) {
                      final plan = plans[index];
                      final selected = plan.id == currentId;
                      final savings = planSavings(plan);
                      final pct = planDiscountPercent(plan);
                      final isBestDeal = bestId == plan.id && pct > 0;
                      final isDark = context.isDarkMode;
                      final accent = plan.isRecommended
                          ? const Color(0xFF3B82F6)
                          : const Color(0xFF8B5CF6);
                      final priceColor = plan.isRecommended
                          ? (isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB))
                          : context.appColors.textPrimary;

                      return InkWell(
                        onTap: () async {
                          Navigator.pop(ctx);
                          final blocked = await _promptRentToBuyIfNeeded(
                            detail: detail,
                            unitBuyPrice: unitBuyPrice,
                            nextPlan: plan,
                          );
                          if (blocked || !mounted) return;
                          setState(() => _selectedPlanId = plan.id);
                        },
                        borderRadius: BorderRadius.circular(14),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                          decoration: BoxDecoration(
                            color: selected
                                ? accent.withValues(alpha: plan.isRecommended ? 0.18 : 0.14)
                                : (plan.isRecommended
                                    ? (isDark ? const Color(0xFF1E3A5F).withValues(alpha: 0.35) : const Color(0xFFEFF6FF))
                                    : context.appColors.surfaceElevated),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: selected
                                  ? accent
                                  : (plan.isRecommended
                                      ? (isDark ? const Color(0xFF3B82F6).withValues(alpha: 0.5) : const Color(0xFF93C5FD))
                                      : context.appColors.border),
                              width: selected ? 1.5 : (plan.isRecommended ? 1.2 : 1),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 18,
                                height: 18,
                                margin: const EdgeInsets.only(top: 2),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: selected ? accent : Colors.transparent,
                                  border: Border.all(
                                    color: selected ? accent : context.appColors.border,
                                    width: 2,
                                  ),
                                ),
                                child: selected
                                    ? const Icon(Icons.check, size: 11, color: Colors.white)
                                    : null,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Wrap(
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      spacing: 6,
                                      runSpacing: 4,
                                      children: [
                                        Text(
                                          dayPlanTitle(plan.durationDays, plan.durationLabel),
                                          style: TextStyle(
                                            color: context.appColors.textPrimary,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 13,
                                          ),
                                        ),
                                        if (plan.isRecommended) _mostPopularBadge(),
                                        if (isBestDeal) _bestDealBadge(),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      planListMetaLine(plan),
                                        style: TextStyle(
                                          color: context.appColors.textMuted,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      if (savings > 0) ...[
                                        const SizedBox(height: 5),
                                        Text(
                                          pct > 0
                                              ? '$pct% off \u00b7 Save ${formatPlanInr(savings)}'
                                              : 'Save ${formatPlanInr(savings)}',
                                          style: TextStyle(
                                            color: context.isDarkMode
                                                ? const Color(0xFF34D399)
                                                : const Color(0xFF15803D),
                                            fontSize: 12,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ],
                                      // Web mobile row: price left, catalog icon right.
                                      const SizedBox(height: 8),
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  formatPlanInr(plan.finalRentalPrice),
                                                  style: TextStyle(
                                                    color: priceColor,
                                                    fontWeight: FontWeight.w800,
                                                    fontSize: 15,
                                                  ),
                                                ),
                                                if (savings > 0) ...[
                                                  const SizedBox(height: 2),
                                                  StruckPrice(
                                                    formatPlanInr(plan.normalPrice),
                                                    style: const TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          if (_planIconAvatar(plan, size: 36) case final icon?) icon,
                                        ],
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Returns true when the rent change should be blocked (dialog shown).
  Future<bool> _promptRentToBuyIfNeeded({
    required ProductDetailModel detail,
    required double unitBuyPrice,
    int? nextPeriods,
    String? nextUnit,
    int? nextQty,
    RentalPricingPlanModel? nextPlan,
  }) async {
    if (unitBuyPrice <= 0 || !detail.canBuy) return false;
    final plan = nextPlan ?? _selectedPlan(detail);
    final check = evaluateRentVsBuy(
      buyPrice: unitBuyPrice,
      isBuyEnabled: detail.canBuy,
      quantity: nextQty ?? _quantity,
      periods: plan?.durationDays ?? nextPeriods ?? _periodCount,
      unit: plan != null ? rentalUnitDay : (nextUnit ?? _periodUnit),
      dailyRent: detail.dailyRent,
      weeklyRent: detail.weeklyRent,
      monthlyRent: detail.monthlyRent,
      planFinalPrice: plan?.finalRentalPrice,
      planDurationLabel: plan?.durationLabel,
    );
    if (!check.shouldForceBuy) return false;

    final buyAvailable = detail.canBuy && unitBuyPrice > 0;
    final confirmed = await showRentExceedsBuyDialog(
      context,
      itemTitle: detail.title,
      rentalTotal: check.rentalTotal,
      buyTotal: check.buyTotal,
      durationLabel: check.durationLabel,
      buyAvailable: buyAvailable,
    );
    if (!mounted) return true;
    if (confirmed == true && buyAvailable) {
      setState(() => _orderType = 'buy');
    }
    return true;
  }

  String _availableStockCaption({
    required int currentQty,
    ProductVariantModel? selectedVariant,
    required bool isChemical,
  }) {
    if (currentQty <= 0) return 'Select how many units';
    if (isChemical && selectedVariant != null) {
      final size = selectedVariant.sizeLabel.trim();
      if (size.isNotEmpty) return '$currentQty available · $size';
    }
    return '$currentQty available';
  }

  Widget _documentsInline(List<CatalogDocumentModel> documents) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.description_outlined, size: 16, color: colors.textMuted),
            const SizedBox(width: 6),
            Text(
              'Documents',
              style: TextStyle(
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < documents.length; i++) ...[
                if (i > 0)
                  Divider(height: 1, thickness: 1, color: colors.border.withValues(alpha: 0.7)),
                _docInlineLink(documents[i], documents),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _docInlineLink(
    CatalogDocumentModel doc,
    List<CatalogDocumentModel> documents,
  ) {
    final colors = context.appColors;
    final label = catalogDocumentListLabel(doc, documents);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openDoc(doc.fileUrl),
        child: SizedBox(
          height: 36,
          child: Padding(
            padding: const EdgeInsets.only(left: 10, right: 2),
            child: Row(
              children: [
                const Icon(Icons.insert_drive_file_outlined, size: 15, color: Color(0xFF6C63FF)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF6C63FF),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 1.15,
                    ),
                  ),
                ),
                Tooltip(
                  message: 'Download $label',
                  child: InkWell(
                    onTap: () => _openDoc(doc.fileUrl),
                    customBorder: const CircleBorder(),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: Icon(Icons.download_outlined, size: 16, color: colors.textMuted),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openDoc(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      await _copyDocLink(url);
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      await _copyDocLink(url);
    }
  }

  Future<void> _copyDocLink(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Document link copied'), backgroundColor: Colors.green),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    final colors = context.appColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _priceRow(String label, String value, {bool highlight = false}) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: colors.textSecondary)),
          Text(
            value,
            style: TextStyle(
              color: highlight ? const Color(0xFF10B981) : colors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _specItem(String label, String value) {
    final colors = context.appColors;
    return SizedBox(
      width: 140,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: colors.textMuted, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildTypeOption(String value, String label) {
    final colors = context.appColors;
    final isSelected = _orderType == value;
    return GestureDetector(
      onTap: () => setState(() => _orderType = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF6C63FF) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? const Color(0xFF6C63FF) : colors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : colors.textSecondary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
