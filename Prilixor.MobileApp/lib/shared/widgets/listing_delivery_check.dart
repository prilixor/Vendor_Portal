import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/providers/address_provider.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/theme.dart';
import '../../features/profile/addresses_screen.dart';
import '../utils/require_auth.dart';
import 'legal_policy_links.dart';

class ListingDeliveryCheck extends StatefulWidget {
  final Map<String, dynamic> quoteLine;

  const ListingDeliveryCheck({super.key, required this.quoteLine});

  @override
  State<ListingDeliveryCheck> createState() => _ListingDeliveryCheckState();
}

class _ListingDeliveryCheckState extends State<ListingDeliveryCheck> {
  final _pincode = TextEditingController();
  bool _checking = false;
  String? _message;
  bool _ok = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated) {
        context.read<AddressProvider>().fetchAddresses();
      }
    });
  }

  @override
  void dispose() {
    _pincode.dispose();
    super.dispose();
  }

  String _digits(String value) {
    final only = value.replaceAll(RegExp(r'\D'), '');
    return only.length <= 6 ? only : only.substring(0, 6);
  }

  Future<void> _check() async {
    final pin = _digits(_pincode.text);
    if (pin.length != 6) {
      setState(() {
        _ok = false;
        _message = 'Enter a 6-digit pincode.';
      });
      return;
    }

    final signedIn = await ensureAuthenticated(
      context,
      message: 'Sign in and save this pincode on a delivery address to confirm service.',
    );
    if (!signedIn || !mounted) return;

    await context.read<AddressProvider>().fetchAddresses();
    if (!mounted) return;

    final match = context.read<AddressProvider>().addresses.where((a) => _digits(a.postal) == pin);
    if (match.isEmpty) {
      setState(() {
        _ok = false;
        _message = 'No saved address uses this pincode. Add it in Addresses, then check again.';
      });
      return;
    }

    setState(() {
      _checking = true;
      _message = null;
    });
    final error = await context.read<CheckoutProvider>().checkServiceArea(
          addressId: match.first.id,
          line: widget.quoteLine,
        );
    if (!mounted) return;
    setState(() {
      _checking = false;
      _ok = error == null;
      _message = error ?? 'We can deliver to $pin.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final pin = _digits(_pincode.text);
    final auth = context.watch<AuthProvider>();
    final addresses = context.watch<AddressProvider>().addresses;
    final hasMatchingAddress = addresses.any((a) => _digits(a.postal) == pin);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_shipping_outlined, size: 16, color: colors.accent),
              const SizedBox(width: 6),
              Text(
                'Check delivery by pincode',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _pincode,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  onChanged: (_) => setState(() {
                    _message = null;
                    _ok = false;
                  }),
                  decoration: const InputDecoration(
                    hintText: '6-digit pincode',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 40,
                child: ElevatedButton(
                  onPressed: _checking ? null : _check,
                  child: _checking
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Check'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_message != null)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (_ok) Icon(Icons.check, size: 14, color: colors.accent),
                if (_ok) const SizedBox(width: 4),
                Text(
                  _message!,
                  style: TextStyle(
                    color: _ok ? const Color(0xFF059669) : colors.textSecondary,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
                if (!auth.isAuthenticated)
                  TextButton(
                    onPressed: () => ensureAuthenticated(context),
                    child: const Text('Sign in'),
                  )
                else if (!_ok && pin.length == 6 && !hasMatchingAddress)
                  TextButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AddressesScreen(openAddOnLoad: true)),
                    ),
                    child: const Text('Add address'),
                  ),
              ],
            )
          else
            Text(
              'Delivery is confirmed from your address pincode. Final charges appear at checkout.',
              style: TextStyle(color: colors.textSecondary, fontSize: 11, height: 1.35),
            ),
          const SizedBox(height: 8),
          const ProductDetailPolicyLinks(),
        ],
      ),
    );
  }
}
