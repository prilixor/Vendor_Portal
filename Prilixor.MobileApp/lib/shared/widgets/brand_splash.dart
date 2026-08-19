import 'package:flutter/material.dart';

import 'brand_page_loader.dart';

/// Branded splash while session bootstrap / cold start UI is ready.
class BrandSplash extends StatelessWidget {
  const BrandSplash({
    super.key,
    this.backgroundColor,
    this.label = 'Loading BlinksMed…',
  });

  final Color? backgroundColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? Theme.of(context).scaffoldBackgroundColor;
    return Scaffold(
      backgroundColor: bg,
      body: BrandPageLoader(
        label: label,
        size: BrandPageLoaderSize.lg,
      ),
    );
  }
}
