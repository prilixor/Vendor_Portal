import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/models/vendor_onboarding_model.dart';
import '../../core/models/vendor_profile_model.dart';
import '../../core/providers/vendor_location_provider.dart';
import '../../core/providers/vendor_onboarding_provider.dart';
import '../../shared/widgets/state_city_picker.dart';
import '../../core/providers/vendor_profile_provider.dart';
import '../../core/theme.dart';
import '../../core/utils/device_location.dart';
import '../../core/utils/indian_mobile_phone.dart';
import '../../core/utils/multipart_file_util.dart';
import '../../core/utils/place_search.dart';
import 'document_preview_screen.dart';
import '../../shared/widgets/admin_comment_hint.dart';
import 'onboarding_widgets.dart';
import '../service_areas/service_area_map_picker.dart';
import '../support/support_chat_screen.dart';

class OnboardingScreen extends StatefulWidget {
  final int initialTab;

  const OnboardingScreen({super.key, this.initialTab = 0});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _selectedDocType = vendorDocumentTypes.first;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, 2),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final onboarding =
        Provider.of<VendorOnboardingProvider>(context, listen: false);
    final profile =
        Provider.of<VendorProfileProvider>(context, listen: false);
    await Future.wait([
      onboarding.loadAll(vendorId),
      profile.fetchProfile(vendorId),
      Provider.of<VendorLocationProvider>(context, listen: false).fetchStates(),
    ]);
  }

  Future<void> _submitVerification() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider =
        Provider.of<VendorOnboardingProvider>(context, listen: false);
    final ok = await provider.submitVerification(vendorId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Submitted for verification.' : (provider.error ?? 'Failed'),
        ),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  void _openVerificationSupportHelp(VendorOnboardingProvider onboarding) {
    final rejectedDocs = onboarding.rejectedDocuments;
    final rejectedBank = onboarding.hasRejectedBankAccount;
    final docNames = rejectedDocs.map((d) => d.documentType).toList();
    var message = docNames.isEmpty
        ? 'My bank account verification was rejected. I need help understanding what to fix and resubmit.'
        : 'My ${docNames.join(', ')} verification was rejected${rejectedBank ? ' and my bank account was also rejected' : ''}. I need help understanding what to fix and resubmit.';

    final adminNotes = rejectedDocs
        .where((d) => d.displayRejectionReason != null)
        .map((d) => '${d.documentType}: "${d.displayRejectionReason}"')
        .join('\n');
    if (adminNotes.isNotEmpty) {
      message = '$message\n\nAdmin notes:\n$adminNotes';
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SupportChatScreen(
          initialCategory: docNames.isEmpty ? 'Verification' : 'Documents',
          initialMessage: message,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = Provider.of<VendorOnboardingProvider>(context);
    final profileProvider = Provider.of<VendorProfileProvider>(context);
    final status = profileProvider.status;
    final verification = onboarding.latestVerification;

    final statusBanner = status == null
        ? null
        : OnboardingStatusBanner(
            accountStatus: status.accountStatus,
            verificationStatus: verification?.reviewStatus,
            isVerified: onboarding.isVerified,
            documentsUploaded: onboarding.documents.length,
            hasBank: onboarding.primaryBank != null,
          );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Onboarding'),
        actions: [
          TextButton.icon(
            onPressed: onboarding.saving ? null : _submitVerification,
            icon: const Icon(Icons.send_rounded, size: 18, color: Colors.white),
            label: const Text('Submit', style: TextStyle(color: Colors.white)),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.accent,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
          tabs: const [
            Tab(icon: Icon(Icons.store_outlined, size: 20), text: 'Profile'),
            Tab(icon: Icon(Icons.folder_open_outlined, size: 20), text: 'Documents'),
            Tab(icon: Icon(Icons.account_balance_outlined, size: 20), text: 'Bank'),
          ],
        ),
      ),
      body: onboarding.loading && onboarding.documents.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.accent),
            )
          : Column(
              children: [
                if (onboarding.hasRejectedVerificationItems)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: OnboardingRejectedHelpBanner(
                      rejectedDocuments: onboarding.rejectedDocuments,
                      rejectedBank: onboarding.hasRejectedBankAccount,
                      onGetHelp: () => _openVerificationSupportHelp(onboarding),
                    ),
                  ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _ProfileTab(
                        profile: profileProvider.profile,
                        header: statusBanner,
                      ),
                      _DocumentsTab(
                        header: statusBanner,
                        selectedType: _selectedDocType,
                        onTypeChanged: (v) => setState(() => _selectedDocType = v),
                      ),
                      _BankTab(header: statusBanner),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _ProfileTab extends StatefulWidget {
  final VendorProfile? profile;
  final Widget? header;

  const _ProfileTab({this.profile, this.header});

  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  final _businessController = TextEditingController();
  final _ownerController = TextEditingController();
  final _phoneController = TextEditingController();
  final _gstController = TextEditingController();
  final _address1Controller = TextEditingController();
  final _address2Controller = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _postalController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  bool _locating = false;
  bool _resolvingAddress = false;
  int _stateCityKey = 0;
  final PlaceSearch _placeSearch = PlaceSearch();

  static const double _defaultLat = 23.0225;
  static const double _defaultLng = 72.5714;

  double get _mapLat =>
      double.tryParse(_latController.text.trim()) ?? _defaultLat;
  double get _mapLng =>
      double.tryParse(_lngController.text.trim()) ?? _defaultLng;

  @override
  void initState() {
    super.initState();
    _syncFromProfile(widget.profile);
  }

  @override
  void didUpdateWidget(covariant _ProfileTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile?.id != widget.profile?.id) {
      _syncFromProfile(widget.profile);
    }
  }

  void _syncFromProfile(VendorProfile? p) {
    if (p == null) return;
    _businessController.text = p.businessName;
    _ownerController.text = p.ownerName;
    _phoneController.text = IndianMobilePhone.normalizeDigits(p.supportPhone);
    _gstController.text = p.gstNumber ?? '';
    _address1Controller.text = p.addressLine1;
    _address2Controller.text = p.addressLine2 ?? '';
    _cityController.text = p.city;
    _stateController.text = p.state;
    _postalController.text = p.postalCode;
    _latController.text = p.latitude?.toStringAsFixed(6) ?? '';
    _lngController.text = p.longitude?.toStringAsFixed(6) ?? '';
  }

  @override
  void dispose() {
    _businessController.dispose();
    _ownerController.dispose();
    _phoneController.dispose();
    _gstController.dispose();
    _address1Controller.dispose();
    _address2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _postalController.dispose();
    _latController.dispose();
    _lngController.dispose();
    _placeSearch.close();
    super.dispose();
  }

  Future<void> _applyReverseGeocode(
    double lat,
    double lng, {
    bool announceIfComplete = false,
  }) async {
    setState(() => _resolvingAddress = true);
    final rev = await _placeSearch.reverse(latitude: lat, longitude: lng);
    if (!mounted) return;

    final line1 = rev?.line1?.trim();
    final state = rev?.state?.trim();
    final city = rev?.city?.trim();
    final postal = rev?.postal?.trim();
    var remountPicker = false;

    if (line1 != null && line1.isNotEmpty) {
      _address1Controller.text = line1;
    }
    if (postal != null && postal.isNotEmpty) {
      _postalController.text = postal;
    }
    if (state != null && state.isNotEmpty) {
      _stateController.text = state;
      remountPicker = true;
    }
    if (city != null && city.isNotEmpty) {
      _cityController.text = city;
      remountPicker = true;
    }
    if (remountPicker) _stateCityKey++;

    setState(() => _resolvingAddress = false);

    final missing = <String>[];
    if (_address1Controller.text.trim().isEmpty) missing.add('address line');
    if (_stateController.text.trim().isEmpty) missing.add('state');
    if (_cityController.text.trim().isEmpty) missing.add('city');
    if (_postalController.text.trim().isEmpty) missing.add('postal code');

    if (!mounted) return;
    if (missing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Map pin saved. Please fill required ${missing.join(', ')}.',
          ),
        ),
      );
    } else if (announceIfComplete) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location applied from map.')),
      );
    }
  }

  Future<void> _setMapLocation(
    double lat,
    double lng, {
    bool announceIfComplete = false,
  }) async {
    setState(() {
      _latController.text = lat.toStringAsFixed(6);
      _lngController.text = lng.toStringAsFixed(6);
    });
    await _applyReverseGeocode(
      lat,
      lng,
      announceIfComplete: announceIfComplete,
    );
  }

  Future<void> _save() async {
    final vendorId =
        Provider.of<AuthProvider>(context, listen: false).vendorId;
    final current = widget.profile;
    if (vendorId == null || current == null) return;

    final phoneErr = IndianMobilePhone.requiredError(_phoneController.text);
    if (phoneErr != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(phoneErr), backgroundColor: Colors.redAccent),
      );
      return;
    }

    final updated = current.copyWith(
      businessName: _businessController.text.trim(),
      ownerName: _ownerController.text.trim(),
      supportPhone: IndianMobilePhone.normalizeDigits(_phoneController.text),
      gstNumber: _gstController.text.trim().isEmpty ? null : _gstController.text.trim(),
      addressLine1: _address1Controller.text.trim(),
      addressLine2: _address2Controller.text.trim().isEmpty ? null : _address2Controller.text.trim(),
      city: _cityController.text.trim(),
      state: _stateController.text.trim(),
      postalCode: _postalController.text.trim(),
      latitude: double.tryParse(_latController.text.trim()),
      longitude: double.tryParse(_lngController.text.trim()),
    );

    final onboarding =
        Provider.of<VendorOnboardingProvider>(context, listen: false);
    final ok = await onboarding.saveFullProfile(vendorId, updated);
    if (!mounted) return;
    if (ok) {
      await Provider.of<VendorProfileProvider>(context, listen: false)
          .fetchProfile(vendorId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved.')),
      );
    } else if (onboarding.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(onboarding.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _locating = true);
    try {
      final result = await resolveDeviceLocation();
      if (!mounted) return;
      if (!result.ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result.errorMessage ??
                  'Could not get location. Enter coordinates manually or from Google Maps.',
            ),
            backgroundColor: Colors.redAccent,
            action: result.shouldOpenSettings
                ? SnackBarAction(
                    label: 'Settings',
                    textColor: Colors.white,
                    onPressed: Geolocator.openAppSettings,
                  )
                : null,
          ),
        );
        return;
      }
      await _setMapLocation(
        result.latitude!,
        result.longitude!,
        announceIfComplete: true,
      );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _openGoogleMaps() async {
    final lat = double.tryParse(_latController.text.trim());
    final lng = double.tryParse(_lngController.text.trim());
    final Uri uri;
    if (lat != null && lng != null) {
      uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    } else {
      final parts = [
        _address1Controller.text.trim(),
        _cityController.text.trim(),
        _stateController.text.trim(),
        _postalController.text.trim(),
      ].where((p) => p.isNotEmpty);
      if (parts.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter an address or coordinates first.')),
        );
        return;
      }
      uri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(parts.join(', '))}',
      );
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = Provider.of<VendorOnboardingProvider>(context).saving;
    if (widget.profile == null) {
      return const Center(
        child: Text('No profile loaded.', style: TextStyle(color: Colors.white54)),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (widget.header != null) ...[
          widget.header!,
          const SizedBox(height: 16),
        ],
        OnboardingFormSection(
          title: 'Business details',
          subtitle: 'Shown to customers on your store profile.',
          child: Column(
            children: [
              OnboardingTextField(controller: _businessController, label: 'Business name *'),
              OnboardingTextField(controller: _ownerController, label: 'Owner name *'),
              OnboardingTextField(
                controller: _phoneController,
                label: 'Support phone *',
                hint: '9876543210',
                helperText: 'Indian mobile: 10 digits starting with 6–9',
                keyboardType: TextInputType.phone,
                maxLength: 10,
                prefixText: '+91 ',
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              OnboardingTextField(
                controller: _gstController,
                label: 'GST number (optional)',
              ),
            ],
          ),
        ),
        OnboardingFormSection(
          title: 'Business address',
          child: Column(
            children: [
              OnboardingTextField(controller: _address1Controller, label: 'Address line 1 *'),
              OnboardingTextField(controller: _address2Controller, label: 'Address line 2'),
              StateCityPickerFields(
                key: ValueKey('onboarding-state-city-$_stateCityKey'),
                stateController: _stateController,
                cityController: _cityController,
                initialStateName: _stateController.text.isNotEmpty
                    ? _stateController.text
                    : widget.profile?.state,
                initialCityName: _cityController.text.isNotEmpty
                    ? _cityController.text
                    : widget.profile?.city,
              ),
              if (_resolvingAddress)
                const Padding(
                  padding: EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Resolving address from pin…',
                        style: TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              OnboardingTextField(
                controller: _postalController,
                label: 'Postal code *',
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        OnboardingFormSection(
          title: 'Map location',
          subtitle:
              'Used for service area matching. Pin on map, GPS, or paste from Google Maps — pin fills address when available.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: _locating ? null : _useCurrentLocation,
                icon: _locating
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location_rounded),
                label: Text(_locating ? 'Getting location…' : 'Use my current location'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(46),
                  foregroundColor: AppTheme.accent,
                  side: BorderSide(color: AppTheme.accent.withValues(alpha: 0.45)),
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _openGoogleMaps,
                icon: const Icon(Icons.map_outlined),
                label: const Text('Open in Google Maps'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  foregroundColor: Colors.white70,
                  side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
                ),
              ),
              const SizedBox(height: 12),
              ServiceAreaMapPicker(
                latitude: _mapLat,
                longitude: _mapLng,
                showRadius: false,
                height: 260,
                onLocationChanged: (point) =>
                    _setMapLocation(point.latitude, point.longitude),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OnboardingTextField(
                      controller: _latController,
                      label: 'Latitude',
                      hint: 'e.g. 23.041944',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OnboardingTextField(
                      controller: _lngController,
                      label: 'Longitude',
                      hint: 'e.g. 72.478620',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                ],
              ),
              Text(
                'How to set coordinates:\n'
                '• Tap the map or search to drop a pin (fills address when available)\n'
                '• Tap "Use my current location" (allow GPS)\n'
                '• Or open Google Maps → long-press your shop → copy lat/long\n'
                '• Paste the numbers below, then Save profile',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
        ElevatedButton(
          onPressed: saving ? null : _save,
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: AppTheme.accent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: saving
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save profile', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}

class _DocumentsTab extends StatelessWidget {
  final Widget? header;
  final String? selectedType;
  final ValueChanged<String?> onTypeChanged;

  const _DocumentsTab({
    this.header,
    required this.selectedType,
    required this.onTypeChanged,
  });

  Future<void> _upload(BuildContext context) async {
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null || selectedType == null) return;

    final existing = Provider.of<VendorOnboardingProvider>(context, listen: false)
        .documents
        .where((d) => d.documentType == selectedType)
        .toList();
    if (existing.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$selectedType is already uploaded. View or delete it first.'),
        ),
      );
      return;
    }

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
      // Web: stream large PDFs instead of loading all bytes into memory.
      withData: !kIsWeb,
      withReadStream: kIsWeb,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (platformFileNeedsBytes(file)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            kIsWeb && platformFileIsPdf(file)
                ? 'Could not read the PDF. Try a smaller file or use PNG/JPG.'
                : 'Could not read the selected file. Please try again.',
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }
    if (!context.mounted) return;

    final provider = Provider.of<VendorOnboardingProvider>(context, listen: false);
    final ok = await provider.uploadDocument(
      vendorId: vendorId,
      documentType: selectedType!,
      file: file,
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Document uploaded.' : (provider.error ?? 'Upload failed')),
        backgroundColor: ok ? null : Colors.redAccent,
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, VendorDocument doc) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.card(context),
        title: const Text('Delete document?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Remove ${doc.documentType}? You can upload a new file after deleting.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.75)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    await Provider.of<VendorOnboardingProvider>(context, listen: false)
        .deleteDocument(vendorId, doc.id);
  }

  void _preview(BuildContext context, VendorDocument doc) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => DocumentPreviewScreen(document: doc)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = Provider.of<VendorOnboardingProvider>(context);
    final docs = onboarding.documents;
    final saving = onboarding.saving;
    final uploadedTypes = docs.map((d) => d.documentType).toSet();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (header != null) ...[
          header!,
          const SizedBox(height: 16),
        ],
        OnboardingFormSection(
          title: 'Upload new document',
          subtitle: 'PDF or image (PNG, JPG, WEBP). One file per document type.',
          child: Column(
            children: [
              DropdownButtonFormField<String>(
                initialValue: selectedType,
                dropdownColor: AppTheme.card(context),
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Document type',
                  labelStyle: const TextStyle(color: Colors.white54),
                  filled: true,
                  fillColor: AppTheme.bg(context),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                  ),
                ),
                items: vendorDocumentTypes.map((t) {
                  final uploaded = uploadedTypes.contains(t);
                  return DropdownMenuItem(
                    value: t,
                    child: Text(uploaded ? '$t (uploaded)' : t),
                  );
                }).toList(),
                onChanged: onTypeChanged,
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: saving ? null : () => _upload(context),
                  icon: const Icon(Icons.upload_file_rounded),
                  label: const Text('Choose file & upload'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: AppTheme.accent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Uploaded documents',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              Text(
                '${docs.length}/${vendorDocumentTypes.length}',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 13),
              ),
            ],
          ),
        ),
        if (docs.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: AppTheme.card(context),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Column(
              children: [
                Icon(Icons.folder_off_outlined, size: 40, color: Colors.white.withValues(alpha: 0.25)),
                const SizedBox(height: 10),
                Text(
                  'No documents uploaded yet',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
                ),
              ],
            ),
          )
        else
          ...docs.map(
            (d) => _DocumentCard(
              document: d,
              onView: () => _preview(context, d),
              onDelete: saving ? null : () => _confirmDelete(context, d),
            ),
          ),
        const SizedBox(height: 8),
        ...vendorDocumentTypes.where((t) => !uploadedTypes.contains(t)).map(
              (t) => _MissingDocumentRow(type: t),
            ),
      ],
    );
  }
}

class _DocumentCard extends StatelessWidget {
  final VendorDocument document;
  final VoidCallback onView;
  final VoidCallback? onDelete;

  const _DocumentCard({
    required this.document,
    required this.onView,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.card(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onView,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    document.isPdfFile
                        ? Icons.picture_as_pdf
                        : document.isImageFile
                            ? Icons.image_outlined
                            : documentTypeIcon(document.documentType),
                    color: AppTheme.accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        document.documentType,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        document.displayFileLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.48),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          VerificationStatusChip(status: document.verificationStatus),
                          const SizedBox(width: 8),
                          Text(
                            'Tap to view',
                            style: TextStyle(
                              color: AppTheme.accent.withValues(alpha: 0.9),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      if (document.isRejected) ...[
                        const SizedBox(height: 8),
                        AdminCommentHint(
                          itemLabel: document.documentType,
                          comment: document.displayRejectionReason,
                          margin: EdgeInsets.zero,
                        ),
                      ],
                    ],
                  ),
                ),
                Column(
                  children: [
                    IconButton(
                      tooltip: 'View',
                      onPressed: onView,
                      icon: const Icon(Icons.visibility_outlined, color: AppTheme.accent),
                    ),
                    if (onDelete != null)
                      IconButton(
                        tooltip: 'Delete',
                        onPressed: onDelete,
                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MissingDocumentRow extends StatelessWidget {
  final String type;

  const _MissingDocumentRow({required this.type});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(documentTypeIcon(type), size: 20, color: Colors.amber.withValues(alpha: 0.9)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$type — not uploaded',
              style: TextStyle(
                color: Colors.amber.withValues(alpha: 0.95),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BankTab extends StatefulWidget {
  final Widget? header;

  const _BankTab({this.header});

  @override
  State<_BankTab> createState() => _BankTabState();
}

class _BankTabState extends State<_BankTab> {
  final _holderController = TextEditingController();
  final _bankController = TextEditingController();
  final _branchController = TextEditingController();
  final _accountController = TextEditingController();
  final _confirmController = TextEditingController();
  final _ifscController = TextEditingController();
  String? _bankId;
  bool _ifscLookingUp = false;
  bool _obscureAccount = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncBank());
  }

  void _syncBank() {
    final bank = Provider.of<VendorOnboardingProvider>(context, listen: false).primaryBank;
    if (bank == null) return;
    _bankId = bank.id;
    _holderController.text = bank.accountHolderName;
    _bankController.text = bank.bankName;
    _branchController.text = bank.branchName;
    _accountController.text = bank.accountNumber;
    _confirmController.text = bank.accountNumber;
    _ifscController.text = bank.ifscCode;
    setState(() {});
  }

  @override
  void dispose() {
    _holderController.dispose();
    _bankController.dispose();
    _branchController.dispose();
    _accountController.dispose();
    _confirmController.dispose();
    _ifscController.dispose();
    super.dispose();
  }

  Future<void> _lookupIfsc() async {
    final ifsc = _ifscController.text.trim().toUpperCase();
    if (ifsc.length != 11) return;
    setState(() => _ifscLookingUp = true);
    final result =
        await Provider.of<VendorOnboardingProvider>(context, listen: false).lookupIfsc(ifsc);
    if (!mounted) return;
    setState(() {
      _ifscLookingUp = false;
      if (result != null) {
        _bankController.text = result['bankName'] ?? _bankController.text;
        _branchController.text = result['branchName'] ?? _branchController.text;
      }
    });
  }

  Future<void> _save() async {
    if (_accountController.text.trim() != _confirmController.text.trim()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account numbers do not match.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }
    final vendorId = Provider.of<AuthProvider>(context, listen: false).vendorId;
    if (vendorId == null) return;
    final provider = Provider.of<VendorOnboardingProvider>(context, listen: false);
    final ok = await provider.saveBankAccount(
      vendorId: vendorId,
      accountHolderName: _holderController.text,
      bankName: _bankController.text,
      accountNumber: _accountController.text,
      branchName: _branchController.text,
      ifscCode: _ifscController.text,
      bankAccountId: _bankId,
    );
    if (!mounted) return;
    if (ok) {
      _syncBank();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bank details saved.')),
      );
    } else if (provider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error!), backgroundColor: Colors.redAccent),
      );
    }
  }

  String _maskAccount(String value) {
    if (value.length <= 4) return value;
    return '${'•' * (value.length - 4)}${value.substring(value.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final saving = Provider.of<VendorOnboardingProvider>(context).saving;
    final bank = Provider.of<VendorOnboardingProvider>(context).primaryBank;
    if (_bankId == null && bank != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncBank());
    }

    final account = _accountController.text.trim();
    final confirm = _confirmController.text.trim();
    final accountsMatch = account.isNotEmpty && confirm.isNotEmpty && account == confirm;
    final accountsMismatch = account.isNotEmpty && confirm.isNotEmpty && account != confirm;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (widget.header != null) ...[
          widget.header!,
          const SizedBox(height: 16),
        ],
        if (bank != null)
          SavedBankAccountCard(
            bankName: bank.bankName,
            accountHolderName: bank.accountHolderName,
            maskedAccountNumber: _maskAccount(bank.accountNumber),
            ifscCode: bank.ifscCode,
            branchName: bank.branchName,
            verificationStatus: bank.verificationStatus,
          ),
        OnboardingFormSection(
          icon: Icons.account_balance_wallet_outlined,
          title: bank == null ? 'Add bank account' : 'Update bank account',
          subtitle: 'Enter valid IFSC to auto-fill bank and branch. Account number must match on both fields.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const OnboardingSubsectionTitle(
                title: 'Account holder',
                icon: Icons.person_outline,
              ),
              OnboardingTextField(
                controller: _holderController,
                label: 'Account holder name',
                hint: 'As printed on your bank account',
              ),
              const OnboardingSubsectionTitle(
                title: 'IFSC & branch',
                icon: Icons.search_rounded,
              ),
              const OnboardingHintBanner(
                icon: Icons.info_outline,
                message: 'Enter the 11-character IFSC code, then tap search or wait for auto lookup.',
              ),
              OnboardingTextField(
                controller: _ifscController,
                label: 'IFSC code',
                hint: 'e.g. SBIN0006124',
                maxLength: 11,
                textCapitalization: TextCapitalization.characters,
                onChanged: (_) {
                  setState(() {});
                  if (_ifscController.text.trim().length == 11) {
                    _lookupIfsc();
                  }
                },
                suffix: _ifscLookingUp
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                        ),
                      )
                    : IconButton(
                        onPressed: _lookupIfsc,
                        tooltip: 'Lookup IFSC',
                        icon: const Icon(Icons.search_rounded, color: AppTheme.accent),
                      ),
              ),
              OnboardingTextField(
                controller: _bankController,
                label: 'Bank name',
                hint: 'Filled automatically from IFSC',
              ),
              OnboardingTextField(
                controller: _branchController,
                label: 'Branch name',
                hint: 'Filled automatically from IFSC',
              ),
              const OnboardingSubsectionTitle(
                title: 'Account number',
                icon: Icons.lock_outline,
              ),
              OnboardingTextField(
                controller: _accountController,
                label: 'Account number',
                hint: 'Enter account number',
                keyboardType: TextInputType.number,
                obscureText: _obscureAccount,
                onChanged: (_) => setState(() {}),
                suffix: IconButton(
                  onPressed: () => setState(() => _obscureAccount = !_obscureAccount),
                  icon: Icon(
                    _obscureAccount ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: Colors.white54,
                  ),
                ),
              ),
              OnboardingTextField(
                controller: _confirmController,
                label: 'Confirm account number',
                hint: 'Re-enter account number',
                keyboardType: TextInputType.number,
                obscureText: _obscureConfirm,
                onChanged: (_) => setState(() {}),
                suffix: IconButton(
                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                  icon: Icon(
                    _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: Colors.white54,
                  ),
                ),
              ),
              if (accountsMatch)
                Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF34D399).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF34D399).withValues(alpha: 0.25)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle_rounded, color: Color(0xFF34D399), size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Account numbers match.',
                          style: TextStyle(
                            color: Color(0xFF34D399),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              if (accountsMismatch)
                Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Account numbers do not match.',
                          style: TextStyle(
                            color: Colors.redAccent,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        ElevatedButton.icon(
          onPressed: saving || accountsMismatch ? null : _save,
          style: ElevatedButton.styleFrom(
            minimumSize: const Size.fromHeight(54),
            backgroundColor: AppTheme.accent,
            disabledBackgroundColor: AppTheme.accent.withValues(alpha: 0.35),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          icon: saving
              ? const SizedBox.shrink()
              : const Icon(Icons.save_rounded, size: 20),
          label: saving
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  bank == null ? 'Save bank details' : 'Update bank details',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
        ),
        const SizedBox(height: 10),
        Text(
          'Your bank details are encrypted and used only for vendor payouts.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.38),
            fontSize: 11,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}
